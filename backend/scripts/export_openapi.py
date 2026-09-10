from __future__ import annotations

import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


def main() -> None:
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/openapi.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"Exported OpenAPI contract to {output}")


if __name__ == "__main__":
    main()
