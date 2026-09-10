from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


def read_jsonl(path: Path) -> dict[str, dict[str, int]]:
    records = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        record = json.loads(line)
        records[record["image_id"]] = {key: int(value) for key, value in record.get("counts", {}).items()}
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute ORBIT AI count MAE and exact-count accuracy")
    parser.add_argument("ground_truth", type=Path)
    parser.add_argument("predictions", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    truth = read_jsonl(args.ground_truth)
    predictions = read_jsonl(args.predictions)
    if set(truth) != set(predictions):
        raise SystemExit("Ground truth and prediction image_id sets differ")
    absolute_errors = defaultdict(list)
    exact = defaultdict(list)
    for image_id, expected in truth.items():
        predicted = predictions[image_id]
        for sku in set(expected) | set(predicted):
            error = abs(expected.get(sku, 0) - predicted.get(sku, 0))
            absolute_errors[sku].append(error)
            exact[sku].append(error == 0)
    per_class = {
        sku: {
            "mae": sum(errors) / len(errors),
            "exact_count_accuracy": sum(exact[sku]) / len(exact[sku]),
            "evaluated_images": len(errors),
        }
        for sku, errors in sorted(absolute_errors.items())
    }
    all_errors = [error for errors in absolute_errors.values() for error in errors]
    result = {
        "images": len(truth),
        "overall_mae": sum(all_errors) / len(all_errors) if all_errors else 0,
        "overall_exact_count_accuracy": sum(error == 0 for error in all_errors) / len(all_errors) if all_errors else 1,
        "per_class": per_class,
    }
    serialized = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
