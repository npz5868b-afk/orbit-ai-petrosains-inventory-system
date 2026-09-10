from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.config import Settings  # noqa: E402
from app.detectors.mock import MockDetector  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "orbit-test.db"


@pytest.fixture
def client(db_path: Path):
    settings = Settings(
        database_path=db_path,
        detector_mode="mock",
        ready_threshold=0.85,
        review_threshold=0.60,
        max_image_bytes=1024,
        cors_origins=("http://localhost:3000",),
        model_weights=None,
    )
    app = create_app(settings, MockDetector())
    with TestClient(app) as test_client:
        yield test_client


def start_scan(client: TestClient, fixture: str = "mixed") -> dict:
    response = client.post(
        "/api/scans",
        json={"mode": "bulk_return", "store_id": "store-1", "fixture": fixture},
    )
    assert response.status_code == 200, response.text
    return response.json()


def ready_mixed_scan(client: TestClient) -> dict:
    scan = start_scan(client)
    review = next(item for item in scan["items"] if item["status"] == "review_needed")
    response = client.post(
        f"/api/scans/{scan['scan_session_id']}/reviews/{review['detection_id']}",
        json={"action": "confirm", "selected_item_id": "item-e018", "quantity": 1, "reason": "Red LED confirmed"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def return_payload(scan: dict, client_id: str = "return-client-001") -> dict:
    return {
        "client_transaction_id": client_id,
        "scan_session_id": scan["scan_session_id"],
        "store_id": "store-1",
        "user_name": "Demo User",
        "items": [
            {
                "detection_id": item["detection_id"],
                "item_id": item["item"]["id"],
                "quantity": item["quantity"],
                "unit": "unit",
                "condition": "good",
            }
            for item in scan["items"]
            if item["status"] != "rejected"
        ],
    }
