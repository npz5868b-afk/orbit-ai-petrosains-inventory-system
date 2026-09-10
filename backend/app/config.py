from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _float_env(name: str, default: float) -> float:
    value = float(os.getenv(name, default))
    if not 0 <= value <= 1:
        raise ValueError(f"{name} must be between 0 and 1")
    return value


@dataclass(frozen=True)
class Settings:
    database_path: Path
    detector_mode: str
    ready_threshold: float
    review_threshold: float
    max_image_bytes: int
    cors_origins: tuple[str, ...]
    model_weights: str | None


def get_settings() -> Settings:
    database_path = Path(os.getenv("ORBIT_DB_PATH", str(BACKEND_DIR / "data" / "orbit.db")))
    if not database_path.is_absolute():
        database_path = Path.cwd() / database_path
    ready = _float_env("ORBIT_READY_THRESHOLD", 0.85)
    review = _float_env("ORBIT_REVIEW_THRESHOLD", 0.60)
    if review >= ready:
        raise ValueError("ORBIT_REVIEW_THRESHOLD must be lower than ORBIT_READY_THRESHOLD")
    mode = os.getenv("ORBIT_DETECTOR_MODE", "mock").strip().lower()
    if mode not in {"mock", "real"}:
        raise ValueError("ORBIT_DETECTOR_MODE must be mock or real")
    origins = tuple(
        origin.strip()
        for origin in os.getenv(
            "ORBIT_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    )
    return Settings(
        database_path=database_path,
        detector_mode=mode,
        ready_threshold=ready,
        review_threshold=review,
        max_image_bytes=int(os.getenv("ORBIT_MAX_IMAGE_BYTES", 10 * 1024 * 1024)),
        cors_origins=origins,
        model_weights=os.getenv("ORBIT_MODEL_WEIGHTS") or None,
    )
