from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.detectors.base import RawDetection
from app.main import create_app
from app.ocr.engine import OcrText
from app.ocr.service import OcrService, extract_sku_candidates, normalize_sku


CATALOG = {"T003", "T005", "L003", "E018", "E019", "C024", "S002"}
FRAME = Image.new("RGB", (800, 600), "white")
BOX = [(100.0, 100.0, 500.0, 400.0)]


class FakeEngine:
    version = "fake-ocr:test"

    def __init__(self, outputs: list[OcrText] | Exception):
        self.outputs = outputs

    def read(self, image: Image.Image) -> list[OcrText]:
        if isinstance(self.outputs, Exception):
            raise self.outputs
        return self.outputs


class SlowEngine:
    version = "fake-ocr:slow"

    def read(self, image: Image.Image) -> list[OcrText]:
        time.sleep(0.1)
        return [OcrText("T003", 0.99)]


def verify(yolo_sku: str, outputs: list[OcrText] | Exception, boxes=BOX) -> dict:
    return OcrService(CATALOG, FakeEngine(outputs)).verify(FRAME, yolo_sku, boxes)


def test_sku_normalization_uses_catalog_after_regex_extraction():
    assert normalize_sku(" e-018 ") == "E018"
    assert extract_sku_candidates("SKU: E 018 / batch Z-999") == ["E018", "Z999"]


def test_ocr_match_conflict_missing_invalid_ambiguous_and_failure():
    matched = verify("E018", [OcrText("E 018", 0.98)])
    assert matched["verification_status"] == "verified"
    assert matched["normalized_sku"] == "E018"
    assert matched["catalog_match"] is True
    assert matched["review_required"] is False

    conflict = verify("E018", [OcrText("E-019", 0.94)])
    assert conflict["verification_status"] == "conflict"
    assert conflict["conflict_with_yolo"] is True
    assert conflict["review_required"] is True

    missing = verify("T003", [])
    assert missing["verification_status"] == "not_available"
    assert missing["error"] is None

    invalid = verify("T003", [OcrText("Z999", 0.99)])
    assert invalid["verification_status"] == "invalid"
    assert invalid["catalog_match"] is False
    assert invalid["invalid_candidates"] == ["Z999"]

    ambiguous = verify("E018", [OcrText("E018 E019", 0.96)])
    assert ambiguous["verification_status"] == "ambiguous"
    assert {candidate["sku"] for candidate in ambiguous["candidates"]} == {"E018", "E019"}
    assert ambiguous["review_required"] is True

    failed = verify("T003", RuntimeError("synthetic OCR failure"))
    assert failed["verification_status"] == "error"
    assert failed["error"] == "OCR_ENGINE_ERROR"

    timed_out = OcrService(CATALOG, SlowEngine(), timeout_seconds=0.01).verify(FRAME, "T003", BOX)
    assert timed_out["verification_status"] == "error"
    assert timed_out["error"] == "OCR_ENGINE_TIMEOUT"


@dataclass
class StaticDetector:
    detection: RawDetection
    version: str = "static-yolo:test"

    @property
    def ocr_health(self) -> dict:
        return {"enabled": True, "available": True, "engine": "fake-ocr:test", "error": None}

    def detect(self, image: bytes | None, fixture: str = "mixed") -> list[RawDetection]:
        return [self.detection]


def api_client(tmp_path: Path, detection: RawDetection) -> TestClient:
    settings = Settings(
        database_path=tmp_path / "ocr-test.db",
        detector_mode="real",
        ready_threshold=0.85,
        review_threshold=0.60,
        max_image_bytes=1024,
        cors_origins=("http://localhost:3000",),
        model_weights="synthetic-test.pt",
    )
    return TestClient(create_app(settings, StaticDetector(detection)))


def scan_with(tmp_path: Path, detection: RawDetection) -> dict:
    with api_client(tmp_path, detection) as client:
        response = client.post("/api/scans", json={"store_id": "store-1"})
        assert response.status_code == 200, response.text
        return response.json()


def test_ocr_conflict_forces_review_and_offers_catalog_candidate(tmp_path):
    ocr = verify("E018", [OcrText("E019", 0.93)])
    scan = scan_with(
        tmp_path,
        RawDetection("E018", 0.96, metadata={"ocr": ocr}),
    )
    assert scan["status"] == "review_needed"
    assert scan["items"][0]["ocr"]["verification_status"] == "conflict"
    assert {item["sku"] for item in scan["items"][0]["possible_matches"]} == {"E018", "E019"}


def test_ocr_preserves_two_instances_and_low_confidence_review(tmp_path):
    verified = verify(
        "T003",
        [OcrText("T003", 0.98)],
        boxes=[(20, 20, 300, 300), (400, 100, 760, 500)],
    )
    bboxes = [
        {"x": 0.02, "y": 0.03, "w": 0.35, "h": 0.45},
        {"x": 0.50, "y": 0.17, "w": 0.45, "h": 0.66},
    ]
    scan = scan_with(
        tmp_path,
        RawDetection(
            "T003",
            0.96,
            quantity=2,
            bbox=bboxes[0],
            metadata={"ocr": verified, "individual_bboxes": bboxes},
        ),
    )
    assert scan["status"] == "ready"
    assert scan["items"][0]["quantity"] == 2
    assert len(scan["items"][0]["bboxes"]) == 2

    low_confidence = scan_with(
        tmp_path / "low",
        RawDetection("E018", 0.78, metadata={"ocr": verify("E018", [OcrText("E018", 0.99)])}),
    )
    assert low_confidence["items"][0]["ocr"]["verification_status"] == "verified"
    assert low_confidence["status"] == "review_needed"


def test_ocr_failure_does_not_block_high_confidence_yolo(tmp_path):
    failed = verify("T003", RuntimeError("synthetic OCR failure"))
    scan = scan_with(tmp_path, RawDetection("T003", 0.95, metadata={"ocr": failed}))
    assert scan["status"] == "ready"
    assert scan["items"][0]["ocr"]["verification_status"] == "error"
