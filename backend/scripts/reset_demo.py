from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.seed import reset_database  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset ORBIT AI to the reproducible 109-item demo state")
    parser.add_argument("--database", type=Path, default=None)
    args = parser.parse_args()
    reset_database(args.database)
    print("ORBIT AI demo database reset successfully")


if __name__ == "__main__":
    main()
