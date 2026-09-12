from __future__ import annotations

from ..config import BACKEND_DIR, Settings
from ..ocr import build_ocr_service
from .mock import MockDetector
from .real import RealDetector


def build_detector(settings: Settings):
    if settings.detector_mode == "real":
        ocr = build_ocr_service(
            BACKEND_DIR / "data" / "inventory_catalog.json",
            enabled=settings.ocr_enabled,
            min_confidence=settings.ocr_min_confidence,
            crop_padding=settings.ocr_crop_padding,
            timeout_seconds=settings.ocr_timeout_seconds,
        )
        return RealDetector(settings.model_weights or "", ocr_service=ocr)
    return MockDetector()
