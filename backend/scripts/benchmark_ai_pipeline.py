from __future__ import annotations

import argparse
import json
import logging
import math
import os
import platform
import statistics
import subprocess
import sys
import time
import uuid
import winreg
from importlib.metadata import version
from pathlib import Path

import psutil
import torch
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import Settings  # noqa: E402
from app.detectors.real import RealDetector  # noqa: E402
from app.main import create_app  # noqa: E402
from app.ocr.service import build_ocr_service  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark the real ORBIT YOLO + OCR API pipeline")
    parser.add_argument("--inputs", type=Path, default=Path(".benchmark-inputs"))
    parser.add_argument("--weights", type=Path, default=Path("backend/models/orbit_ai_5class_yolo11n_best.pt"))
    parser.add_argument("--output", type=Path, default=Path("docs/performance"))
    parser.add_argument("--warmups", type=int, default=3)
    parser.add_argument("--runs", type=int, default=20)
    return parser.parse_args()


def metric(values: list[float]) -> dict:
    ordered = sorted(values)
    p95_index = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return {
        "runs": len(values),
        "mean": round(statistics.fmean(values), 3),
        "median": round(statistics.median(values), 3),
        "min": round(min(values), 3),
        "max": round(max(values), 3),
        "p95": round(ordered[p95_index], 3),
    }


def command_version(command: list[str]) -> str:
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True).stdout.strip()
    except Exception:
        return "unavailable"


def cpu_name() -> str:
    try:
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
        )
        return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
    except OSError:
        return platform.processor() or "unavailable"


def machine_spec(weights: Path) -> dict:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    return {
        "os": platform.platform(),
        "cpu": cpu_name(),
        "logical_cpu_count": psutil.cpu_count(logical=True),
        "ram_gib": round(psutil.virtual_memory().total / (1024**3), 2),
        "python": platform.python_version(),
        "torch": torch.__version__,
        "torchvision": version("torchvision"),
        "ultralytics": version("ultralytics"),
        "rapidocr": version("rapidocr"),
        "onnxruntime": version("onnxruntime"),
        "node": command_version(["node", "--version"]),
        "pnpm": command_version(["pnpm.cmd", "--version"]),
        "nextjs": package["dependencies"]["next"],
        "model": weights.name,
        "device": "CPU" if not torch.cuda.is_available() else f"GPU: {torch.cuda.get_device_name(0)}",
    }


def annotate(source: Path, scan: dict, destination: Path) -> None:
    with Image.open(source) as original:
        image = original.convert("RGB")
    if image.width > 1400:
        scale = 1400 / image.width
        image = image.resize((1400, round(image.height * scale)), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(image)
    for item in scan.get("items", []):
        label = (
            f"{item['item']['sku'] if item.get('item') else 'UNKNOWN'} "
            f"x{item['quantity']} {item['confidence']:.1%} {item['status']} "
            f"OCR:{item.get('ocr', {}).get('verification_status', 'n/a')}"
        )
        for bbox in item.get("bboxes") or ([item["bbox"]] if item.get("bbox") else []):
            x1 = round(bbox["x"] * image.width)
            y1 = round(bbox["y"] * image.height)
            x2 = round((bbox["x"] + bbox["w"]) * image.width)
            y2 = round((bbox["y"] + bbox["h"]) * image.height)
            draw.rectangle((x1, y1, x2, y2), outline="#00ffff", width=5)
            text_y = max(0, y1 - 22)
            draw.rectangle((x1, text_y, min(image.width, x1 + 520), text_y + 22), fill="black")
            draw.text((x1 + 3, text_y + 3), label, fill="white")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "JPEG", quality=88)


def resolve_reviews(client: TestClient, scan: dict) -> dict:
    current = scan
    for item in list(current.get("items", [])):
        if item["status"] != "review_needed":
            continue
        if item.get("item"):
            payload = {
                "action": "confirm",
                "selected_item_id": item["item"]["id"],
                "quantity": item["quantity"],
                "reason": "Automated performance run; no inventory increase",
                "reviewed_by": "Benchmark",
            }
        else:
            payload = {"action": "reject", "reason": "Unmapped benchmark detection", "reviewed_by": "Benchmark"}
        response = client.post(
            f"/api/scans/{current['scan_session_id']}/reviews/{item['detection_id']}",
            json=payload,
        )
        response.raise_for_status()
        current = response.json()
    return current


def perform_scan(client: TestClient, entry: dict, inputs: Path) -> dict:
    image_path = inputs / entry["file"]
    content_type = "image/png" if image_path.suffix.lower() == ".png" else "image/jpeg"
    started = time.perf_counter()
    response = client.post(
        f"/api/scans?store_id=store-1&client_scan_id=benchmark-{uuid.uuid4().hex}",
        content=image_path.read_bytes(),
        headers={"content-type": content_type},
    )
    total_api_ms = (time.perf_counter() - started) * 1000
    response.raise_for_status()
    scan = response.json()
    ready_scan = resolve_reviews(client, scan)
    lines = [
        {
            "detection_id": item["detection_id"],
            "item_id": item["item"]["id"],
            "quantity": item["quantity"],
            "unit": "unit",
            "condition": "damaged",
        }
        for item in ready_scan.get("items", [])
        if item.get("item") and item["status"] != "rejected"
    ]
    bulk_return_ms = None
    if lines:
        return_started = time.perf_counter()
        returned = client.post(
            "/api/transactions/returns",
            json={
                "client_transaction_id": f"benchmark-return-{uuid.uuid4().hex}",
                "scan_session_id": ready_scan["scan_session_id"],
                "store_id": "store-1",
                "user_name": "Benchmark",
                "items": lines,
            },
        )
        bulk_return_ms = (time.perf_counter() - return_started) * 1000
        returned.raise_for_status()

    return {
        "input": entry["file"],
        "expected_sku": entry.get("expected_sku"),
        "synthetic": entry.get("synthetic", False),
        "yolo_inference_ms": float((scan.get("timings") or {})["yolo_inference_ms"]),
        "ocr_processing_ms": float((scan.get("timings") or {})["ocr_processing_ms"]),
        "ai_combined_ms": float((scan.get("timings") or {})["ai_combined_ms"]),
        "total_scan_api_ms": total_api_ms,
        "bulk_return_ms": bulk_return_ms,
        "scan": scan,
    }


def markdown_report(result: dict) -> str:
    spec = result["machine"]
    rows = []
    labels = {
        "yolo_inference_ms": "YOLO inference",
        "ocr_processing_ms": "OCR",
        "ai_combined_ms": "YOLO + OCR",
        "total_scan_api_ms": "Total /api/scans",
        "bulk_return_ms": "Bulk Return",
    }
    for key, label in labels.items():
        item = result["summary"][key]
        rows.append(
            f"| {label} | {item['runs']} | {item['mean']:.3f} | {item['median']:.3f} | "
            f"{item['min']:.3f} | {item['max']:.3f} | {item['p95']:.3f} |"
        )
    return f"""# ORBIT AI local CPU performance evidence

Measured on {result['measured_at']} from base commit `{result['base_commit']}`. {result['warmups']} warm-up scans were excluded; all reported values are wall-clock milliseconds from {result['runs']} measured runs. `/api/scans` is measured through FastAPI's in-process ASGI test client on the same machine, so network latency is excluded. Bulk Return measures the confirmed transaction endpoint after any required review; benchmark returns use `damaged` condition so stock is not increased.

| Metric | Runs | Mean | Median | Min | Max | P95 |
|---|---:|---:|---:|---:|---:|---:|
{chr(10).join(rows)}

## Machine

- OS: {spec['os']}
- CPU: {spec['cpu']} ({spec['logical_cpu_count']} logical processors)
- RAM: {spec['ram_gib']} GiB
- Device: {spec['device']}; local deployment performance is CPU-only
- Python: {spec['python']}
- Torch / Torchvision: {spec['torch']} / {spec['torchvision']}
- Ultralytics: {spec['ultralytics']}
- RapidOCR / ONNX Runtime: {spec['rapidocr']} / {spec['onnxruntime']}
- Node / pnpm / Next.js: {spec['node']} / {spec['pnpm']} / {spec['nextjs']}
- Model: `{spec['model']}`

## Method and scope

- Inputs rotate through official held-out class photos for T003, T005, L003, E018, and E019 plus a clearly labelled synthetic two-screwdriver composite.
- OCR runs only on padded YOLO crops. A separate synthetic `E018` label proves the OCR engine can read the intended SKU form.
- The current model remains a validated five-class prototype alongside the 109-item operational catalog.
- Exact per-run results and source member names are stored in `benchmark-results.json`.

## Evidence files

- `evidence/health.json`: database, real detector, and OCR readiness.
- `evidence/ocr-exact-synthetic.json`: actual RapidOCR output on the generated E018 label.
- `evidence/ocr-conflict-unit-test.json`: clearly labelled injected conflict contract and test location.
- `evidence/real-detection.jpg`: annotated real model result on an official held-out image.
- `evidence/multi-object.jpg`: annotated two-object result when detected.
- `evidence/review-needed.jpg`: annotated low-confidence review result when produced.
- `evidence/no-text-fallback.jpg`: annotated detection where OCR found no readable SKU.

No Colab T4 timing is used in this report.
"""


def main() -> None:
    global args
    args = parse_args()
    logging.getLogger("httpx").setLevel(logging.WARNING)
    args.output.mkdir(parents=True, exist_ok=True)
    evidence_dir = args.output / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((args.inputs / "manifest.json").read_text(encoding="utf-8"))
    scan_inputs = [entry for entry in manifest if entry.get("purpose") is None]
    if not scan_inputs:
        raise RuntimeError("No benchmark scan inputs were prepared")

    ocr = build_ocr_service(
        ROOT / "backend" / "data" / "inventory_catalog.json",
        enabled=True,
        min_confidence=0.50,
        crop_padding=0.08,
        timeout_seconds=5.0,
    )
    detector = RealDetector(str(args.weights.resolve()), ocr_service=ocr)
    db_path = args.inputs / "benchmark.db"
    db_path.unlink(missing_ok=True)
    settings = Settings(
        database_path=db_path,
        detector_mode="real",
        ready_threshold=0.85,
        review_threshold=0.60,
        max_image_bytes=20 * 1024 * 1024,
        cors_origins=("http://localhost:3000",),
        model_weights=str(args.weights),
    )
    app = create_app(settings, detector)

    records: list[dict] = []
    with TestClient(app) as client:
        health = client.get("/api/health")
        health.raise_for_status()
        (evidence_dir / "health.json").write_text(json.dumps(health.json(), indent=2) + "\n", encoding="utf-8")
        total = args.warmups + args.runs
        for index in range(total):
            entry = scan_inputs[index % len(scan_inputs)]
            record = perform_scan(client, entry, args.inputs)
            if index >= args.warmups:
                records.append(record)
                print(
                    f"run={index - args.warmups + 1:02d} input={entry['file']} "
                    f"detections={len(record['scan']['items'])} api_ms={record['total_scan_api_ms']:.1f}"
                )

    if len(records) != args.runs:
        raise RuntimeError("Measured run count does not match requested runs")
    metrics = {
        key: metric([float(record[key]) for record in records if record[key] is not None])
        for key in (
            "yolo_inference_ms",
            "ocr_processing_ms",
            "ai_combined_ms",
            "total_scan_api_ms",
            "bulk_return_ms",
        )
    }
    if metrics["bulk_return_ms"]["runs"] < 10:
        raise RuntimeError("Fewer than 10 measured scans produced a Bulk Return transaction")

    label_entry = next(entry for entry in manifest if entry.get("purpose"))
    with Image.open(args.inputs / label_entry["file"]) as label_image:
        exact_ocr = ocr.verify(
            label_image.convert("RGB"),
            "E018",
            [(0.0, 0.0, float(label_image.width), float(label_image.height))],
        )
    (evidence_dir / "ocr-exact-synthetic.json").write_text(
        json.dumps({"synthetic": True, "purpose": label_entry["purpose"], "result": exact_ocr}, indent=2) + "\n",
        encoding="utf-8",
    )
    (evidence_dir / "ocr-conflict-unit-test.json").write_text(
        json.dumps(
            {
                "synthetic": True,
                "scenario": "YOLO E018 plus injected OCR E019",
                "expected": "verification_status=conflict and scan status=review_needed",
                "automated_test": "backend/tests/test_ocr.py::test_ocr_conflict_forces_review_and_offers_catalog_candidate",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    evidence_candidates = {
        "real-detection.jpg": next((record for record in records if record["scan"]["items"] and not record["synthetic"]), None),
        "multi-object.jpg": next(
            (
                record
                for record in records
                if "multi_object" in record["input"]
                and any(
                    item.get("item", {}).get("sku") == "T003" and item["quantity"] == 2
                    for item in record["scan"]["items"]
                    if item.get("item")
                )
            ),
            None,
        ),
        "review-needed.jpg": next(
            (
                record
                for record in records
                if record["expected_sku"] in {"E018", "E019"} and record["scan"]["status"] == "review_needed"
            ),
            None,
        ),
        "no-text-fallback.jpg": next(
            (
                record
                for record in records
                if any(item.get("ocr", {}).get("verification_status") == "not_available" for item in record["scan"]["items"])
            ),
            None,
        ),
    }
    for name, record in evidence_candidates.items():
        if record:
            annotate(args.inputs / record["input"], record["scan"], evidence_dir / name)

    result = {
        "measured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "base_commit": command_version(["git", "merge-base", "HEAD", "origin/main"]),
        "warmups": args.warmups,
        "runs": args.runs,
        "machine": machine_spec(args.weights),
        "summary": metrics,
        "records": records,
    }
    (args.output / "benchmark-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (args.output / "performance-report.md").write_text(markdown_report(result), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
