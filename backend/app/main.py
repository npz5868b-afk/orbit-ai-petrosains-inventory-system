from __future__ import annotations

import logging
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import Settings, get_settings
from .database import connect
from .detectors import build_detector
from .domain import (
    apply_checkout,
    apply_return,
    canonical_hash,
    create_scan,
    get_inventory_item,
    get_scan,
    list_activity,
    list_inventory,
    list_stores,
    record_sync_attempt,
    resolve_review,
)
from .errors import OrbitError, orbit_error_handler
from .schemas import CheckoutRequest, ReturnRequest, ReviewRequest, ScanRequest, SyncRequest
from .seed import seed_database


logger = logging.getLogger("orbit.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_app(settings: Settings | None = None, detector=None) -> FastAPI:
    settings = settings or get_settings()
    detector_error: str | None = None
    if detector is None:
        try:
            detector = build_detector(settings)
        except Exception as exc:  # model load must not hide database/read APIs
            detector_error = str(exc)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        seed_database(settings.database_path)
        yield

    app = FastAPI(
        title="ORBIT AI Inventory API",
        description="Offline-safe inventory transactions and model-agnostic scan review for Petrosains.",
        version=__version__,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.detector = detector
    app.state.detector_error = detector_error
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Trace-ID"],
    )

    @app.middleware("http")
    async def trace_requests(request: Request, call_next):
        trace_id = request.headers.get("X-Trace-ID") or uuid.uuid4().hex
        request.state.trace_id = trace_id
        started = datetime.now(timezone.utc)
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        elapsed = (datetime.now(timezone.utc) - started).total_seconds() * 1000
        logger.info("trace_id=%s method=%s path=%s status=%s elapsed_ms=%.1f", trace_id, request.method, request.url.path, response.status_code, elapsed)
        return response

    app.add_exception_handler(OrbitError, orbit_error_handler)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = [
            {"type": error.get("type"), "location": list(error.get("loc", ())), "message": error.get("msg")}
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "The request payload is invalid",
                    "details": {"fields": fields},
                    "trace_id": getattr(request.state, "trace_id", None),
                }
            },
        )

    @app.exception_handler(sqlite3.Error)
    async def database_error(request: Request, exc: sqlite3.Error):
        logger.exception("trace_id=%s database error", getattr(request.state, "trace_id", None))
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "DATABASE_ERROR", "message": "The operation was rolled back safely", "details": None, "trace_id": getattr(request.state, "trace_id", None)}},
        )

    @app.get("/api/health")
    def health():
        database = "connected"
        try:
            db = connect(settings.database_path)
            db.execute("SELECT 1").fetchone()
            db.close()
        except sqlite3.Error:
            database = "unavailable"
        return {
            "status": "ok" if database == "connected" else "degraded",
            "database": database,
            "detector": getattr(detector, "version", "unavailable"),
            "detector_error": detector_error,
            "ocr": getattr(
                detector,
                "ocr_health",
                {"enabled": False, "available": False, "engine": "unavailable", "error": None},
            ),
            "version": __version__,
            "timestamp": _utc_now(),
        }

    @app.get("/api/inventory")
    def inventory_list(
        store_id: str | None = None,
        search: str | None = None,
        category: str | None = None,
        item_type: str | None = None,
        attention_only: bool = False,
        limit: int = Query(50, ge=1, le=250),
        offset: int = Query(0, ge=0),
    ):
        if item_type and item_type not in {"reusable", "consumable"}:
            raise OrbitError(400, "INVALID_REQUEST", "item_type must be reusable or consumable")
        return list_inventory(
            settings.database_path,
            store_id=store_id,
            search=search,
            category=category,
            item_type=item_type,
            attention_only=attention_only,
            limit=limit,
            offset=offset,
        )

    @app.get("/api/inventory/{item_id}")
    def inventory_detail(item_id: str):
        return get_inventory_item(settings.database_path, item_id)

    @app.get("/api/stores")
    def stores_list():
        return list_stores(settings.database_path)

    @app.post("/api/scans")
    async def scans_create(request: Request):
        content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
        image: bytes | None = None
        if content_type == "application/json" or not content_type:
            payload = await request.json() if content_type else {}
        elif content_type == "multipart/form-data":
            form = await request.form()
            upload = form.get("image")
            if upload is None or not hasattr(upload, "read"):
                raise OrbitError(400, "INVALID_REQUEST", "Multipart scans require an image field")
            image_type = (getattr(upload, "content_type", None) or "").lower()
            if image_type not in {"image/jpeg", "image/png"}:
                raise OrbitError(415, "UNSUPPORTED_IMAGE_TYPE", "Only JPEG and PNG scan images are supported")
            image = await upload.read(settings.max_image_bytes + 1)
            payload = {
                "mode": form.get("mode", "bulk_return"),
                "store_id": form.get("store_id", "store-1"),
                "client_scan_id": form.get("client_scan_id"),
                "fixture": form.get("fixture", "mixed"),
            }
        elif content_type in {"image/jpeg", "image/png"}:
            image = await request.body()
            payload = {
                "mode": request.query_params.get("mode", "bulk_return"),
                "store_id": request.query_params.get("store_id", "store-1"),
                "client_scan_id": request.query_params.get("client_scan_id"),
                "fixture": request.query_params.get("fixture", "mixed"),
            }
        else:
            raise OrbitError(415, "UNSUPPORTED_IMAGE_TYPE", "Use JSON, multipart JPEG/PNG, or a raw JPEG/PNG body")
        if image is not None:
            if len(image) > settings.max_image_bytes:
                raise OrbitError(413, "IMAGE_TOO_LARGE", f"Scan image exceeds {settings.max_image_bytes} bytes")
            if not image:
                raise OrbitError(400, "INVALID_REQUEST", "The scan image is empty")
        if app.state.detector is None:
            raise OrbitError(503, "DETECTOR_UNAVAILABLE", "The detector is not available. Check backend configuration.")
        try:
            scan_request = ScanRequest.model_validate(payload)
        except Exception as exc:
            raise OrbitError(400, "INVALID_REQUEST", "The scan request is invalid", {"reason": str(exc)}) from exc
        return create_scan(settings.database_path, settings, app.state.detector, scan_request, image)

    @app.get("/api/scans/{scan_session_id}")
    def scans_get(scan_session_id: str):
        return get_scan(settings.database_path, scan_session_id)

    @app.post("/api/scans/{scan_session_id}/reviews/{detection_id}")
    def scans_review(scan_session_id: str, detection_id: str, payload: ReviewRequest):
        return resolve_review(settings.database_path, scan_session_id, detection_id, payload)

    @app.post("/api/transactions/checkout")
    def checkout(payload: CheckoutRequest):
        return apply_checkout(settings.database_path, payload)

    @app.post("/api/transactions/returns")
    def returns(payload: ReturnRequest):
        return apply_return(settings.database_path, payload)

    @app.get("/api/activity")
    def activity_list(
        event_type: str | None = None,
        item_id: str | None = None,
        store_id: str | None = None,
        limit: int = Query(50, ge=1, le=250),
        offset: int = Query(0, ge=0),
    ):
        return list_activity(
            settings.database_path,
            event_type=event_type,
            item_id=item_id,
            store_id=store_id,
            limit=limit,
            offset=offset,
        )

    @app.post("/api/sync")
    def sync(payload: SyncRequest):
        results = []
        for operation in payload.operations:
            operation_payload = dict(operation.payload)
            operation_payload["client_transaction_id"] = operation.client_transaction_id
            digest = canonical_hash(operation_payload)
            try:
                if operation.type == "checkout":
                    response = apply_checkout(settings.database_path, CheckoutRequest.model_validate(operation_payload))
                else:
                    response = apply_return(settings.database_path, ReturnRequest.model_validate(operation_payload))
                status = "duplicate" if response.get("idempotent_replay") else "applied"
                result = {
                    "client_transaction_id": operation.client_transaction_id,
                    "status": status,
                    "transaction_id": response["transaction_id"],
                    "message": "Original result replayed" if status == "duplicate" else "Inventory updated",
                    "response": response,
                }
            except OrbitError as exc:
                status = "conflict" if exc.code == "IDEMPOTENCY_CONFLICT" else "failed"
                result = {
                    "client_transaction_id": operation.client_transaction_id,
                    "status": status,
                    "transaction_id": None,
                    "message": exc.message,
                    "error_code": exc.code,
                }
            except Exception:
                status = "failed"
                result = {
                    "client_transaction_id": operation.client_transaction_id,
                    "status": status,
                    "transaction_id": None,
                    "message": "Operation payload is invalid",
                    "error_code": "INVALID_REQUEST",
                }
            record_sync_attempt(settings.database_path, payload.device_id, operation.client_transaction_id, digest, status, result)
            results.append(result)
        return {"results": results, "server_time": _utc_now()}

    return app


app = create_app()
