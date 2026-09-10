from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import statistics
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath

import openpyxl
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat
from pillow_heif import register_heif_opener


register_heif_opener()
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic"}


def normalize(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def detected_format(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "heic"
    return "unknown"


def dhash(image: Image.Image, size: int = 8) -> str:
    gray = image.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    bits = 0
    for y in range(size):
        for x in range(size):
            bits = (bits << 1) | (pixels[y * (size + 1) + x] > pixels[y * (size + 1) + x + 1])
    return f"{bits:0{size * size // 4}x}"


def image_metrics(image: Image.Image) -> dict:
    width, height = image.size
    sample = image.convert("L")
    sample.thumbnail((256, 256), Image.Resampling.LANCZOS)
    stat = ImageStat.Stat(sample)
    edges = sample.filter(ImageFilter.FIND_EDGES)
    edge_values = list(edges.getdata())
    edge_mean = statistics.fmean(edge_values)
    edge_variance = statistics.fmean((value - edge_mean) ** 2 for value in edge_values)
    brightness = float(stat.mean[0])
    contrast = float(stat.stddev[0])
    reasons = []
    if min(width, height) < 640:
        reasons.append("low_resolution")
    if brightness < 35:
        reasons.append("very_dark")
    elif brightness > 225:
        reasons.append("very_bright")
    if contrast < 15:
        reasons.append("low_contrast")
    if edge_variance < 120:
        reasons.append("low_edge_detail")
    return {
        "width": width,
        "height": height,
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "sharpness_proxy": round(edge_variance, 2),
        "quality_flags": reasons,
        "dhash": dhash(image),
    }


class UnionFind:
    def __init__(self, keys):
        self.parent = {key: key for key in keys}

    def find(self, key):
        root = key
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[key] != key:
            key, self.parent[key] = self.parent[key], root
        return root

    def union(self, left, right):
        left_root, right_root = self.find(left), self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


def read_catalog(workbook: Path) -> list[dict]:
    sheet = openpyxl.load_workbook(workbook, data_only=True).active
    rows = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        sku = str(row[0]).strip() if row[0] else ""
        name = str(row[1]).strip() if row[1] else ""
        if sku and name:
            rows.append(
                {
                    "sku": sku,
                    "name": name,
                    "category": str(row[2]).strip(),
                    "source_storage_location": str(row[5]).strip(),
                    "unit": str(row[9]).strip(),
                    "image_reference": str(row[17]).strip() if row[17] else "",
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict], fields: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = fields or list(rows[0])
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def scan_archives(archives: list[Path]) -> tuple[list[dict], list[tuple[str, bytes]]]:
    records = []
    storeroom_images: list[tuple[str, bytes]] = []
    seen_member_keys = set()
    for archive in archives:
        with zipfile.ZipFile(archive) as zipped:
            for info in zipped.infolist():
                path = PurePosixPath(info.filename)
                suffix = path.suffix.lower()
                if info.is_dir() or suffix not in IMAGE_EXTENSIONS:
                    continue
                parts = path.parts
                if "Storeroom_Fact_Sheet" in parts:
                    data = zipped.read(info)
                    storeroom_images.append((str(path), data))
                    continue
                if "Inventory_Photos" not in parts:
                    continue
                member_key = str(path)
                if member_key in seen_member_keys:
                    continue
                seen_member_keys.add(member_key)
                marker = parts.index("Inventory_Photos")
                if len(parts) < marker + 4:
                    continue
                data = zipped.read(info)
                folder = parts[marker + 2]
                category_folder = parts[marker + 1]
                record = {
                    "archive": archive.name,
                    "member_path": member_key,
                    "category_folder": category_folder,
                    "class_folder": folder,
                    "folder_code": folder.split("_", 1)[0].strip(),
                    "filename": path.name,
                    "extension": suffix.lstrip("."),
                    "bytes": len(data),
                    "crc32": f"{info.CRC:08x}",
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "detected_format": detected_format(data),
                }
                try:
                    with Image.open(io.BytesIO(data)) as image:
                        record.update(image_metrics(image))
                    record["read_error"] = ""
                except Exception as exc:
                    record.update(
                        {"width": None, "height": None, "brightness": None, "contrast": None,
                         "sharpness_proxy": None, "quality_flags": ["unreadable"], "dhash": ""}
                    )
                    record["read_error"] = type(exc).__name__
                record["format_mismatch"] = (
                    record["detected_format"] != "unknown"
                    and {"jpg": "jpeg", "jpeg": "jpeg", "heic": "heic", "png": "png"}.get(record["extension"]) != record["detected_format"]
                )
                records.append(record)
    return records, storeroom_images


def map_classes(catalog: list[dict], records: list[dict]) -> list[dict]:
    folders = sorted({record["class_folder"] for record in records})
    by_reference = {normalize(item["image_reference"]): item for item in catalog if item["image_reference"]}
    by_code = {item["sku"]: item for item in catalog}
    mappings = []
    for folder in folders:
        folder_code = folder.split("_", 1)[0].strip()
        item = by_reference.get(normalize(folder))
        method = "image_reference"
        if not item:
            item = by_code.get(folder_code)
            method = "sku"
        mappings.append(
            {
                "class_folder": folder,
                "folder_code": folder_code,
                "item_id": f"item-{item['sku'].lower()}" if item else None,
                "sku": item["sku"] if item else None,
                "name": item["name"] if item else None,
                "category": item["category"] if item else None,
                "mapping_method": method if item else "unresolved",
                "folder_code_matches_sku": bool(item and item["sku"] == folder_code),
            }
        )
    return mappings


def assign_duplicate_groups(records: list[dict]) -> tuple[list[dict], list[dict]]:
    by_sha = defaultdict(list)
    for index, record in enumerate(records):
        by_sha[record["sha256"]].append(index)
    exact_groups = [indices for indices in by_sha.values() if len(indices) > 1]
    uf = UnionFind(range(len(records)))
    for indices in exact_groups:
        for index in indices[1:]:
            uf.union(indices[0], index)

    hashes = [(index, int(record["dhash"], 16)) for index, record in enumerate(records) if record["dhash"]]
    # 2,788 images gives fewer than four million comparisons; grouping at Hamming <= 2
    # catches likely near duplicates while avoiding broad visual-similarity claims.
    for left_position, (left_index, left_hash) in enumerate(hashes):
        for right_index, right_hash in hashes[left_position + 1:]:
            if (left_hash ^ right_hash).bit_count() <= 2:
                uf.union(left_index, right_index)

    components = defaultdict(list)
    for index in range(len(records)):
        components[uf.find(index)].append(index)
    duplicate_components = [indices for indices in components.values() if len(indices) > 1]
    duplicate_rows = []
    for number, indices in enumerate(sorted(duplicate_components, key=lambda value: (-len(value), value[0])), 1):
        shas = {records[index]["sha256"] for index in indices}
        group_type = "exact" if len(shas) == 1 else "near_or_exact"
        group_id = f"dup-{number:04d}"
        for index in indices:
            records[index]["duplicate_group"] = group_id
            records[index]["duplicate_type"] = group_type
            duplicate_rows.append(
                {"group_id": group_id, "group_type": group_type, "group_size": len(indices),
                 "class_folder": records[index]["class_folder"], "member_path": records[index]["member_path"],
                 "sha256": records[index]["sha256"], "dhash": records[index]["dhash"]}
            )
    for index, record in enumerate(records):
        record.setdefault("duplicate_group", f"unique-{index:04d}")
        record.setdefault("duplicate_type", "unique")
    return duplicate_rows, exact_groups


def assign_splits(records: list[dict]) -> None:
    groups = defaultdict(list)
    for record in records:
        groups[record["duplicate_group"]].append(record)
    for group_id, members in groups.items():
        value = int(hashlib.sha256(group_id.encode()).hexdigest()[:8], 16) % 100
        split = "train" if value < 70 else "validation" if value < 85 else "test"
        for record in members:
            record["split"] = split
    # Keep duplicate components intact while ensuring every class with enough
    # independent components has validation and test coverage. Prefer components
    # that contain only one official class so another class cannot be displaced.
    group_classes = {
        group_id: {member["official_sku"] for member in members}
        for group_id, members in groups.items()
    }
    classes = sorted({record["official_sku"] for record in records})
    for sku in classes:
        class_groups = sorted({record["duplicate_group"] for record in records if record["official_sku"] == sku})
        if len(class_groups) < 3:
            continue
        for desired in ("validation", "test"):
            if any(record["official_sku"] == sku and record["split"] == desired for record in records):
                continue
            candidates = [
                group_id for group_id in class_groups
                if len(group_classes[group_id]) == 1 and groups[group_id][0]["split"] == "train"
            ]
            if not candidates:
                candidates = [group_id for group_id in class_groups if len(group_classes[group_id]) == 1]
            if not candidates:
                candidates = class_groups
            selected = min(candidates, key=lambda value: hashlib.sha256(f"{sku}:{desired}:{value}".encode()).hexdigest())
            for record in groups[selected]:
                record["split"] = desired


def build_class_audit(catalog: list[dict], mappings: list[dict], records: list[dict]) -> list[dict]:
    mapping_by_folder = {mapping["class_folder"]: mapping for mapping in mappings}
    by_folder = defaultdict(list)
    for record in records:
        by_folder[record["class_folder"]].append(record)
    rows = []
    for folder, images in sorted(by_folder.items()):
        mapping = mapping_by_folder[folder]
        readable = [image for image in images if not image["read_error"]]
        unique_hashes = {image["sha256"] for image in images}
        flags = Counter(flag for image in images for flag in image["quality_flags"])
        splits = Counter(image["split"] for image in images)
        rows.append(
            {
                **mapping,
                "photo_count": len(images),
                "exact_unique_count": len(unique_hashes),
                "exact_duplicate_files": len(images) - len(unique_hashes),
                "readable_count": len(readable),
                "format_mismatch_count": sum(bool(image["format_mismatch"]) for image in images),
                "min_width": min((image["width"] for image in readable), default=None),
                "min_height": min((image["height"] for image in readable), default=None),
                "quality_flags": ";".join(f"{key}:{value}" for key, value in sorted(flags.items())),
                "train": splits["train"],
                "validation": splits["validation"],
                "test": splits["test"],
                "object_detection_annotations": "missing",
                "training_use": "classification/pre-annotation only",
                "manual_visual_review": "required for item size, angle, occlusion, packaging and label visibility",
            }
        )
    return rows


LOOKALIKE_GROUPS = [
    {"id": "electronics-led-colour", "classes": ["E018", "E019"], "risk": "Same package; colour is the main cue."},
    {"id": "electronics-n20-motors", "classes": ["E008", "E010"], "risk": "Small metal gear motors share housing and scale."},
    {"id": "electronics-rocker-switches", "classes": ["E022", "E023"], "risk": "Similar black switch bodies; pin count may be hidden."},
    {"id": "electronics-jumper-wires", "classes": ["E026", "E027"], "risk": "Connector gender is a small end-point cue."},
    {"id": "lab-beakers", "classes": ["L003", "L004"], "risk": "Same transparent form at different capacity."},
    {"id": "lab-conical-flasks", "classes": ["L005", "L006"], "risk": "Same transparent form at different capacity."},
    {"id": "lab-pipettes", "classes": ["L007", "L008"], "risk": "Capacity markings are small and may be occluded."},
    {"id": "lab-syringes", "classes": ["L014", "L015"], "risk": "Capacity markings and scale are the main cues."},
    {"id": "lab-gloves", "classes": ["L011", "L012"], "risk": "Packaging dominates many views; LN2 glove shape differs when unpacked."},
    {"id": "markers", "classes": ["S002", "S011"], "risk": "Marker silhouettes are similar; label text matters."},
    {"id": "adhesives", "classes": ["C011", "C019", "C024", "T004"], "risk": "Glue products share wording and may appear packaged together."},
    {"id": "cutting-tools", "classes": ["T001", "T006"], "risk": "Both are handheld cutting tools in cluttered scenes."},
]


def make_storeroom_contact_sheet(images: list[tuple[str, bytes]], output: Path) -> list[dict]:
    entries = []
    thumbs = []
    for path, data in images:
        try:
            image = Image.open(io.BytesIO(data)).convert("RGB")
            width, height = image.size
            image.thumbnail((260, 180), Image.Resampling.LANCZOS)
            thumbs.append((path, image.copy()))
            entries.append({"member_path": path, "width": width, "height": height, "bytes": len(data), "readable": True})
        except Exception as exc:
            entries.append({"member_path": path, "width": None, "height": None, "bytes": len(data), "readable": False, "error": type(exc).__name__})
    columns = 3
    cell_width, cell_height = 300, 225
    sheet = Image.new("RGB", (columns * cell_width, math.ceil(len(thumbs) / columns) * cell_height), "#111827")
    draw = ImageDraw.Draw(sheet)
    for index, (path, image) in enumerate(thumbs):
        x = (index % columns) * cell_width + 20
        y = (index // columns) * cell_height + 10
        sheet.paste(image, (x, y))
        label = "/".join(PurePosixPath(path).parts[-2:])
        draw.text((x, y + 184), label[:42], fill="white")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=88)
    return entries


def write_docs(output: Path, catalog: list[dict], mappings: list[dict], records: list[dict], class_rows: list[dict], duplicate_rows: list[dict], exact_groups: list[list[int]], storeroom_rows: list[dict]) -> None:
    categories = Counter(item["category"] for item in catalog)
    formats = Counter(record["detected_format"] for record in records)
    splits = Counter(record["split"] for record in records)
    unreadable = sum(bool(record["read_error"]) for record in records)
    mismatches = [mapping for mapping in mappings if not mapping["folder_code_matches_sku"]]
    format_mismatches = sum(bool(record["format_mismatch"]) for record in records)
    exact_files = sum(len(group) for group in exact_groups)
    report = f"""# Official resource audit

Generated from the four official submission archives and inventory workbook. No inventory image is copied into the repository.

## Fixed facts and coverage

- Official inventory records: **{len(catalog)}**
- Official categories: **{len(categories)}** ({', '.join(f'{name}: {count}' for name, count in categories.items())})
- Inventory photo folders: **{len(mappings)}**
- Inventory photos: **{len(records)}**
- Readable images: **{len(records) - unreadable}**; unreadable: **{unreadable}**
- Detected formats: {', '.join(f'{name}: {count}' for name, count in formats.items())}
- Extension/signature mismatches: **{format_mismatches}** (readable files that need conversion/renaming before common training tools)
- Exact-duplicate groups: **{len(exact_groups)}**, covering **{exact_files}** files
- Exact or perceptual duplicate components: **{len({row['group_id'] for row in duplicate_rows})}**
- Leakage-controlled split: train {splits['train']}, validation {splits['validation']}, test {splits['test']}

## Mapping findings

All photo folders are mapped through the workbook's `Image` reference before falling back to the folder code. **{len(mismatches)}** folders have a folder code that does not equal the official SKU. This includes the shifted C018–C023 craft-photo codes. The API and detector class dictionary use the official workbook SKU; the source folder name is retained for traceability.

## What the photographs can support now

The folders provide image-level class labels and are useful for catalog classification, data exploration, and assisted pre-annotation. They do **not** include bounding boxes, instance masks, per-image counts, capture-session IDs, or negative-scene labels. A multi-object detector/counting model cannot be evaluated honestly until those labels and held-out multi-item scenes exist.

Automated image checks cover readability, format/signature, resolution, brightness, contrast, edge-detail proxy, exact duplicates, perceptual duplicates, class balance, and split leakage. Item size, angle, background complexity, occlusion, packaging variation, and label visibility remain marked for human visual review; the script does not pretend to infer them reliably.

## Required next collection/annotation work

1. Convert approved HEIC images to a training format without overwriting originals.
2. Annotate every visible target instance with a bounding box and official SKU class.
3. Add empty and distractor storeroom scenes with no target items.
4. Add mixed-item scenes, repeated same-class counts, overlap, glare, poor light, distance, and partial occlusion.
5. Review duplicate components before labeling and keep every component in one split.
6. Record capture session, source person/device, license/permission, and annotation reviewer.
7. Freeze the generated class dictionary and split manifest before training.

The exact evidence is in `class-audit.csv`, `file-manifest.csv`, `duplicate-groups.csv`, `split-manifest.csv`, `class-dictionary.json`, and `lookalike-groups.json`.
"""
    (output / "audit-report.md").write_text(report, encoding="utf-8")

    annotation = """# Detection annotation contract

Use YOLO normalized bounding boxes for model training and retain a parallel JSONL evidence file.

Each YOLO label line is `class_index x_center y_center width height`, with every coordinate in `[0, 1]`. `class_index` is fixed by `class-dictionary.json`; never infer it from folder order at training time.

The JSONL evidence record must include `image_id`, `source_member_path`, `sha256`, `capture_group`, `split`, `width`, `height`, `objects`, `is_negative`, `annotator`, `reviewer`, `annotation_version`, and `license_or_permission`. Each object includes `official_sku`, `bbox_xywh_normalized`, `condition`, `occluded`, `truncated`, and optional `notes`.

Reject labels with an unknown SKU, non-positive box area, coordinates outside the image, duplicate boxes, unreadable source images, or a split that differs from `split-manifest.csv`. Empty target scenes must have `is_negative: true` and an empty object list.
"""
    (output / "annotation-schema.md").write_text(annotation, encoding="utf-8")

    storeroom = f"""# Storeroom and offline requirements

The official fact-sheet folders contain **{len(storeroom_rows)}** photos across four locations:

- **Store 1 — Store Level 4:** connected deployment; local API/database still keeps the demo independent of internet access.
- **Store 2 — Edustore / Maker Studio:** connected deployment; same local-first transaction path.
- **Store 3 — Chemical Room:** no-internet operating case. Scanning, review, checkout, return, and SQLite commits must work on the device/LAN without cloud inference.
- **Store 4 — Store Concourse / Chillax:** underground/no-internet operating case with the same local-first requirement.

Operational implications derived from the supplied room photos and challenge brief: expect shelves, drawers, cabinets, bins, clutter, reflective packaging/glass, small components, variable distance and lighting, narrow aisles, and partially hidden labels. The camera workflow needs a close-up/retry path, explicit store selection, review before quantity changes, and a device queue for any later cross-site synchronization. Model weights, class mapping, thresholds, and the SQLite database must be available locally.

The contact sheet `storeroom-contact-sheet.jpg` and `storeroom-manifest.csv` retain the visual evidence used for this architecture review.
"""
    (output / "storeroom-requirements.md").write_text(storeroom, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit official AIIC inventory and storeroom resources")
    parser.add_argument("--zip", dest="archives", action="append", type=Path, required=True)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    catalog = read_catalog(args.workbook)
    records, storeroom_images = scan_archives(args.archives)
    mappings = map_classes(catalog, records)
    mapping_by_folder = {mapping["class_folder"]: mapping for mapping in mappings}
    for record in records:
        mapping = mapping_by_folder[record["class_folder"]]
        record["official_sku"] = mapping["sku"]
        record["official_item_id"] = mapping["item_id"]
        record["quality_flags"] = ";".join(record["quality_flags"])
    # Restore quality flags to lists while duplicate/split logic runs.
    for record in records:
        record["quality_flags"] = record["quality_flags"].split(";") if record["quality_flags"] else []
    duplicate_rows, exact_groups = assign_duplicate_groups(records)
    assign_splits(records)
    class_rows = build_class_audit(catalog, mappings, records)
    for record in records:
        record["quality_flags"] = ";".join(record["quality_flags"])

    dictionary = [
        {"class_index": index, "official_sku": mapping["sku"], "item_id": mapping["item_id"],
         "name": mapping["name"], "category": mapping["category"], "source_folder": mapping["class_folder"],
         "mapping_method": mapping["mapping_method"]}
        for index, mapping in enumerate(sorted(mappings, key=lambda value: value["sku"] or ""))
    ]
    (args.output_dir / "class-dictionary.json").write_text(json.dumps(dictionary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (args.output_dir / "lookalike-groups.json").write_text(json.dumps(LOOKALIKE_GROUPS, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_csv(args.output_dir / "file-manifest.csv", records)
    write_csv(args.output_dir / "class-audit.csv", class_rows)
    write_csv(args.output_dir / "duplicate-groups.csv", duplicate_rows)
    write_csv(
        args.output_dir / "split-manifest.csv",
        [{"member_path": record["member_path"], "official_sku": record["official_sku"], "sha256": record["sha256"],
          "duplicate_group": record["duplicate_group"], "split": record["split"]} for record in records],
    )
    storeroom_rows = make_storeroom_contact_sheet(storeroom_images, args.output_dir / "storeroom-contact-sheet.jpg")
    write_csv(args.output_dir / "storeroom-manifest.csv", storeroom_rows)
    write_docs(args.output_dir, catalog, mappings, records, class_rows, duplicate_rows, exact_groups, storeroom_rows)
    print(json.dumps({"items": len(catalog), "folders": len(mappings), "photos": len(records), "storeroom_photos": len(storeroom_rows), "output": str(args.output_dir)}, indent=2))


if __name__ == "__main__":
    main()
