from __future__ import annotations

import json

import pytest

from app.domain import canonical_hash
from app.seed import CATALOG_PATH


def test_payload_hash_is_order_independent_and_value_sensitive():
    left = {"store_id": "store-1", "items": [{"quantity": 1, "item_id": "item-a"}]}
    reordered = {"items": [{"item_id": "item-a", "quantity": 1}], "store_id": "store-1"}
    changed = {"store_id": "store-1", "items": [{"quantity": 2, "item_id": "item-a"}]}
    assert canonical_hash(left) == canonical_hash(reordered)
    assert canonical_hash(left) != canonical_hash(changed)


def test_normalized_catalog_has_fixed_official_facts():
    items = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    assert len(items) == 109
    assert len({item["category"] for item in items}) == 5
    assert len({item["store_id"] for item in items}) == 4
    assert all(item["conversion_to_base"] == 1 for item in items)
    assert all(item["base_unit"] == item["issue_unit"] for item in items)
    assert all(item["available_quantity"] <= item["total_quantity"] for item in items)
