from __future__ import annotations

import sqlite3
from concurrent.futures import ThreadPoolExecutor

from conftest import ready_mixed_scan, return_payload, start_scan


def test_health_official_catalog_and_stores(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["database"] == "connected"
    assert health.json()["detector"] == "mock-v1"

    inventory = client.get("/api/inventory?limit=250").json()
    assert inventory["total"] == 109
    assert len({item["category"] for item in inventory["items"]}) == 5
    assert {item["display_unit"] for item in inventory["items"]} == {"unit", "pack", "box"}

    stores = client.get("/api/stores").json()["stores"]
    assert len(stores) == 4
    assert [store["status"] for store in stores] == ["online", "online", "offline", "offline"]


def test_inventory_search_filter_detail_and_not_found(client):
    response = client.get("/api/inventory?search=Arduino&category=Electronics%20%26%20Robotics&limit=250")
    assert response.status_code == 200
    assert {item["sku"] for item in response.json()["items"]} >= {"E001", "E002"}
    detail = client.get("/api/inventory/item-e001")
    assert detail.status_code == 200
    assert detail.json()["store_id"] == "store-4"
    missing = client.get("/api/inventory/item-does-not-exist")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_checkout_is_atomic_and_idempotent(client):
    payload = {
        "client_transaction_id": "checkout-client-001",
        "store_id": "store-1",
        "user_name": "Team Robotics",
        "items": [{"item_id": "item-e014", "quantity": 2, "unit": "unit"}],
        "notes": None,
    }
    before = client.get("/api/inventory/item-e014").json()["available_quantity"]
    first = client.post("/api/transactions/checkout", json=payload)
    assert first.status_code == 200
    assert first.json()["changes"][0]["quantity_after"] == before - 2
    replay = client.post("/api/transactions/checkout", json=payload)
    assert replay.status_code == 200
    assert replay.json()["idempotent_replay"] is True
    assert client.get("/api/inventory/item-e014").json()["available_quantity"] == before - 2

    changed = {**payload, "items": [{"item_id": "item-e014", "quantity": 3, "unit": "unit"}]}
    conflict = client.post("/api/transactions/checkout", json=changed)
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


def test_checkout_failure_rolls_back_every_line(client):
    before = client.get("/api/inventory/item-e014").json()["available_quantity"]
    response = client.post(
        "/api/transactions/checkout",
        json={
            "client_transaction_id": "checkout-rollback-001",
            "store_id": "store-1",
            "items": [
                {"item_id": "item-e014", "quantity": 2, "unit": "unit"},
                {"item_id": "item-t015", "quantity": 9999, "unit": "unit"},
            ],
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INSUFFICIENT_STOCK"
    assert client.get("/api/inventory/item-e014").json()["available_quantity"] == before


def test_mock_scan_review_and_exactly_once_return(client):
    scan = start_scan(client)
    assert scan["status"] == "review_needed"
    assert scan["summary"] == {"detected_quantity": 7, "ready_lines": 3, "review_lines": 1, "rejected_lines": 0}

    blocked = client.post("/api/transactions/returns", json=return_payload(scan))
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "REVIEW_REQUIRED"

    ready = ready_mixed_scan(client)
    payload = return_payload(ready, "return-client-002")
    before = {line["item_id"]: client.get(f"/api/inventory/{line['item_id']}").json()["available_quantity"] for line in payload["items"]}
    first = client.post("/api/transactions/returns", json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["total_items_returned"] == 7
    replay = client.post("/api/transactions/returns", json=payload)
    assert replay.status_code == 200
    assert replay.json()["idempotent_replay"] is True
    for change in first.json()["changes"]:
        current = client.get(f"/api/inventory/{change['item_id']}").json()["available_quantity"]
        assert current == before[change["item_id"]] + change["quantity_added_to_available"]

    new_id_same_scan = {**payload, "client_transaction_id": "return-client-003"}
    duplicate_scan = client.post("/api/transactions/returns", json=new_id_same_scan)
    assert duplicate_scan.status_code == 409
    assert duplicate_scan.json()["error"]["code"] == "SCAN_ALREADY_CONFIRMED"
    activity = client.get("/api/activity?event_type=return").json()
    assert activity["total"] == 1


def test_unknown_can_be_rejected_and_empty_scan_is_safe(client):
    unknown = start_scan(client, "unknown")
    detection = unknown["items"][0]
    assert detection["item"] is None
    assert detection["status"] == "review_needed"
    rejected = client.post(
        f"/api/scans/{unknown['scan_session_id']}/reviews/{detection['detection_id']}",
        json={"action": "reject", "reason": "Not an inventory item"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "ready"
    assert rejected.json()["summary"]["detected_quantity"] == 0

    empty = start_scan(client, "empty")
    assert empty["status"] == "ready"
    assert empty["summary"]["detected_quantity"] == 0


def test_detector_and_upload_failures_do_not_change_inventory(client):
    before = client.get("/api/inventory/item-t003").json()["available_quantity"]
    unavailable = client.post("/api/scans", json={"store_id": "store-1", "fixture": "unavailable"})
    assert unavailable.status_code == 503
    assert unavailable.json()["error"]["code"] == "DETECTOR_UNAVAILABLE"
    unsupported = client.post("/api/scans", content=b"image", headers={"content-type": "image/gif"})
    assert unsupported.status_code == 415
    too_large = client.post("/api/scans?store_id=store-1", content=b"x" * 1025, headers={"content-type": "image/jpeg"})
    assert too_large.status_code == 413
    assert client.get("/api/inventory/item-t003").json()["available_quantity"] == before


def test_offline_sync_applied_duplicate_and_conflict(client):
    base_payload = {
        "store_id": "store-1",
        "user_name": "Offline Tablet",
        "items": [{"item_id": "item-e014", "quantity": 1, "unit": "unit"}],
        "notes": "Queued offline",
    }
    operation = {
        "client_transaction_id": "offline-checkout-001",
        "type": "checkout",
        "created_offline_at": "2026-09-10T12:04:00Z",
        "payload": base_payload,
    }
    first = client.post("/api/sync", json={"device_id": "tablet-01", "operations": [operation]})
    assert first.status_code == 200
    assert first.json()["results"][0]["status"] == "applied"
    duplicate = client.post("/api/sync", json={"device_id": "tablet-01", "operations": [operation]})
    assert duplicate.json()["results"][0]["status"] == "duplicate"
    changed = {**operation, "payload": {**base_payload, "items": [{"item_id": "item-e014", "quantity": 2, "unit": "unit"}]}}
    conflict = client.post("/api/sync", json={"device_id": "tablet-01", "operations": [changed]})
    assert conflict.json()["results"][0]["status"] == "conflict"
    assert conflict.json()["results"][0]["error_code"] == "IDEMPOTENCY_CONFLICT"


def test_trace_id_and_standard_validation_error(client):
    response = client.post("/api/transactions/checkout", json={"bad": "payload"}, headers={"X-Trace-ID": "test-trace"})
    assert response.status_code == 400
    assert response.headers["X-Trace-ID"] == "test-trace"
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_concurrent_retry_updates_stock_once(client):
    payload = {
        "client_transaction_id": "concurrent-checkout-001",
        "store_id": "store-1",
        "user_name": "Double Click",
        "items": [{"item_id": "item-e014", "quantity": 1, "unit": "unit"}],
        "notes": None,
    }
    before = client.get("/api/inventory/item-e014").json()["available_quantity"]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: client.post("/api/transactions/checkout", json=payload), range(2)))
    assert [response.status_code for response in responses] == [200, 200]
    assert sorted(response.json()["idempotent_replay"] for response in responses) == [False, True]
    assert client.get("/api/inventory/item-e014").json()["available_quantity"] == before - 1


def test_expired_scan_cannot_change_inventory(client, db_path):
    scan = ready_mixed_scan(client)
    with sqlite3.connect(db_path) as db:
        db.execute("UPDATE scan_sessions SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?", (scan["scan_session_id"],))
    before = client.get("/api/inventory/item-t003").json()["available_quantity"]
    response = client.post("/api/transactions/returns", json=return_payload(scan, "expired-return-001"))
    assert response.status_code == 410
    assert response.json()["error"]["code"] == "SCAN_EXPIRED"
    assert client.get("/api/inventory/item-t003").json()["available_quantity"] == before


def test_invalid_unit_and_store_mismatch_are_rejected(client):
    invalid_unit = client.post(
        "/api/transactions/checkout",
        json={
            "client_transaction_id": "invalid-unit-001",
            "store_id": "store-1",
            "items": [{"item_id": "item-t003", "quantity": 1, "unit": "crate"}],
        },
    )
    assert invalid_unit.status_code == 400
    assert invalid_unit.json()["error"]["code"] == "INVALID_UNIT"
    wrong_store = client.post(
        "/api/transactions/checkout",
        json={
            "client_transaction_id": "wrong-store-001",
            "store_id": "store-1",
            "items": [{"item_id": "item-e001", "quantity": 1, "unit": "unit"}],
        },
    )
    assert wrong_store.status_code == 400
    assert wrong_store.json()["error"]["code"] == "INVALID_REQUEST"


def test_database_lock_returns_safe_error_and_no_change(client, db_path):
    before = client.get("/api/inventory/item-e014").json()["available_quantity"]
    lock = sqlite3.connect(db_path, isolation_level=None)
    lock.execute("PRAGMA journal_mode = WAL")
    lock.execute("BEGIN IMMEDIATE")
    try:
        response = client.post(
            "/api/transactions/checkout",
            json={
                "client_transaction_id": "locked-database-001",
                "store_id": "store-1",
                "items": [{"item_id": "item-e014", "quantity": 1, "unit": "unit"}],
            },
        )
    finally:
        lock.rollback()
        lock.close()
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "DATABASE_ERROR"
    assert client.get("/api/inventory/item-e014").json()["available_quantity"] == before
