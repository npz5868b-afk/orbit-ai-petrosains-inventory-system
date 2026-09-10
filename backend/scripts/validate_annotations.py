from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate ORBIT AI JSONL detection annotations")
    parser.add_argument("annotations", type=Path)
    parser.add_argument("--class-dictionary", type=Path, required=True)
    parser.add_argument("--split-manifest", type=Path, required=True)
    args = parser.parse_args()

    classes = json.loads(args.class_dictionary.read_text(encoding="utf-8"))
    valid_skus = {entry["official_sku"] for entry in classes}
    with args.split_manifest.open(encoding="utf-8-sig", newline="") as handle:
        manifest = {row["sha256"]: row for row in csv.DictReader(handle)}
    errors = []
    seen = set()
    for line_number, line in enumerate(args.annotations.read_text(encoding="utf-8").splitlines(), 1):
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            errors.append(f"line {line_number}: invalid JSON ({exc.msg})")
            continue
        image_id = record.get("image_id")
        if not image_id or image_id in seen:
            errors.append(f"line {line_number}: missing or duplicate image_id")
        seen.add(image_id)
        source = manifest.get(record.get("sha256"))
        if not source:
            errors.append(f"line {line_number}: sha256 is not in the frozen split manifest")
        elif record.get("split") != source["split"]:
            errors.append(f"line {line_number}: split differs from frozen manifest")
        objects = record.get("objects")
        if not isinstance(objects, list):
            errors.append(f"line {line_number}: objects must be a list")
            continue
        if record.get("is_negative") is True and objects:
            errors.append(f"line {line_number}: negative image contains target objects")
        for index, obj in enumerate(objects):
            if obj.get("official_sku") not in valid_skus:
                errors.append(f"line {line_number} object {index}: unknown official_sku")
            bbox = obj.get("bbox_xywh_normalized")
            if not isinstance(bbox, list) or len(bbox) != 4 or any(not isinstance(value, (int, float)) for value in bbox):
                errors.append(f"line {line_number} object {index}: invalid bbox")
            elif any(value < 0 or value > 1 for value in bbox) or bbox[2] <= 0 or bbox[3] <= 0:
                errors.append(f"line {line_number} object {index}: bbox is outside normalized bounds")
    if errors:
        print("\n".join(errors[:200]))
        raise SystemExit(f"Annotation validation failed with {len(errors)} error(s)")
    print(f"Validated {len(seen)} annotation record(s) against {len(valid_skus)} official classes")


if __name__ == "__main__":
    main()
