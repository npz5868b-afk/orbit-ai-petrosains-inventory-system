# ORBIT AI local CPU performance evidence

Measured on 2026-09-12T14:05:13+0800 from base commit `09759cb042e475635d1067d4102a4f7421457a04`. 3 warm-up scans were excluded; all reported values are wall-clock milliseconds from 20 measured runs. `/api/scans` is measured through FastAPI's in-process ASGI test client on the same machine, so network latency is excluded. Bulk Return measures the confirmed transaction endpoint after any required review; benchmark returns use `damaged` condition so stock is not increased.

| Metric | Runs | Mean | Median | Min | Max | P95 |
|---|---:|---:|---:|---:|---:|---:|
| YOLO inference | 20 | 209.291 | 207.053 | 100.969 | 327.715 | 274.191 |
| OCR | 20 | 1125.427 | 1149.005 | 0.000 | 2441.548 | 2166.886 |
| YOLO + OCR | 20 | 1334.718 | 1364.403 | 228.257 | 2679.209 | 2267.855 |
| Total /api/scans | 20 | 1462.163 | 1506.441 | 384.292 | 2848.890 | 2308.332 |
| Bulk Return | 19 | 13.810 | 12.831 | 11.064 | 20.497 | 20.497 |

## Machine

- OS: Windows-11-10.0.26200-SP0
- CPU: AMD Ryzen 7 260 w/ Radeon 780M Graphics (16 logical processors)
- RAM: 23.31 GiB
- Device: CPU; local deployment performance is CPU-only
- Python: 3.12.14
- Torch / Torchvision: 2.13.0+cpu / 0.28.0+cpu
- Ultralytics: 8.3.199
- RapidOCR / ONNX Runtime: 3.9.2 / 1.29.0
- Node / pnpm / Next.js: v24.15.0 / 11.19.0 / 16.3.3
- Model: `orbit_ai_5class_yolo11n_best.pt`

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
