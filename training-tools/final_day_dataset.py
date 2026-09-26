from __future__ import annotations

import argparse
import csv
import hashlib
import shutil
from pathlib import Path
from typing import Any


CLASSES = {
    0: "T003 Screwdriver",
    1: "T005 Measure Tape",
    2: "L003 Beaker 250ml",
    3: "E018 LED Red",
    4: "E019 LED Blue",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def image_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def sha_prefix(path: Path, length: int = 10) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:length]


def safe_name(path: Path) -> str:
    stem = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in path.stem)
    return f"{stem}-{sha_prefix(path)}{path.suffix.lower()}"


def copy_unique(src: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe_name(src)
    shutil.copy2(src, dest)
    return dest


def init_workspace(workspace: Path) -> None:
    for relative in [
        "raw/train",
        "raw/physical-holdout",
        "labels/train",
        "candidate-datasets",
        "reports",
    ]:
        (workspace / relative).mkdir(parents=True, exist_ok=True)
    print(f"Workspace ready: {workspace.resolve()}")


def ingest(src: Path, workspace: Path, bucket: str) -> None:
    if bucket not in {"train", "physical-holdout"}:
        raise SystemExit("ERROR: --bucket must be train or physical-holdout")
    images = image_files(src)
    if not images:
        raise SystemExit(f"ERROR: No images found under {src}")
    dest_dir = workspace / "raw" / bucket
    manifest = workspace / "reports" / f"ingest-{bucket}.csv"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    write_header = not manifest.exists()
    with manifest.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(["bucket", "source", "copied_to", "sha256_prefix"])
        for image in images:
            copied = copy_unique(image, dest_dir)
            writer.writerow([bucket, str(image), str(copied), sha_prefix(image)])
            print(f"COPIED {image.name} -> {copied}")


def load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as exc:
        raise SystemExit(
            "ERROR: PyYAML is required to read the existing YOLO data.yaml. "
            "Run inside .venv-train or install pyyaml."
        ) from exc
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"ERROR: Invalid YAML: {path}")
    return data


def resolve_split(data_yaml: Path, data: dict[str, Any], split: str) -> Path | None:
    value = data.get(split)
    if not value:
        return None
    if isinstance(value, list):
        raise SystemExit(f"ERROR: {split} as a list is not supported by this lightweight merger")
    base = data.get("path")
    root = Path(base).expanduser() if base else data_yaml.parent
    if not root.is_absolute():
        root = data_yaml.parent / root
    path = Path(str(value)).expanduser()
    if not path.is_absolute():
        path = root / path
    return path.resolve()


def label_for_image(image: Path) -> Path:
    parts = list(image.parts)
    if "images" in parts:
        index = len(parts) - 1 - parts[::-1].index("images")
        parts[index] = "labels"
        return Path(*parts).with_suffix(".txt")
    return image.parent.parent / "labels" / image.with_suffix(".txt").name


def validate_label_file(label_file: Path) -> list[str]:
    warnings: list[str] = []
    if not label_file.exists():
        return [f"missing label: {label_file}"]
    for line_number, line in enumerate(label_file.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) != 5:
            warnings.append(f"{label_file}:{line_number} expected 5 values")
            continue
        try:
            class_id = int(float(parts[0]))
            values = [float(value) for value in parts[1:]]
        except ValueError:
            warnings.append(f"{label_file}:{line_number} non-numeric YOLO value")
            continue
        if class_id not in CLASSES:
            warnings.append(f"{label_file}:{line_number} invalid class {class_id}")
        if any(value < 0 or value > 1 for value in values):
            warnings.append(f"{label_file}:{line_number} coordinate outside 0..1")
    return warnings


def copy_pair(image: Path, label: Path, out_images: Path, out_labels: Path) -> None:
    name = safe_name(image)
    image_dest = out_images / name
    label_dest = out_labels / Path(name).with_suffix(".txt").name
    image_dest.parent.mkdir(parents=True, exist_ok=True)
    label_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(image, image_dest)
    shutil.copy2(label, label_dest)


def copy_existing_split(split_path: Path, out_root: Path, split: str) -> tuple[int, list[str]]:
    warnings: list[str] = []
    count = 0
    for image in image_files(split_path):
        label = label_for_image(image)
        label_warnings = validate_label_file(label)
        if label_warnings:
            warnings.extend(label_warnings)
            continue
        copy_pair(
            image,
            label,
            out_root / "images" / split / "ready",
            out_root / "labels" / split / "ready",
        )
        count += 1
    return count, warnings


def copy_final_day_train(workspace: Path, out_root: Path) -> tuple[int, list[str]]:
    warnings: list[str] = []
    count = 0
    images_root = workspace / "raw" / "train"
    labels_root = workspace / "labels" / "train"
    for image in image_files(images_root):
        relative = image.relative_to(images_root)
        label = labels_root / relative.with_suffix(".txt")
        label_warnings = validate_label_file(label)
        if label_warnings:
            warnings.extend(label_warnings)
            continue
        copy_pair(
            image,
            label,
            out_root / "images" / "train" / "final-day",
            out_root / "labels" / "train" / "final-day",
        )
        count += 1
    return count, warnings


def write_data_yaml(out_root: Path) -> Path:
    lines = [
        f"path: {out_root.resolve().as_posix()}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "names:",
    ]
    for class_id, name in CLASSES.items():
        lines.append(f"  {class_id}: {name}")
    data_yaml = out_root / "data.yaml"
    data_yaml.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return data_yaml


def build_dataset(workspace: Path, ready_data: Path, name: str) -> None:
    data = load_yaml(ready_data)
    out_root = workspace / "candidate-datasets" / name
    if out_root.exists():
        raise SystemExit(f"ERROR: Candidate dataset already exists: {out_root}")
    out_root.mkdir(parents=True)

    report_rows: list[tuple[str, int]] = []
    warnings: list[str] = []

    for split in ["train", "val", "test"]:
        split_path = resolve_split(ready_data, data, split)
        if split_path is None:
            warnings.append(f"ready dataset has no {split} split")
            continue
        copied, split_warnings = copy_existing_split(split_path, out_root, split)
        report_rows.append((f"ready {split}", copied))
        warnings.extend(split_warnings)

    final_day_count, final_day_warnings = copy_final_day_train(workspace, out_root)
    report_rows.append(("final-day train", final_day_count))
    warnings.extend(final_day_warnings)

    data_yaml = write_data_yaml(out_root)
    report = workspace / "reports" / f"{name}-dataset-report.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report_lines = [
        f"# ORBIT AI Final-Day Dataset Report: {name}",
        "",
        f"- Ready data source: `{ready_data.resolve()}`",
        f"- Candidate dataset: `{out_root.resolve()}`",
        f"- Candidate data.yaml: `{data_yaml.resolve()}`",
        f"- Physical holdout folder: `{(workspace / 'raw' / 'physical-holdout').resolve()}`",
        "",
        "## Copied Images",
        "",
    ]
    report_lines.extend(f"- {label}: {count}" for label, count in report_rows)
    report_lines.extend(["", "## Warnings", ""])
    if warnings:
        report_lines.extend(f"- {warning}" for warning in warnings)
    else:
        report_lines.append("- None")
    report.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    print("=== FINAL-DAY CANDIDATE DATASET READY ===")
    print(f"data.yaml : {data_yaml.resolve()}")
    print(f"report    : {report.resolve()}")
    print(f"new train : {final_day_count}")
    if warnings:
        print(f"warnings  : {len(warnings)} (see report)")


def main() -> None:
    parser = argparse.ArgumentParser(description="ORBIT AI final-day YOLO dataset workflow")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="Create final-day workspace folders")
    init_parser.add_argument("--workspace", default="aiic-final-day")

    ingest_parser = subparsers.add_parser("ingest", help="Copy photos into train or holdout bucket")
    ingest_parser.add_argument("--src", required=True)
    ingest_parser.add_argument("--workspace", default="aiic-final-day")
    ingest_parser.add_argument("--bucket", required=True, choices=["train", "physical-holdout"])

    build_parser = subparsers.add_parser("build", help="Build candidate dataset from Ready data + labelled train photos")
    build_parser.add_argument("--ready-data", required=True, help="Existing YOLO Ready data.yaml")
    build_parser.add_argument("--workspace", default="aiic-final-day")
    build_parser.add_argument("--name", required=True, help="Candidate dataset name")

    args = parser.parse_args()
    workspace = Path(getattr(args, "workspace", "aiic-final-day")).resolve()

    if args.command == "init":
        init_workspace(workspace)
    elif args.command == "ingest":
        ingest(Path(args.src).resolve(), workspace, args.bucket)
    elif args.command == "build":
        build_dataset(workspace, Path(args.ready_data).resolve(), args.name)


if __name__ == "__main__":
    main()
