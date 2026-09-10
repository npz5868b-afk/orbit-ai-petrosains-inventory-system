from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .database import connect, init_database, transaction


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CATALOG_PATH = DATA_DIR / "inventory_catalog.json"

STORES = [
    ("store-1", "STORE-1", "Store 1", "Store Level 4", "online"),
    ("store-2", "STORE-2", "Store 2", "Edustore / Maker Studio", "online"),
    ("store-3", "STORE-3", "Store 3", "Chemical Room", "offline"),
    ("store-4", "STORE-4", "Store 4", "Store Concourse / Chillax", "offline"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def seed_database(path: Path | None = None, force: bool = False) -> None:
    init_database(path)
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Missing normalized catalog: {CATALOG_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if len(catalog) != 109:
        raise ValueError("Normalized catalog must contain exactly 109 items")
    with transaction(path) as db:
        count = db.execute("SELECT COUNT(*) FROM inventory_items").fetchone()[0]
        if count and not force:
            return
        if force:
            for table in (
                "sync_attempts", "review_decisions", "transaction_items", "activity_events",
                "detections", "transactions", "scan_sessions", "inventory_items", "stores"
            ):
                db.execute(f"DELETE FROM {table}")
        now = utc_now()
        db.executemany(
            "INSERT INTO stores (id, code, name, location, connectivity, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
            [(*store, now) for store in STORES],
        )
        db.executemany(
            """
            INSERT INTO inventory_items (
                id, sku, name, category, description, item_type, base_unit, issue_unit,
                conversion_to_base, available_quantity, total_quantity, reorder_level,
                store_id, rack, image_url, ai_class_key, is_active, created_at, updated_at
            ) VALUES (
                :id, :sku, :name, :category, :description, :item_type, :base_unit, :issue_unit,
                :conversion_to_base, :available_quantity, :total_quantity, :reorder_level,
                :store_id, :rack, :image_url, :ai_class_key, 1, :created_at, :updated_at
            )
            """,
            [{**item, "created_at": now, "updated_at": now} for item in catalog],
        )


def reset_database(path: Path | None = None) -> None:
    seed_database(path, force=True)
