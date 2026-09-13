from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import get_settings


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT,
    connectivity TEXT NOT NULL CHECK (connectivity IN ('online', 'offline')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('reusable', 'consumable')),
    base_unit TEXT NOT NULL,
    issue_unit TEXT NOT NULL,
    conversion_to_base INTEGER CHECK (conversion_to_base IS NULL OR conversion_to_base >= 1),
    available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
    store_id TEXT NOT NULL REFERENCES stores(id),
    rack TEXT,
    image_url TEXT,
    ai_class_key TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_sessions (
    id TEXT PRIMARY KEY,
    client_scan_id TEXT UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('bulk_return', 'checkout')),
    status TEXT NOT NULL CHECK (status IN ('created','scanning','review','ready','confirmed','expired')),
    store_id TEXT NOT NULL REFERENCES stores(id),
    image_reference TEXT,
    detector_version TEXT NOT NULL,
    processing_time_ms INTEGER,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    confirmed_transaction_id TEXT
);

CREATE TABLE IF NOT EXISTS detections (
    id TEXT PRIMARY KEY,
    scan_session_id TEXT NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
    predicted_class TEXT NOT NULL,
    inventory_item_id TEXT REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bbox TEXT,
    status TEXT NOT NULL CHECK (status IN ('ready','review','unknown','resolved','rejected')),
    possible_matches TEXT,
    why TEXT,
    raw_metadata TEXT
);

CREATE TABLE IF NOT EXISTS review_decisions (
    id TEXT PRIMARY KEY,
    detection_id TEXT NOT NULL REFERENCES detections(id),
    selected_item_id TEXT REFERENCES inventory_items(id),
    action TEXT NOT NULL CHECK (action IN ('confirm','choose_another','scan_again','reject')),
    original_confidence REAL NOT NULL,
    reason TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    client_transaction_id TEXT NOT NULL UNIQUE,
    payload_hash TEXT NOT NULL,
    response_snapshot TEXT,
    type TEXT NOT NULL CHECK (type IN ('checkout','return','adjustment')),
    status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected','failed')),
    store_id TEXT NOT NULL REFERENCES stores(id),
    user_name TEXT,
    scan_session_id TEXT REFERENCES scan_sessions(id),
    notes TEXT,
    created_at TEXT NOT NULL,
    confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
    quantity_base INTEGER NOT NULL CHECK (quantity_base > 0),
    display_quantity INTEGER NOT NULL CHECK (display_quantity > 0),
    display_unit TEXT NOT NULL,
    condition TEXT CHECK (condition IS NULL OR condition IN ('good','damaged','unknown')),
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_attempts (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    client_transaction_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('applied','duplicate','conflict','failed')),
    response_snapshot TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    item_id TEXT REFERENCES inventory_items(id),
    store_id TEXT REFERENCES stores(id),
    user_name TEXT,
    summary TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_scan ON detections(scan_session_id);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    db_path = path or get_settings().database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=10, isolation_level=None, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


@contextmanager
def transaction(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_database(path: Path | None = None) -> None:
    connection = connect(path)
    try:
        connection.executescript(SCHEMA)
        _migrate_scan_session_modes(connection)
    finally:
        connection.close()


def _migrate_scan_session_modes(connection: sqlite3.Connection) -> None:
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'scan_sessions'",
    ).fetchone()
    sql = row["sql"] if row else ""
    if "CHECK (mode = 'bulk_return')" not in sql:
        return

    connection.execute("PRAGMA foreign_keys = OFF")
    try:
        connection.executescript(
            """
            CREATE TABLE scan_sessions_new (
                id TEXT PRIMARY KEY,
                client_scan_id TEXT UNIQUE,
                mode TEXT NOT NULL CHECK (mode IN ('bulk_return', 'checkout')),
                status TEXT NOT NULL CHECK (status IN ('created','scanning','review','ready','confirmed','expired')),
                store_id TEXT NOT NULL REFERENCES stores(id),
                image_reference TEXT,
                detector_version TEXT NOT NULL,
                processing_time_ms INTEGER,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                confirmed_transaction_id TEXT
            );

            INSERT INTO scan_sessions_new (
                id, client_scan_id, mode, status, store_id, image_reference,
                detector_version, processing_time_ms, created_at, expires_at,
                confirmed_transaction_id
            )
            SELECT
                id, client_scan_id, mode, status, store_id, image_reference,
                detector_version, processing_time_ms, created_at, expires_at,
                confirmed_transaction_id
            FROM scan_sessions;

            DROP TABLE scan_sessions;
            ALTER TABLE scan_sessions_new RENAME TO scan_sessions;
            """
        )
    finally:
        connection.execute("PRAGMA foreign_keys = ON")


def json_value(value: str | None, default=None):
    return json.loads(value) if value else default
