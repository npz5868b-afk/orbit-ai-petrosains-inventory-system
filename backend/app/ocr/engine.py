from __future__ import annotations

from dataclasses import dataclass
from importlib.metadata import version
from typing import Protocol

from PIL import Image


@dataclass(frozen=True)
class OcrText:
    text: str
    confidence: float


class OcrEngine(Protocol):
    version: str

    def read(self, image: Image.Image) -> list[OcrText]: ...


class RapidOcrEngine:
    """CPU OCR adapter kept independent from the PyTorch/YOLO environment."""

    def __init__(self) -> None:
        try:
            from rapidocr import RapidOCR
        except ImportError as exc:
            raise RuntimeError(
                "Install backend/requirements-ocr.txt to enable OCR verification"
            ) from exc

        self._engine = RapidOCR()
        self.version = f"rapidocr:{version('rapidocr')}"

    def read(self, image: Image.Image) -> list[OcrText]:
        import numpy as np

        output = self._engine(np.asarray(image.convert("RGB")))
        texts = getattr(output, "txts", None)
        scores = getattr(output, "scores", None)

        # Compatibility with RapidOCR 1.x output while the project pins 3.x.
        if texts is None and isinstance(output, tuple):
            rows = output[0] or []
            return [
                OcrText(str(row[1]), float(row[2]))
                for row in rows
                if len(row) >= 3 and str(row[1]).strip()
            ]

        if texts is None:
            return []
        score_values = list(scores) if scores is not None else [0.0] * len(texts)
        return [
            OcrText(str(text), float(score_values[index]))
            for index, text in enumerate(texts)
            if str(text).strip()
        ]
