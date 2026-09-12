from __future__ import annotations

import os
import time
from io import BytesIO
from pathlib import Path

from ..config import BACKEND_DIR
from ..ocr import OcrService
from .base import DetectionBatch, RawDetection


class RealDetector:
    """Ultralytics detector with catalog-aware OCR verification per YOLO crop."""

    def __init__(self, weights: str, *, ocr_service: OcrService):
        if not weights:
            raise RuntimeError("ORBIT_MODEL_WEIGHTS is required for real detector mode")

        yolo_config_root = BACKEND_DIR / "data" / ".ultralytics"
        yolo_config_root.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("YOLO_CONFIG_DIR", str(yolo_config_root))
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError(
                "Install the optional ultralytics dependency for real detector mode"
            ) from exc

        self._model = YOLO(weights)
        self._ocr = ocr_service
        self.version = f"ultralytics:{Path(weights).name}"

    @property
    def ocr_health(self) -> dict:
        return self._ocr.health

    def detect(
        self,
        image: bytes | None,
        fixture: str = "mixed",
    ) -> list[RawDetection]:
        if not image:
            raise RuntimeError("Real detector mode requires an image")

        from PIL import Image

        frame = Image.open(BytesIO(image)).convert("RGB")
        yolo_started = time.perf_counter()
        result = self._model.predict(frame, verbose=False)[0]
        yolo_ms = round((time.perf_counter() - yolo_started) * 1000, 3)

        grouped: dict[str, list] = {}
        for box in result.boxes:
            class_index = int(box.cls.item())
            model_class_name = str(result.names[class_index])
            class_key = model_class_name.split("_", 1)[0].upper()
            grouped.setdefault(class_key, []).append(box)

        prepared: list[dict] = []
        ocr_total_ms = 0.0
        width, height = frame.size

        for class_key, boxes in grouped.items():
            confidences = [float(box.conf.item()) for box in boxes]
            pixel_boxes: list[tuple[float, float, float, float]] = []
            individual_bboxes: list[dict[str, float]] = []

            for box in boxes:
                x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
                pixel_boxes.append((x1, y1, x2, y2))
                individual_bboxes.append(
                    {
                        "x": x1 / width,
                        "y": y1 / height,
                        "w": (x2 - x1) / width,
                        "h": (y2 - y1) / height,
                    }
                )

            ocr = self._ocr.verify(frame, class_key, pixel_boxes)
            ocr_total_ms += float(ocr["processing_time_ms"])
            prepared.append(
                {
                    "class_key": class_key,
                    "confidences": confidences,
                    "bboxes": individual_bboxes,
                    "ocr": ocr,
                }
            )

        combined_ms = round(yolo_ms + ocr_total_ms, 3)
        scan_timing = {
            "yolo_inference_ms": yolo_ms,
            "ocr_processing_ms": round(ocr_total_ms, 3),
            "ocr_total_scan_ms": round(ocr_total_ms, 3),
            "ai_combined_ms": combined_ms,
        }
        detections: list[RawDetection] = []
        for item in prepared:
            bboxes = item["bboxes"]
            detections.append(
                RawDetection(
                    class_key=item["class_key"],
                    confidence=max(item["confidences"]),
                    quantity=len(bboxes),
                    bbox=bboxes[0],
                    metadata={
                        "individual_confidences": item["confidences"],
                        "individual_bboxes": bboxes,
                        "ocr": item["ocr"],
                        "timing": {
                            "yolo_inference_ms": yolo_ms,
                            "ocr_processing_ms": item["ocr"]["processing_time_ms"],
                            "ocr_total_scan_ms": round(ocr_total_ms, 3),
                            "ai_combined_ms": combined_ms,
                        },
                    },
                )
            )

        return DetectionBatch(detections, scan_timing)
