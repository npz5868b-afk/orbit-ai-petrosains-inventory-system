from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class RawDetection:
    class_key: str
    confidence: float
    quantity: int = 1
    bbox: dict[str, float] | None = None
    alternatives: list[tuple[str, float]] = field(default_factory=list)
    why: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


class Detector(Protocol):
    version: str

    def detect(self, image: bytes | None, fixture: str = "mixed") -> list[RawDetection]: ...
