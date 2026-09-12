from __future__ import annotations

import json
import logging
import re
import queue
import threading
import time
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

from .engine import OcrEngine, RapidOcrEngine


SKU_PATTERN = re.compile(r"(?<![A-Z0-9])([A-Z]{1,3}[\s_-]*\d{2,4})(?![A-Z0-9])", re.IGNORECASE)
logger = logging.getLogger("orbit.ocr")


def normalize_sku(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def extract_sku_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    for match in SKU_PATTERN.finditer(text.upper()):
        candidate = normalize_sku(match.group(1))
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _load_catalog_skus(catalog_path: Path) -> frozenset[str]:
    rows = json.loads(catalog_path.read_text(encoding="utf-8"))
    return frozenset(normalize_sku(str(row["sku"])) for row in rows)


class OcrService:
    def __init__(
        self,
        valid_skus: set[str] | frozenset[str],
        engine: OcrEngine | None,
        *,
        min_confidence: float = 0.50,
        crop_padding: float = 0.08,
        unavailable_error: str | None = None,
        enabled: bool = True,
        timeout_seconds: float = 5.0,
    ) -> None:
        self.valid_skus = frozenset(normalize_sku(sku) for sku in valid_skus)
        self.engine = engine
        self.min_confidence = min_confidence
        self.crop_padding = crop_padding
        self.unavailable_error = unavailable_error
        self.enabled = enabled
        self.timeout_seconds = timeout_seconds

    @property
    def health(self) -> dict:
        return {
            "enabled": self.enabled,
            "available": self.engine is not None,
            "engine": getattr(self.engine, "version", "unavailable" if self.enabled else "disabled"),
            "error": self.unavailable_error,
        }

    def verify(
        self,
        frame: Image.Image,
        yolo_sku: str,
        boxes: list[tuple[float, float, float, float]],
    ) -> dict:
        started = time.perf_counter()
        if not self.enabled:
            return self._payload("not_available", processing_time_ms=0.0)
        if self.engine is None:
            return self._payload(
                "error",
                error=self.unavailable_error or "OCR_ENGINE_UNAVAILABLE",
                processing_time_ms=0.0,
            )

        observed_text: list[str] = []
        candidate_scores: dict[str, float] = {}
        invalid_candidates: list[str] = []
        attempts: list[dict] = []
        errors: list[str] = []

        for box in boxes:
            crop = self._crop(frame, box)
            attempt_started = time.perf_counter()
            try:
                results = self._read_with_timeout(crop)
            except Exception as exc:
                error_code = "OCR_ENGINE_TIMEOUT" if isinstance(exc, TimeoutError) else "OCR_ENGINE_ERROR"
                logger.exception("OCR engine failed for a YOLO crop")
                errors.append(error_code)
                attempts.append(
                    {
                        "detected_text": None,
                        "candidates": [],
                        "processing_time_ms": round((time.perf_counter() - attempt_started) * 1000, 3),
                        "error": error_code,
                    }
                )
                continue

            attempt_text = " ".join(result.text for result in results).strip() or None
            if attempt_text:
                observed_text.append(attempt_text)
            attempt_candidates: list[str] = []
            for result in results:
                if result.confidence < self.min_confidence:
                    continue
                for candidate in extract_sku_candidates(result.text):
                    attempt_candidates.append(candidate)
                    if candidate in self.valid_skus:
                        candidate_scores[candidate] = max(candidate_scores.get(candidate, 0.0), result.confidence)
                    elif candidate not in invalid_candidates:
                        invalid_candidates.append(candidate)
            attempts.append(
                {
                    "detected_text": attempt_text,
                    "candidates": list(dict.fromkeys(attempt_candidates)),
                    "processing_time_ms": round((time.perf_counter() - attempt_started) * 1000, 3),
                    "error": None,
                }
            )

        valid_candidates = sorted(candidate_scores)
        yolo_sku = normalize_sku(yolo_sku)
        if len(valid_candidates) > 1:
            status = "ambiguous"
        elif len(valid_candidates) == 1:
            status = "verified" if valid_candidates[0] == yolo_sku else "conflict"
        elif invalid_candidates:
            status = "invalid"
        elif errors:
            status = "error"
        else:
            status = "not_available"

        elapsed = round((time.perf_counter() - started) * 1000, 3)
        return self._payload(
            status,
            detected_text=" | ".join(observed_text) or None,
            normalized_sku=valid_candidates[0] if len(valid_candidates) == 1 else None,
            candidates=[
                {"sku": sku, "confidence": round(candidate_scores[sku], 4)}
                for sku in valid_candidates
            ],
            invalid_candidates=invalid_candidates,
            attempts=attempts,
            error=errors[0] if status == "error" else None,
            processing_time_ms=elapsed,
        )

    def _crop(self, frame: Image.Image, box: tuple[float, float, float, float]) -> Image.Image:
        x1, y1, x2, y2 = box
        width = max(1.0, x2 - x1)
        height = max(1.0, y2 - y1)
        padding = max(width, height) * self.crop_padding
        bounds = (
            max(0, int(x1 - padding)),
            max(0, int(y1 - padding)),
            min(frame.width, int(x2 + padding)),
            min(frame.height, int(y2 + padding)),
        )
        crop = frame.crop(bounds).convert("RGB")
        if min(crop.size) < 320:
            scale = min(3.0, 320 / max(1, min(crop.size)))
            crop = crop.resize(
                (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
                Image.Resampling.LANCZOS,
            )
        crop = ImageOps.autocontrast(crop)
        return ImageEnhance.Sharpness(crop).enhance(1.25)

    def _read_with_timeout(self, crop: Image.Image):
        outcome: queue.Queue = queue.Queue(maxsize=1)

        def run() -> None:
            try:
                outcome.put((True, self.engine.read(crop)))
            except Exception as exc:
                outcome.put((False, exc))

        worker = threading.Thread(target=run, name="orbit-ocr", daemon=True)
        worker.start()
        worker.join(self.timeout_seconds)
        if worker.is_alive():
            raise TimeoutError("OCR inference exceeded its configured time limit")
        succeeded, value = outcome.get_nowait()
        if not succeeded:
            raise value
        return value

    def _payload(
        self,
        status: str,
        *,
        detected_text: str | None = None,
        normalized_sku: str | None = None,
        candidates: list[dict] | None = None,
        invalid_candidates: list[str] | None = None,
        attempts: list[dict] | None = None,
        error: str | None = None,
        processing_time_ms: float,
    ) -> dict:
        return {
            "detected_text": detected_text,
            "normalized_sku": normalized_sku,
            "catalog_match": bool(candidates),
            "verification_status": status,
            "conflict_with_yolo": status == "conflict",
            "review_required": status in {"conflict", "ambiguous"},
            "candidates": candidates or [],
            "invalid_candidates": invalid_candidates or [],
            "attempts": attempts or [],
            "engine": getattr(self.engine, "version", "unavailable" if self.enabled else "disabled"),
            "processing_time_ms": processing_time_ms,
            "error": error,
        }


def build_ocr_service(
    catalog_path: Path,
    *,
    enabled: bool,
    min_confidence: float,
    crop_padding: float,
    timeout_seconds: float,
) -> OcrService:
    valid_skus = _load_catalog_skus(catalog_path)
    if not enabled:
        return OcrService(valid_skus, None, enabled=False)
    try:
        engine = RapidOcrEngine()
    except Exception:
        logger.exception("OCR engine initialization failed; continuing with YOLO")
        return OcrService(
            valid_skus,
            None,
            min_confidence=min_confidence,
            crop_padding=crop_padding,
            timeout_seconds=timeout_seconds,
            unavailable_error="OCR_ENGINE_UNAVAILABLE",
        )
    return OcrService(
        valid_skus,
        engine,
        min_confidence=min_confidence,
        crop_padding=crop_padding,
        timeout_seconds=timeout_seconds,
    )
