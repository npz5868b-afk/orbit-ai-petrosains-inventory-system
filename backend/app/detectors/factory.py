from __future__ import annotations

from ..config import Settings
from .mock import MockDetector
from .real import RealDetector


def build_detector(settings: Settings):
    if settings.detector_mode == "real":
        return RealDetector(settings.model_weights or "")
    return MockDetector()
