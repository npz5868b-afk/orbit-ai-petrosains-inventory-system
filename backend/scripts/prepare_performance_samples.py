from __future__ import annotations

import argparse
import csv
import json
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pillow_heif import register_heif_opener


DEMO_SKUS = ("T003", "T005", "L003", "E018", "E019")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract repeatable benchmark samples from official archives")
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=Path("docs/data-audit/file-manifest.csv"))
    parser.add_argument("--output", type=Path, default=Path(".benchmark-inputs"))
    parser.add_argument("--per-class", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    register_heif_opener()
    args.output.mkdir(parents=True, exist_ok=True)
    with args.manifest.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    selected: list[dict] = []
    for sku in DEMO_SKUS:
        candidates = [
            row
            for row in rows
            if row["official_sku"] == sku
            and row["duplicate_type"] == "unique"
            and row["split"] == "test"
            and not row["read_error"]
        ]
        if len(candidates) < args.per_class:
            fallback = [
                row
                for row in rows
                if row["official_sku"] == sku
                and row["split"] == "test"
                and not row["read_error"]
                and row not in candidates
            ]
            candidates.extend(fallback)
        candidates.sort(key=lambda row: (bool(row["quality_flags"]), row["member_path"]))
        for index, row in enumerate(candidates[: args.per_class], start=1):
            archive = args.source_dir / row["archive"]
            with zipfile.ZipFile(archive) as bundle:
                payload = bundle.read(row["member_path"])
            with Image.open(BytesIO(payload)) as image:
                converted = image.convert("RGB")
                output_name = f"{sku}_{index:02d}.jpg"
                converted.save(args.output / output_name, "JPEG", quality=92)
            selected.append(
                {
                    "file": output_name,
                    "expected_sku": sku,
                    "source_archive": row["archive"],
                    "source_member": row["member_path"],
                    "split": row["split"],
                    "synthetic": False,
                }
            )

    screwdriver_files = [args.output / row["file"] for row in selected if row["expected_sku"] == "T003"]
    if len(screwdriver_files) >= 2:
        images = [Image.open(path).convert("RGB") for path in screwdriver_files[:2]]
        target_height = min(900, max(image.height for image in images))
        resized = [
            image.resize((round(image.width * target_height / image.height), target_height), Image.Resampling.LANCZOS)
            for image in images
        ]
        canvas = Image.new("RGB", (sum(image.width for image in resized), target_height), "white")
        left = 0
        for image in resized:
            canvas.paste(image, (left, 0))
            left += image.width
        canvas.save(args.output / "T003_multi_object_synthetic.jpg", "JPEG", quality=92)
        selected.append(
            {
                "file": "T003_multi_object_synthetic.jpg",
                "expected_sku": "T003",
                "expected_quantity": 2,
                "source_archive": None,
                "source_member": [str(path.name) for path in screwdriver_files[:2]],
                "split": "synthetic-composite-from-test-images",
                "synthetic": True,
            }
        )
        for image in images:
            image.close()

    label = Image.new("RGB", (900, 320), "white")
    draw = ImageDraw.Draw(label)
    font_path = Path("C:/Windows/Fonts/arialbd.ttf")
    font = ImageFont.truetype(str(font_path), 180) if font_path.exists() else ImageFont.load_default()
    draw.text((100, 55), "E018", font=font, fill="black")
    label.save(args.output / "OCR_E018_synthetic.png")
    selected.append(
        {
            "file": "OCR_E018_synthetic.png",
            "expected_sku": "E018",
            "purpose": "OCR engine evidence only; not a YOLO camera detection",
            "synthetic": True,
        }
    )

    (args.output / "manifest.json").write_text(json.dumps(selected, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(selected)} benchmark inputs in {args.output}")


if __name__ == "__main__":
    main()
