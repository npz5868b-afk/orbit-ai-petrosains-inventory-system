# ORBIT AI detector model card

## Current status

The running competition prototype uses `mock-v1`, a deterministic detector fixture behind the production detector interface. It exists to prove scan → confidence policy → human review → atomic return → audit history end to end. It is clearly reported as Mock mode by `/api/health` and does not claim visual recognition accuracy.

`backend/app/detectors/real.py` provides the contract-compatible local Ultralytics adapter. There are no approved weights in this repository.

## Intended task

Detect and count one or more of the 109 official Petrosains inventory classes in a camera frame. The model proposes evidence only. Unknown or uncertain detections require a person to confirm, choose another item, rescan, or reject before inventory can change.

## Data readiness

The supplied 2,788 images are all readable and cover 109 class folders, but 1,096 `.jpg` filenames contain HEIC data. The audit found 101 exact-duplicate groups covering 226 files and conservatively groups additional perceptual similarities. Six craft folder codes differ from official workbook SKUs and are resolved through the workbook image reference.

The source lacks bounding boxes, instance counts, negative scenes, capture-session metadata, annotator review, and an explicit dataset license/permission record. Real model training and honest precision/recall/mAP/counting claims are pending these inputs.

## Evaluation contract

- Freeze `docs/data-audit/class-dictionary.json` and `split-manifest.csv`.
- Validate JSONL evidence with `validate_annotations.py`.
- Report per-class precision, recall, mAP50, mAP50-95, empty-scene false positives, counting MAE, exact-count accuracy, and end-to-end latency on the demo device.
- Record model version, image size, epochs, seed, hardware, package versions, and best-weights checksum.
- Calibrate ready/review/unknown thresholds from held-out confidence/outcome pairs. Current `0.85/0.60` values are starting values only.

## Known risks

Lookalikes include red/blue LEDs, N20 motors, rocker switches, jumper-wire genders, lab glassware capacities, pipette/syringe sizes, gloves, markers, and glue products. Small printed labels, transparent objects, glare, packaging, overlapping items, and storeroom clutter can reduce reliability. Review remains visible and auditable by design.
