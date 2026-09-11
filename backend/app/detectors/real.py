from __future__ import annotations

from io import BytesIO

from .base import RawDetection


class RealDetector:
    """Optional Ultralytics adapter. The REST response remains model-agnostic."""

    def __init__(self, weights: str):
        if not weights:
            raise RuntimeError("ORBIT_MODEL_WEIGHTS is required for real detector mode")

        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError(
                "Install the optional ultralytics dependency for real detector mode"
            ) from exc

        self._model = YOLO(weights)
        self.version = f"ultralytics:{weights}"

    def detect(
        self,
        image: bytes | None,
        fixture: str = "mixed",
    ) -> list[RawDetection]:
        if not image:
            raise RuntimeError("Real detector mode requires an image")

        from PIL import Image

        frame = Image.open(BytesIO(image)).convert("RGB")
        result = self._model.predict(frame, verbose=False)[0]

        grouped: dict[str, list] = {}

        for box in result.boxes:
            class_index = int(box.cls.item())
            model_class_name = str(result.names[class_index])
            class_key = model_class_name.split("_", 1)[0]

            grouped.setdefault(class_key, []).append(box)

        detections = []
        width, height = frame.size

        for class_key, boxes in grouped.items():
            confidences = [
                float(box.conf.item())
                for box in boxes
            ]

            individual_bboxes = []

            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                individual_bboxes.append(
                    {
                        "x": x1 / width,
                        "y": y1 / height,
                        "w": (x2 - x1) / width,
                        "h": (y2 - y1) / height,
                    }
                )

            detections.append(
                RawDetection(
                    class_key=class_key,
                    confidence=max(confidences),
                    quantity=len(boxes),
                    bbox=individual_bboxes[0],
                    metadata={
                        "individual_confidences": confidences,
                        "individual_bboxes": individual_bboxes,
                    },
                )
            )

        return detections
