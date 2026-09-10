from __future__ import annotations

from .base import RawDetection


class MockDetector:
    version = "mock-v1"

    _fixtures = {
        "mixed": [
            RawDetection("T003", 0.96, 3, {"x": 0.08, "y": 0.15, "w": 0.31, "h": 0.25}),
            RawDetection("T005", 0.91, 2, {"x": 0.56, "y": 0.23, "w": 0.31, "h": 0.31}),
            RawDetection("L003", 0.95, 1, {"x": 0.14, "y": 0.58, "w": 0.27, "h": 0.27}),
            RawDetection(
                "E018",
                0.71,
                1,
                {"x": 0.58, "y": 0.57, "w": 0.28, "h": 0.29},
                [("E019", 0.22)],
                ["Red and blue LED packages have the same shape", "Colour cue is partly hidden"],
            ),
        ],
        "all_ready": [
            RawDetection("T003", 0.97, 2),
            RawDetection("L003", 0.93, 1),
        ],
        "unknown": [
            RawDetection("unknown-object", 0.31, 1, why=["No approved catalog class met the review threshold"])
        ],
        "empty": [],
    }

    def detect(self, image: bytes | None, fixture: str = "mixed") -> list[RawDetection]:
        if fixture == "unavailable":
            raise RuntimeError("Deterministic detector-unavailable fixture")
        return list(self._fixtures.get(fixture, self._fixtures["mixed"]))
