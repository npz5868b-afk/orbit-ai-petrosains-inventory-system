# ORBIT AI — OCR / Build / Performance Technical Handoff

## A. Git information

| Field | Value |
|---|---|
| Repository | `https://github.com/npz5868b-afk/orbit-ai-petrosains-inventory-system` |
| Base branch | `origin/main` |
| Base commit | `09759cb042e475635d1067d4102a4f7421457a04` |
| Working branch | `teammate-ocr-performance` |
| OCR feature commit | `3bf4138` — `feat(ocr): add catalog-aware SKU verification` |
| OCR test commit | `178b5a9` — `test(ocr): cover match conflict fallback and regressions` |
| Production build commit | `e35e25d` — `fix(build): self-host production fonts` |
| Performance commit | `f38de57` — `perf(ai): add local CPU benchmark evidence` |
| Documentation commit | The commit containing this file; use `git log -1 --oneline` after checkout |

The branch was created from the current `origin/main`, not from `backend-phase1`. It has not been merged into `main`.

## B. Task status

| Task | Status |
|---|---|
| OCR SKU Verification | COMPLETE |
| Production Build | PASS |
| Performance Evidence | COMPLETE |

## C. OCR engine

- Library: RapidOCR with ONNX Runtime CPU
- RapidOCR version: 3.9.2
- ONNX Runtime version: 1.29.0
- Reason: it runs on Windows CPU, remains isolated from the working PyTorch/YOLO stack, exposes text confidence, and fails safely when unavailable.

## D. Final OCR architecture

```text
Uploaded/captured image
↓
YOLO11n visual detection and per-instance bounding boxes
↓
Padded, bounded, resized and sharpened detection crops
↓
RapidOCR text extraction
↓
SKU normalization and lookup against the actual 109-item catalog
↓
verified / conflict / ambiguous / invalid / not_available / error
↓
Existing YOLO confidence policy and Human Review flow
```

OCR never changes YOLO confidence, replaces the YOLO-selected SKU, or writes inventory. Conflict and ambiguity force review. Missing text, invalid text, engine errors and timeouts fall back to the existing YOLO flow.

## E. OCR behavior tests

| Scenario | Actual result | Status |
|---|---|---|
| YOLO E018 + OCR E018 | `verified`; original YOLO confidence retained | PASS |
| YOLO E018 + OCR E019 | `conflict`; Review Needed; E019 offered as a catalog candidate | PASS |
| YOLO T003 + no OCR | `not_available`; YOLO continues | PASS |
| OCR Z999 | `invalid`; not treated as a catalog match | PASS |
| OCR E018 + E019 | `ambiguous`; Review Needed | PASS |
| OCR engine exception | `error`; sanitized error code; YOLO continues | PASS |
| OCR engine timeout | `error`; `OCR_ENGINE_TIMEOUT`; YOLO continues | PASS |

Exact-match OCR uses the real RapidOCR engine on a clearly labelled synthetic E018 label. The mismatch case is a clearly labelled injected unit test; it is not represented as a camera observation.

## F. Regression results

| Existing ORBIT AI feature | Result |
|---|---|
| Real YOLO scan | PASS |
| Screwdriver quantity 2 | PASS |
| Two bounding boxes | PASS |
| Low-confidence LED Review Needed | PASS |
| Human confirmation | PASS |
| Return | PASS |
| Inventory update | PASS |
| Activity audit trail | PASS |

The full 20-test backend suite covers the transaction and audit regressions. OCR-specific coverage confirms that grouping still returns T003 quantity 2 with two boxes and that OCR verification does not bypass a low-confidence E018 review.

## G. API changes

Changed endpoints:

- `GET /api/health` adds OCR readiness metadata.
- `POST /api/scans` and `GET /api/scans/{scan_id}` add OCR verification metadata and scan timing.

Additive detection metadata includes `detected_text`, `normalized_sku`, `catalog_match`, `verification_status`, `conflict_with_yolo`, `review_required`, valid candidates, invalid candidates, per-crop attempts, OCR engine, processing time and a sanitized error code. Scan responses add YOLO, OCR and combined timing values.

Existing API compatibility is preserved: **YES**. Existing fields and routes remain unchanged; the new fields are additive.

## H. Files changed

| Files | Purpose |
|---|---|
| `backend/app/ocr/engine.py`, `backend/app/ocr/service.py`, `backend/app/ocr/__init__.py` | Isolated RapidOCR adapter, crop preprocessing, timeout, normalization, catalog matching and verification states |
| `backend/app/detectors/real.py`, `backend/app/detectors/base.py`, `backend/app/detectors/factory.py`, `backend/app/detectors/mock.py`, `backend/app/detectors/__init__.py` | Connect OCR after YOLO while preserving grouping and exposing timing/health |
| `backend/app/domain.py`, `backend/app/main.py`, `backend/app/config.py` | Persist additive OCR metadata, enforce review on conflicts, expose health and configuration |
| `lib/api-client.ts` | Add optional OCR and timing types without changing UI flow |
| `backend/tests/test_ocr.py` | Required match, conflict, missing, invalid, ambiguous, crash, timeout and regression tests |
| `backend/requirements-ocr.txt`, `backend/requirements-ml.txt`, `.env.example`, `.gitignore` | Reproducible CPU dependencies, OCR settings and ignored runtime artifacts |
| `backend/scripts/prepare_performance_samples.py`, `backend/scripts/benchmark_ai_pipeline.py` | Repeatable sample preparation and real pipeline benchmark |
| `docs/performance/` | Machine-readable runs, report, annotated detections, health, runtime scan, build and test evidence |
| `app/layout.tsx`, `app/fonts/` | Preserve the same typography while making production builds independent of Google Fonts downloads |
| `README.md`, `docs/model-card.md`, `docs/work-log.md`, this file | Setup, honest model scope, limitations, decisions and owner handoff |

Protected scan components and inventory/storeroom visual design were not changed. The fixed model file and the 109-item catalog were not changed.

## I. Dependencies

New packages:

| Package | Version |
|---|---:|
| RapidOCR | 3.9.2 |
| ONNX Runtime | 1.29.0 |

ML dependency declaration:

- Before: `ultralytics==8.3.199`, with Torch and Torchvision resolved transitively.
- After: `torch==2.13.0+cpu`, `torchvision==0.28.0+cpu`, and `ultralytics==8.3.199`, using the PyTorch CPU wheel index.
- Reason: pin the already validated local CPU combination and prevent OCR installation from replacing it. Ultralytics was not upgraded.

The model remains `backend/models/orbit_ai_5class_yolo11n_best.pt`; it was not replaced or retrained.

## J. Setup commands

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-ml.txt
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-ocr.txt
pnpm install --frozen-lockfile
```

Real mode environment and backend startup:

```powershell
$env:ORBIT_DETECTOR_MODE="real"
$env:ORBIT_MODEL_WEIGHTS="backend/models/orbit_ai_5class_yolo11n_best.pt"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
```

FastAPI startup: PASS. SQLite connection: PASS. YOLO load: PASS. OCR load: PASS. `/api/health`: PASS. Multipart `/api/scans`: PASS. The real HTTP results are in `docs/performance/evidence/runtime-http-health.json` and `runtime-http-scan.json`.

## K. Automated validation

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q -p no:cacheprovider --basetemp .test-tmp\final-20260912
pnpm.cmd typecheck
pnpm.cmd build
```

- Backend tests: **20 passed, 0 failed**, with one dependency deprecation warning from Starlette/anyio.
- TypeScript: **PASS**, no errors.
- Production build: **PASS**, exit status 0, no warnings or errors, 116/116 static pages generated including all 109 inventory item paths.
- Build fix: replaced build-time Google Fonts downloads with the same locally packaged Geist, Geist Mono and Space Grotesk WOFF2 assets and included their OFL licenses.

## L. Test machine

| Component | Value |
|---|---|
| OS | Windows 11, build 26200 |
| CPU | AMD Ryzen 7 260 with Radeon 780M Graphics, 16 logical processors |
| RAM | 23.31 GiB |
| Deployment device | CPU |
| Python | 3.12.14 |
| Torch | 2.13.0+cpu |
| Torchvision | 0.28.0+cpu |
| Ultralytics | 8.3.199 |
| OCR | RapidOCR 3.9.2 / ONNX Runtime 1.29.0 |
| Node | v24.15.0 |
| pnpm | 11.19.0 |
| Next.js | 16.3.3 |
| Model | `orbit_ai_5class_yolo11n_best.pt` |

## M. Performance method and results

The benchmark performed three warm-up scans and excluded them. It then ran 20 measured scans through FastAPI's in-process ASGI client using real YOLO and RapidOCR on CPU. Inputs rotate official held-out photos for the five validated classes plus a clearly labelled synthetic two-screwdriver composite. The total API measurement excludes network latency. Bulk Return timing covers the confirmed transaction endpoint; 19 measured scans produced actionable detections.

| Metric | Runs | Mean | Median | Min | Max | P95 |
|---|---:|---:|---:|---:|---:|---:|
| YOLO inference | 20 | 209.291 ms | 207.053 ms | 100.969 ms | 327.715 ms | 274.191 ms |
| OCR | 20 | 1125.427 ms | 1149.005 ms | 0.000 ms | 2441.548 ms | 2166.886 ms |
| YOLO + OCR | 20 | 1334.718 ms | 1364.403 ms | 228.257 ms | 2679.209 ms | 2267.855 ms |
| Total `/api/scans` | 20 | 1462.163 ms | 1506.441 ms | 384.292 ms | 2848.890 ms | 2308.332 ms |
| Bulk Return | 19 | 13.810 ms | 12.831 ms | 11.064 ms | 20.497 ms | 20.497 ms |

These are local CPU measurements. No Colab T4 latency is mixed into the table. Exact per-run results are in `docs/performance/benchmark-results.json`.

## N. Evidence

| Evidence | What it proves |
|---|---|
| `docs/performance/evidence/real-detection.jpg` | Successful real YOLO detection on an official held-out image |
| `docs/performance/evidence/multi-object.jpg` | T003 quantity 2 and two real bounding boxes |
| `docs/performance/evidence/review-needed.jpg` | Low-confidence LED routed to Review Needed |
| `docs/performance/evidence/ocr-exact-synthetic.json` | Actual RapidOCR exact E018 read on a labelled synthetic sample |
| `docs/performance/evidence/ocr-conflict-unit-test.json` | Injected mismatch contract and its automated test source |
| `docs/performance/evidence/no-text-fallback.jpg` | Detection remains usable when OCR cannot read a SKU |
| `docs/performance/evidence/runtime-http-health.json` | Running server, database, real YOLO and OCR readiness |
| `docs/performance/evidence/runtime-http-scan.json` | Real HTTP multipart scan with OCR/timing metadata |
| `docs/performance/evidence/production-build.txt` | Final production build result |
| `docs/performance/evidence/automated-tests.txt` | Final backend test result |
| `docs/performance/evidence/typecheck.txt` | Final TypeScript result |
| `docs/performance/performance-report.md` and `benchmark-results.json` | Benchmark protocol, hardware, summaries and all measured runs |

## O. Known limitations and bugs

Known limitations:

- The real detector recognizes five validated visual classes alongside the 109-item catalog; it does not visually recognize all 109 items.
- OCR needs a visible SKU inside or close to the YOLO crop. Small text, blur, glare, low light, rotation, occlusion and missing labels often produce `not_available`.
- Multiple nearby labels can be ambiguous. The system asks a human instead of guessing.
- OCR is the largest part of local CPU latency.
- A timed-out OCR call runs in a daemon worker that is abandoned so the API can return through the YOLO fallback. Repeated engine hangs require process restart and investigation.
- Existing five-class weaknesses remain visible, including possible false positives and red/blue LED confusion. Human Review remains required.

Known bugs observed during final validation: **NONE**.

Work not completed: **NONE within Tasks A, B and C**. An optional System-page OCR indicator and final competition/demo screenshot selection remain owner presentation choices outside this package.

## P. Merge risks and safe-to-merge status

Shared frontend files modified: **YES**, only `app/layout.tsx` plus new `app/fonts/` assets for offline production builds. No protected scan component, navigation, Inventory, Activity, System or Storeroom design was changed. A conflict is possible only if the owner independently changed root font loading.

Safe to merge: **YES WITH NORMAL OWNER REVIEW**.

The branch starts from the requested base, keeps the fixed YOLO model and five-class scope, preserves the 109-item catalog and transaction rules, passes all automated checks, and contains measured evidence. The owner should review any concurrent `app/layout.tsx` changes, run `pnpm.cmd build` after resolving them, perform the final demo path, and select the final competition screenshots before merging.
