from __future__ import annotations

import argparse
import json
from pathlib import Path

import openpyxl


STORE_MAP = {
    "STORE 1": "store-1",
    "MAKER STUDIO": "store-2",
    "CHEMICAL ROOM": "store-3",
    "CHILLAX": "store-4",
}

# The source workbook reports available == total for every item. The reset fixture
# simulates seven outstanding units so the official Bulk Return demo has valid stock
# to return without allowing available_quantity to exceed total_quantity.
DEMO_CHECKED_OUT = {"T003": 3, "T005": 2, "L003": 1, "E018": 1}


def import_workbook(workbook: Path) -> list[dict]:
    sheet = openpyxl.load_workbook(workbook, data_only=True).active
    items: list[dict] = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        sku = str(row[0]).strip() if row[0] else ""
        name = str(row[1]).strip() if row[1] else ""
        if not sku or not name:
            continue
        source_location = str(row[5]).strip().upper()
        issue_unit = (str(row[9]).strip() or "Unit").lower()
        total = int(row[7] or 0)
        source_available = int(row[8] or 0)
        checked_out = DEMO_CHECKED_OUT.get(sku, 0)
        items.append(
            {
                "id": f"item-{sku.lower()}",
                "sku": sku,
                "name": name,
                "category": str(row[2]).strip(),
                "description": None,
                "item_type": "reusable" if str(row[4]).strip() == "Controllable Asset" else "consumable",
                "base_unit": issue_unit,
                "issue_unit": issue_unit,
                "conversion_to_base": 1,
                "available_quantity": max(0, source_available - checked_out),
                "source_available_quantity": source_available,
                "total_quantity": total,
                "reorder_level": max(1, min(5, total // 10)),
                "store_id": STORE_MAP[source_location],
                "source_storage_location": source_location,
                "rack": str(row[6]).strip() if row[6] else None,
                "image_reference": str(row[17]).strip() if row[17] else None,
                "image_url": None,
                "ai_class_key": sku,
            }
        )
    if len(items) != 109:
        raise ValueError(f"Expected 109 official items, found {len(items)}")
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize the official Petrosains inventory workbook")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    items = import_workbook(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} official items to {args.output}")


if __name__ == "__main__":
    main()
