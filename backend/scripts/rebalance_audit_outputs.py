from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

from audit_official_resources import assign_splits, write_csv


def read_csv(path: Path) -> tuple[list[dict], list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebalance an existing ORBIT AI audit without decoding the source images again")
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    records, fields = read_csv(args.output_dir / "file-manifest.csv")
    assign_splits(records)
    write_csv(args.output_dir / "file-manifest.csv", records, fields)
    write_csv(
        args.output_dir / "split-manifest.csv",
        [{"member_path": record["member_path"], "official_sku": record["official_sku"], "sha256": record["sha256"],
          "duplicate_group": record["duplicate_group"], "split": record["split"]} for record in records],
    )
    class_rows, class_fields = read_csv(args.output_dir / "class-audit.csv")
    counts = Counter((record["official_sku"], record["split"]) for record in records)
    for row in class_rows:
        for split in ("train", "validation", "test"):
            row[split] = counts[(row["sku"], split)]
    write_csv(args.output_dir / "class-audit.csv", class_rows, class_fields)
    split_counts = Counter(record["split"] for record in records)
    format_mismatches = sum(record["format_mismatch"] == "True" for record in records)
    report_path = args.output_dir / "audit-report.md"
    report = report_path.read_text(encoding="utf-8")
    report = re.sub(
        r"- Leakage-controlled split: train \d+, validation \d+, test \d+",
        f"- Leakage-controlled split: train {split_counts['train']}, validation {split_counts['validation']}, test {split_counts['test']}",
        report,
    )
    if "Extension/signature mismatches" not in report:
        report = report.replace(
            "- Detected formats:",
            f"- Extension/signature mismatches: **{format_mismatches}** (readable files that need conversion/renaming before common training tools)\n- Detected formats:",
        )
    report_path.write_text(report, encoding="utf-8")
    print(dict(split_counts), f"format_mismatches={format_mismatches}")


if __name__ == "__main__":
    main()
