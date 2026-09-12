
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .config import Settings
from .database import connect, json_value, transaction
from .detectors.base import Detector
from .errors import OrbitError, bad_request, conflict, not_found
from .schemas import CheckoutRequest, ReturnRequest, ReviewRequest, ScanRequest


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex}"


def canonical_hash(payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _item_payload(row: sqlite3.Row) -> dict:
    available = int(row["available_quantity"])
    total = int(row["total_quantity"])
    return {
        "id": row["id"],
        "sku": row["sku"],
        "name": row["name"],
        "category": row["category"],
        "description": row["description"],
        "item_type": row["item_type"],
        "base_unit": row["base_unit"],
        "display_unit": row["issue_unit"],
        "conversion_to_base": row["conversion_to_base"],
        "available_quantity": available,
        "checked_out_quantity": max(0, total - available),
        "total_quantity": total,
        "reorder_level": int(row["reorder_level"]),
        "needs_attention": available <= int(row["reorder_level"]),
        "store_id": row["store_id"],
        "rack": row["rack"],
        "image_url": row["image_url"],
        "ai_class_key": row["ai_class_key"],
        "updated_at": row["updated_at"],
    }


def _store_row(db: sqlite3.Connection, store_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM stores WHERE id = ? AND is_active = 1", (store_id,)).fetchone()
    if not row:
        raise not_found("STORE_NOT_FOUND", f"Store {store_id!r} was not found")
    return row


def list_inventory(
    db_path: Path,
    *,
    store_id: str | None = None,
    search: str | None = None,
    category: str | None = None,
    item_type: str | None = None,
    attention_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    clauses = ["is_active = 1"]
    params: list = []
    if store_id:
        clauses.append("store_id = ?")
        params.append(store_id)
    if search:
        clauses.append("(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(category) LIKE ? OR LOWER(rack) LIKE ?)")
        term = f"%{search.lower()}%"
        params.extend([term, term, term, term])
    if category:
        clauses.append("category = ?")
        params.append(category)
    if item_type:
        clauses.append("item_type = ?")
        params.append(item_type)
    if attention_only:
        clauses.append("available_quantity <= reorder_level")
    where = " AND ".join(clauses)
    db = connect(db_path)
    try:
        total = db.execute(f"SELECT COUNT(*) FROM inventory_items WHERE {where}", params).fetchone()[0]
        rows = db.execute(
            f"SELECT * FROM inventory_items WHERE {where} ORDER BY category, sku LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
        return {"items": [_item_payload(row) for row in rows], "total": total, "limit": limit, "offset": offset}
    finally:
        db.close()


def get_inventory_item(db_path: Path, item_id: str) -> dict:
    db = connect(db_path)
    try:
        row = db.execute("SELECT * FROM inventory_items WHERE id = ? AND is_active = 1", (item_id,)).fetchone()
        if not row:
            raise not_found("ITEM_NOT_FOUND", f"Inventory item {item_id!r} was not found")
        item = _item_payload(row)
        store = db.execute("SELECT * FROM stores WHERE id = ?", (row["store_id"],)).fetchone()
        item["store"] = {
            "id": store["id"], "code": store["code"], "name": store["name"], "location": store["location"]
        }
        recent = db.execute(
            """
            SELECT t.id, t.type, t.user_name, t.confirmed_at, ti.display_quantity,
                   ti.display_unit, ti.quantity_before, ti.quantity_after, ti.condition
            FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
            WHERE ti.inventory_item_id = ? AND t.status = 'confirmed'
            ORDER BY t.confirmed_at DESC LIMIT 10
            """,
            (item_id,),
        ).fetchall()
        item["recent_activity"] = [dict(event) for event in recent]
        return item
    finally:
        db.close()


def list_stores(db_path: Path) -> dict:
    db = connect(db_path)
    try:
        rows = db.execute(
            """
            SELECT s.*, COUNT(i.id) AS item_types, COALESCE(SUM(i.available_quantity), 0) AS available_quantity
            FROM stores s LEFT JOIN inventory_items i ON i.store_id = s.id AND i.is_active = 1
            WHERE s.is_active = 1 GROUP BY s.id ORDER BY s.code
            """
        ).fetchall()
        return {
            "stores": [
                {
                    "id": row["id"], "code": row["code"], "name": row["name"],
                    "location": row["location"], "status": row["connectivity"],
                    "item_types": row["item_types"], "available_quantity": row["available_quantity"],
                }
                for row in rows
            ]
        }
    finally:
        db.close()


def _mapped_item(db: sqlite3.Connection, class_key: str) -> sqlite3.Row | None:
    return db.execute(
        "SELECT id, sku, name, image_url FROM inventory_items WHERE ai_class_key = ? AND is_active = 1",
        (class_key,),
    ).fetchone()


def _match_payload(row: sqlite3.Row, confidence: float) -> dict:
    return {"item_id": row["id"], "sku": row["sku"], "name": row["name"], "confidence": round(confidence, 4)}


def _scan_response(db: sqlite3.Connection, scan_id: str) -> dict:
    scan = db.execute(
        "SELECT * FROM scan_sessions WHERE id = ?",
        (scan_id,),
    ).fetchone()

    if not scan:
        raise not_found(
            "SCAN_NOT_FOUND",
            f"Scan session {scan_id!r} was not found",
        )

    detections = db.execute(
        "SELECT * FROM detections WHERE scan_session_id = ? ORDER BY rowid",
        (scan_id,),
    ).fetchall()

    items = []
    scan_timing = None

    for detection in detections:
        item = None

        if detection["inventory_item_id"]:
            item_row = db.execute(
                "SELECT id, sku, name, image_url FROM inventory_items WHERE id = ?",
                (detection["inventory_item_id"],),
            ).fetchone()

            if item_row:
                item = dict(item_row)

        status = detection["status"]
        frontend_status = (
            "review_needed"
            if status in {"review", "unknown"}
            else status
        )

        bbox = json_value(detection["bbox"])
        raw_metadata = json_value(detection["raw_metadata"], {})

        individual_bboxes = []

        if isinstance(raw_metadata, dict):
            individual_bboxes = raw_metadata.get(
                "individual_bboxes",
                [],
            )
            scan_timing = scan_timing or raw_metadata.get("timing")

        if not individual_bboxes and bbox:
            individual_bboxes = [bbox]

        items.append(
            {
                "detection_id": detection["id"],
                "item": item,
                "quantity": detection["quantity"],
                "confidence": detection["confidence"],
                "status": frontend_status,
                "bbox": bbox,
                "bboxes": individual_bboxes,
                "possible_matches": json_value(
                    detection["possible_matches"],
                    [],
                ),
                "why": json_value(
                    detection["why"],
                    [],
                ),
                "ocr": raw_metadata.get("ocr", {
                    "detected_text": None,
                    "normalized_sku": None,
                    "catalog_match": False,
                    "verification_status": "not_available",
                    "conflict_with_yolo": False,
                    "review_required": False,
                    "candidates": [],
                    "invalid_candidates": [],
                    "attempts": [],
                    "engine": "disabled",
                    "processing_time_ms": 0.0,
                    "error": None,
                }) if isinstance(raw_metadata, dict) else None,
            }
        )

    review_lines = sum(
        1
        for item in items
        if item["status"] == "review_needed"
    )

    return {
        "scan_session_id": scan["id"],
        "client_scan_id": scan["client_scan_id"],
        "status": (
            "review_needed"
            if scan["status"] == "review"
            else scan["status"]
        ),
        "store_id": scan["store_id"],
        "detector_version": scan["detector_version"],
        "processing_time_ms": scan["processing_time_ms"],
        "timings": scan_timing,
        "expires_at": scan["expires_at"],
        "items": items,
        "summary": {
            "detected_quantity": sum(
                item["quantity"]
                for item in items
                if item["status"] != "rejected"
            ),
            "ready_lines": sum(
                1
                for item in items
                if item["status"] in {"ready", "resolved"}
            ),
            "review_lines": review_lines,
            "rejected_lines": sum(
                1
                for item in items
                if item["status"] == "rejected"
            ),
        },
    }

def create_scan(db_path: Path, settings: Settings, detector: Detector, request: ScanRequest, image: bytes | None) -> dict:
    start = time.perf_counter()
    try:
        raw = detector.detect(image, request.fixture)
    except Exception as exc:
        raise OrbitError(503, "DETECTOR_UNAVAILABLE", "The detector could not process this scan. Try again.") from exc
    elapsed_ms = max(1, round((time.perf_counter() - start) * 1000))
    scan_id = new_id("scan")
    now = datetime.now(timezone.utc)
    with transaction(db_path) as db:
        _store_row(db, request.store_id)
        if request.client_scan_id:
            existing = db.execute("SELECT id FROM scan_sessions WHERE client_scan_id = ?", (request.client_scan_id,)).fetchone()
            if existing:
                return _scan_response(db, existing["id"])
        normalized = []
        for result in raw:
            mapped = _mapped_item(db, result.class_key)
            if mapped and result.confidence >= settings.ready_threshold:
                status = "ready"
            elif result.confidence >= settings.review_threshold:
                status = "review"
            else:
                status = "unknown"
            metadata = result.metadata if isinstance(result.metadata, dict) else {}
            ocr = metadata.get("ocr", {}) if isinstance(metadata, dict) else {}
            ocr_status = ocr.get("verification_status") if isinstance(ocr, dict) else None
            reasons = list(result.why)
            if ocr_status in {"conflict", "ambiguous"}:
                status = "review"
                reasons.append(
                    "OCR found multiple catalog SKUs"
                    if ocr_status == "ambiguous"
                    else "OCR SKU conflicts with the visual prediction"
                )
            matches = []
            if status != "ready":
                if mapped:
                    matches.append(_match_payload(mapped, result.confidence))
                for class_key, confidence in result.alternatives:
                    alternative = _mapped_item(db, class_key)
                    if alternative:
                        matches.append(_match_payload(alternative, confidence))
                for candidate in ocr.get("candidates", []) if isinstance(ocr, dict) else []:
                    candidate_sku = candidate.get("sku") if isinstance(candidate, dict) else None
                    candidate_confidence = candidate.get("confidence", 0.0) if isinstance(candidate, dict) else 0.0
                    alternative = _mapped_item(db, candidate_sku) if candidate_sku else None
                    if alternative and all(match["item_id"] != alternative["id"] for match in matches):
                        matches.append(_match_payload(alternative, float(candidate_confidence)))
            normalized.append((result, mapped, status, matches, reasons))
        scan_status = "review" if any(entry[2] in {"review", "unknown"} for entry in normalized) else "ready"
        db.execute(
            """
            INSERT INTO scan_sessions (id, client_scan_id, mode, status, store_id, detector_version,
                processing_time_ms, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                scan_id, request.client_scan_id, request.mode, scan_status, request.store_id,
                detector.version, elapsed_ms, now.isoformat().replace("+00:00", "Z"),
                (now + timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
            ),
        )
        for result, mapped, status, matches, reasons in normalized:
            db.execute(
                """
                INSERT INTO detections (id, scan_session_id, predicted_class, inventory_item_id,
                    quantity, confidence, bbox, status, possible_matches, why, raw_metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("det"), scan_id, result.class_key, mapped["id"] if mapped else None,
                    result.quantity, result.confidence, json.dumps(result.bbox) if result.bbox else None,
                    status, json.dumps(matches), json.dumps(reasons), json.dumps(result.metadata),
                ),
            )
        response = _scan_response(db, scan_id)
        detector_timing = getattr(raw, "timing", None)
        if detector_timing:
            response["timings"] = detector_timing
        return response


def get_scan(db_path: Path, scan_id: str) -> dict:
    db = connect(db_path)
    try:
        return _scan_response(db, scan_id)
    finally:
        db.close()


def resolve_review(db_path: Path, scan_id: str, detection_id: str, request: ReviewRequest) -> dict:
    with transaction(db_path) as db:
        scan = db.execute("SELECT * FROM scan_sessions WHERE id = ?", (scan_id,)).fetchone()
        if not scan:
            raise not_found("SCAN_NOT_FOUND", f"Scan session {scan_id!r} was not found")
        if scan["status"] == "confirmed":
            raise conflict("SCAN_ALREADY_CONFIRMED", "This scan has already updated inventory")
        if scan["expires_at"] < utc_now():
            db.execute("UPDATE scan_sessions SET status = 'expired' WHERE id = ?", (scan_id,))
            raise OrbitError(410, "SCAN_EXPIRED", "This scan expired. Please scan the items again.")
        detection = db.execute(
            "SELECT * FROM detections WHERE id = ? AND scan_session_id = ?", (detection_id, scan_id)
        ).fetchone()
        if not detection:
            raise not_found("DETECTION_NOT_FOUND", f"Detection {detection_id!r} was not found in this scan")
        selected_id = request.selected_item_id
        if request.action == "confirm":
            selected_id = selected_id or detection["inventory_item_id"]
            if not selected_id:
                raise bad_request("INVALID_REQUEST", "Select an official inventory item before confirming")
        elif request.action == "choose_another" and not selected_id:
            raise bad_request("INVALID_REQUEST", "selected_item_id is required for choose_another")
        if selected_id:
            item = db.execute("SELECT id FROM inventory_items WHERE id = ? AND is_active = 1", (selected_id,)).fetchone()
            if not item:
                raise not_found("ITEM_NOT_FOUND", f"Inventory item {selected_id!r} was not found")
        new_status = "resolved" if request.action in {"confirm", "choose_another"} else "rejected"
        db.execute(
            "UPDATE detections SET inventory_item_id = ?, quantity = COALESCE(?, quantity), status = ? WHERE id = ?",
            (selected_id, request.quantity, new_status, detection_id),
        )
        db.execute(
            """
            INSERT INTO review_decisions (id, detection_id, selected_item_id, action, original_confidence,
                reason, reviewed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("review"), detection_id, selected_id, request.action, detection["confidence"],
                request.reason, request.reviewed_by, utc_now(),
            ),
        )
        unresolved = db.execute(
            "SELECT COUNT(*) FROM detections WHERE scan_session_id = ? AND status IN ('review','unknown')", (scan_id,)
        ).fetchone()[0]
        db.execute("UPDATE scan_sessions SET status = ? WHERE id = ?", ("review" if unresolved else "ready", scan_id))
        return _scan_response(db, scan_id)


def _existing_idempotent(db: sqlite3.Connection, client_id: str, payload_hash: str) -> dict | None:
    existing = db.execute(
        "SELECT payload_hash, response_snapshot FROM transactions WHERE client_transaction_id = ?",
        (client_id,),
    ).fetchone()
    if not existing:
        return None
    if existing["payload_hash"] != payload_hash:
        raise conflict(
            "IDEMPOTENCY_CONFLICT",
            "This client transaction ID was already used with a different payload",
            {"client_transaction_id": client_id},
        )
    response = json.loads(existing["response_snapshot"])
    response["idempotent_replay"] = True
    return response


def _inventory_row(db: sqlite3.Connection, item_id: str, store_id: str) -> sqlite3.Row:
    item = db.execute("SELECT * FROM inventory_items WHERE id = ? AND is_active = 1", (item_id,)).fetchone()
    if not item:
        raise not_found("ITEM_NOT_FOUND", f"Inventory item {item_id!r} was not found")
    if item["store_id"] != store_id:
        raise bad_request(
            "INVALID_REQUEST",
            f"Item {item['sku']} belongs to {item['store_id']}, not {store_id}",
            {"item_id": item_id, "expected_store_id": item["store_id"]},
        )
    return item


def _quantity_base(item: sqlite3.Row, quantity: int, unit: str) -> int:
    normalized = unit.strip().lower()
    if normalized == item["base_unit"]:
        return quantity
    if normalized != item["issue_unit"]:
        raise bad_request(
            "INVALID_UNIT",
            f"{item['sku']} is issued in {item['issue_unit']}",
            {"item_id": item["id"], "submitted_unit": normalized},
        )
    conversion = item["conversion_to_base"]
    if conversion is None:
        raise bad_request(
            "INVALID_UNIT",
            f"No approved {normalized}-to-{item['base_unit']} conversion exists for {item['sku']}",
        )
    return quantity * int(conversion)


def apply_checkout(db_path: Path, request: CheckoutRequest) -> dict:
    payload = request.model_dump(mode="json")
    payload_hash = canonical_hash(payload)
    with transaction(db_path) as db:
        replay = _existing_idempotent(db, request.client_transaction_id, payload_hash)
        if replay:
            return replay
        _store_row(db, request.store_id)
        item_ids = [line.item_id for line in request.items]
        if len(set(item_ids)) != len(item_ids):
            raise bad_request("INVALID_REQUEST", "Each inventory item may appear only once per transaction")
        validated = []
        for line in request.items:
            item = _inventory_row(db, line.item_id, request.store_id)
            quantity_base = _quantity_base(item, line.quantity, line.unit)
            if quantity_base > item["available_quantity"]:
                raise conflict(
                    "INSUFFICIENT_STOCK",
                    f"Only {item['available_quantity']} {item['base_unit']} of {item['name']} are available",
                    {"item_id": item["id"], "available_quantity": item["available_quantity"]},
                )
            validated.append((line, item, quantity_base))
        tx_id = new_id("tx")
        now = utc_now()
        db.execute(
            """
            INSERT INTO transactions (id, client_transaction_id, payload_hash, type, status, store_id,
                user_name, notes, created_at, confirmed_at)
            VALUES (?, ?, ?, 'checkout', 'pending', ?, ?, ?, ?, ?)
            """,
            (tx_id, request.client_transaction_id, payload_hash, request.store_id, request.user_name, request.notes, now, now),
        )
        changes = []
        for line, item, quantity_base in validated:
            before = int(item["available_quantity"])
            after = before - quantity_base
            db.execute(
                "UPDATE inventory_items SET available_quantity = ?, updated_at = ? WHERE id = ?",
                (after, now, item["id"]),
            )
            db.execute(
                """
                INSERT INTO transaction_items (id, transaction_id, inventory_item_id, quantity_base,
                    display_quantity, display_unit, quantity_before, quantity_after)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id("line"), tx_id, item["id"], quantity_base, line.quantity, line.unit.lower(), before, after),
            )
            changes.append(
                {"item_id": item["id"], "name": item["name"], "quantity_checked_out": quantity_base,
                 "quantity_before": before, "quantity_after": after}
            )
        response = {
            "transaction_id": tx_id,
            "client_transaction_id": request.client_transaction_id,
            "status": "confirmed",
            "type": "checkout",
            "total_items_checked_out": sum(change["quantity_checked_out"] for change in changes),
            "completed_at": now,
            "changes": changes,
            "idempotent_replay": False,
        }
        db.execute(
            "UPDATE transactions SET status = 'confirmed', response_snapshot = ? WHERE id = ?",
            (json.dumps(response), tx_id),
        )
        db.execute(
            """
            INSERT INTO activity_events (id, event_type, entity_type, entity_id, store_id, user_name,
                summary, details, created_at) VALUES (?, 'checkout', 'transaction', ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("event"), tx_id, request.store_id, request.user_name,
                f"Checked out {response['total_items_checked_out']} item(s)", json.dumps(changes), now,
            ),
        )
        return response


def apply_return(db_path: Path, request: ReturnRequest) -> dict:
    payload = request.model_dump(mode="json")
    payload_hash = canonical_hash(payload)
    with transaction(db_path) as db:
        replay = _existing_idempotent(db, request.client_transaction_id, payload_hash)
        if replay:
            return replay
        _store_row(db, request.store_id)
        scan = db.execute("SELECT * FROM scan_sessions WHERE id = ?", (request.scan_session_id,)).fetchone()
        if not scan:
            raise not_found("SCAN_NOT_FOUND", f"Scan session {request.scan_session_id!r} was not found")
        if scan["store_id"] != request.store_id:
            raise bad_request("INVALID_REQUEST", "Scan and transaction store do not match")
        if scan["confirmed_transaction_id"] or scan["status"] == "confirmed":
            raise conflict("SCAN_ALREADY_CONFIRMED", "This scan has already updated inventory")
        if scan["expires_at"] < utc_now():
            db.execute("UPDATE scan_sessions SET status = 'expired' WHERE id = ?", (request.scan_session_id,))
            raise OrbitError(410, "SCAN_EXPIRED", "This scan expired. Please scan the items again.")
        if scan["status"] != "ready":
            raise conflict("REVIEW_REQUIRED", "Resolve every uncertain detection before confirming the return")
        detections = {
            row["id"]: row
            for row in db.execute(
                "SELECT * FROM detections WHERE scan_session_id = ? AND status != 'rejected'",
                (request.scan_session_id,),
            ).fetchall()
        }
        submitted_ids = [line.detection_id for line in request.items]
        if len(set(submitted_ids)) != len(submitted_ids) or set(submitted_ids) != set(detections):
            raise bad_request("INVALID_REQUEST", "Return lines must match every included scan detection exactly once")
        validated = []
        for line in request.items:
            detection = detections[line.detection_id]
            if detection["status"] not in {"ready", "resolved"}:
                raise conflict("REVIEW_REQUIRED", "A submitted detection still needs review")
            if line.item_id != detection["inventory_item_id"]:
                raise OrbitError(422, "UNMAPPED_DETECTION", "Submitted item does not match the approved detection")
            if line.quantity != detection["quantity"]:
                raise bad_request("INVALID_QUANTITY", "Return quantity must match the reviewed scan quantity")
            item = _inventory_row(db, line.item_id, request.store_id)
            quantity_base = _quantity_base(item, line.quantity, line.unit)
            if line.condition == "good" and item["available_quantity"] + quantity_base > item["total_quantity"]:
                raise conflict(
                    "RETURN_EXCEEDS_TOTAL",
                    f"Returning {quantity_base} would exceed the recorded total for {item['name']}",
                    {"item_id": item["id"], "total_quantity": item["total_quantity"]},
                )
            validated.append((line, item, quantity_base))
        tx_id = new_id("tx")
        now = utc_now()
        db.execute(
            """
            INSERT INTO transactions (id, client_transaction_id, payload_hash, type, status, store_id,
                user_name, scan_session_id, created_at, confirmed_at)
            VALUES (?, ?, ?, 'return', 'pending', ?, ?, ?, ?, ?)
            """,
            (tx_id, request.client_transaction_id, payload_hash, request.store_id, request.user_name, request.scan_session_id, now, now),
        )
        changes = []
        for line, item, quantity_base in validated:
            before = int(item["available_quantity"])
            added = quantity_base if line.condition == "good" else 0
            after = before + added
            db.execute("UPDATE inventory_items SET available_quantity = ?, updated_at = ? WHERE id = ?", (after, now, item["id"]))
            db.execute(
                """
                INSERT INTO transaction_items (id, transaction_id, inventory_item_id, quantity_base,
                    display_quantity, display_unit, condition, quantity_before, quantity_after)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id("line"), tx_id, item["id"], quantity_base, line.quantity, line.unit.lower(), line.condition, before, after),
            )
            changes.append(
                {"item_id": item["id"], "name": item["name"], "quantity_returned": quantity_base,
                 "quantity_added_to_available": added, "condition": line.condition,
                 "quantity_before": before, "quantity_after": after}
            )
        manual_reviews = db.execute(
            """
            SELECT COUNT(*) FROM review_decisions r JOIN detections d ON d.id = r.detection_id
            WHERE d.scan_session_id = ? AND r.action IN ('confirm','choose_another')
            """,
            (request.scan_session_id,),
        ).fetchone()[0]
        response = {
            "transaction_id": tx_id,
            "client_transaction_id": request.client_transaction_id,
            "status": "confirmed",
            "type": "return",
            "total_items_returned": sum(change["quantity_returned"] for change in changes),
            "review_result": f"{manual_reviews} item(s) manually confirmed",
            "completed_at": now,
            "changes": changes,
            "idempotent_replay": False,
        }
        db.execute("UPDATE transactions SET status = 'confirmed', response_snapshot = ? WHERE id = ?", (json.dumps(response), tx_id))
        db.execute(
            "UPDATE scan_sessions SET status = 'confirmed', confirmed_transaction_id = ? WHERE id = ?",
            (tx_id, request.scan_session_id),
        )
        db.execute(
            """
            INSERT INTO activity_events (id, event_type, entity_type, entity_id, store_id, user_name,
                summary, details, created_at) VALUES (?, 'return', 'transaction', ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("event"), tx_id, request.store_id, request.user_name,
                f"Returned {response['total_items_returned']} item(s)", json.dumps(changes), now,
            ),
        )
        return response


def list_activity(
    db_path: Path,
    *,
    event_type: str | None = None,
    item_id: str | None = None,
    store_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    clauses = ["1 = 1"]
    params: list = []
    for column, value in (("event_type", event_type), ("item_id", item_id), ("store_id", store_id)):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value)
    where = " AND ".join(clauses)
    db = connect(db_path)
    try:
        total = db.execute(f"SELECT COUNT(*) FROM activity_events WHERE {where}", params).fetchone()[0]
        rows = db.execute(
            f"SELECT * FROM activity_events WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
        return {
            "events": [{**dict(row), "details": json_value(row["details"], [])} for row in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    finally:
        db.close()


def record_sync_attempt(
    db_path: Path,
    device_id: str,
    client_id: str,
    payload_hash: str,
    status: str,
    response: dict,
) -> None:
    with transaction(db_path) as db:
        db.execute(
            """
            INSERT INTO sync_attempts (id, device_id, client_transaction_id, payload_hash, status,
                response_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id("sync"), device_id, client_id, payload_hash, status, json.dumps(response), utc_now()),
        )
