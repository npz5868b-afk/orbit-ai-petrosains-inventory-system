# ORBIT AI detector and OCR model card

## Current status

ORBIT AI has a 109-item operational inventory catalog and a validated five-class real computer-vision prototype. The included `orbit_ai_5class_yolo11n_best.pt` detects T003 Screwdriver, T005 Measure Tape, L003 Beaker 250ml, E018 LED Red, and E019 LED Blue. It does not recognize all 109 catalog items.

RapidOCR 3.9.2 with ONNX Runtime CPU reads text only from padded YOLO bounding-box crops. OCR candidates are normalized and checked against the complete 109-item catalog. OCR is a verification signal: it never replaces YOLO, alters the visual confidence, or changes inventory.

## Verification policy

| OCR result | Verification status | Detection behavior |
|---|---|---|
| One valid SKU matching YOLO | `verified` | Keep the existing YOLO confidence policy |
| One valid SKU different from YOLO | `conflict` | Force Human Review and offer both catalog items |
| Multiple valid SKUs | `ambiguous` | Force Human Review |
| No readable candidate | `not_available` | Continue with the existing YOLO policy |
| Candidate absent from catalog | `invalid` | Do not treat it as verified; continue YOLO policy |
| OCR exception or timeout | `error` | Log internally and continue YOLO policy |

Inventory changes only after the existing review and confirmed transaction flow.

## Existing independent YOLO evaluation

The five-class model's supplied independent test results are preserved without modification:

| Class | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|
| Overall | 79.6% | 74.7% | 73.8% | 61.9% |
| T003 Screwdriver | .701 | 1.000 | .946 | .715 |
| T005 Measure Tape | .816 | 1.000 | .939 | .791 |
| L003 Beaker 250ml | .906 | .900 | .895 | .833 |
| E018 LED Red | .959 | .500 | .570 | .486 |
| E019 LED Blue | .598 | .333 | .341 | .269 |

These are model evaluation results, separate from the local Windows CPU latency benchmark. The weaker LED performance supports the visible Human Review path.

## Runtime evidence

Local measurements use the existing model, RapidOCR, Windows CPU execution, three excluded warm-ups, and 20 measured API scans. See `docs/performance/performance-report.md` and `benchmark-results.json` for hardware, package versions, summary statistics, per-run records, and evidence files.

The measured regression set confirms a T003 quantity of two with two bounding boxes, an E018 low-confidence Review Needed result, no-text OCR fallback, actual RapidOCR reading of a synthetic E018 label, and safe injected conflict handling.

## Known limitations

OCR depends on a visible SKU label inside or close to the YOLO crop. Small text, blur, glare, low light, rotation, occlusion, multiple nearby labels, and products without an applied Petrosains SKU commonly produce `not_available` or unrelated invalid candidates. OCR processing is currently the largest part of local CPU latency. A timed-out OCR worker is abandoned as a daemon thread so the API can return using YOLO; repeated engine hangs should trigger a process restart and investigation.

The model is still limited to five visual classes. False positives and red/blue LED confusion remain possible, so human confirmation and audit history remain required.
