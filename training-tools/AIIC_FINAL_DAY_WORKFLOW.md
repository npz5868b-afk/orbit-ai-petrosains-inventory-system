# ORBIT AI Final-Day Computer Vision Workflow

This workflow is for improving the five-class ORBIT AI YOLO detector with new real-world, natural multi-item photos. It does not modify production weights, backend APIs, database schema, thresholds, or transaction behavior.

## Fixed Class Mapping

Do not change this order:

```text
0 T003 Screwdriver
1 T005 Measure Tape
2 L003 Beaker 250ml
3 E018 LED Red
4 E019 LED Blue
```

## Golden Rules

- Keep physical holdout images untouched and out of training.
- Only merge manually labelled training images into a candidate dataset.
- Never overwrite `backend/models/orbit_ai_5class_yolo11n_best.pt` during final-day experiments.
- Candidate weights belong in `weights/candidates/`.
- Validate on the dataset test split and separately test untouched physical holdout photos.

## 1. Create a Final-Day Workspace

```powershell
.\.venv-train\Scripts\python.exe training-tools\final_day_dataset.py init --workspace aiic-final-day
```

This creates:

```text
aiic-final-day/
  raw/train/
  raw/physical-holdout/
  labels/train/
  candidate-datasets/
  reports/
```

## 2. Ingest New Photos

Training photos:

```powershell
.\.venv-train\Scripts\python.exe training-tools\final_day_dataset.py ingest `
  --src C:\path\to\new-train-photos `
  --workspace aiic-final-day `
  --bucket train
```

Physical holdout photos:

```powershell
.\.venv-train\Scripts\python.exe training-tools\final_day_dataset.py ingest `
  --src C:\path\to\physical-holdout-photos `
  --workspace aiic-final-day `
  --bucket physical-holdout
```

Do not annotate or train on `raw/physical-holdout`.

## 3. Manually Annotate Training Images

```powershell
.\.venv-train\Scripts\python.exe training-tools\annotate_yolo.py `
  --images aiic-final-day\raw\train `
  --labels aiic-final-day\labels\train
```

Annotator controls:

- Drag mouse: draw bounding box
- `0`-`4`: select class
- `u`: undo last box
- `s`: save labels and move next
- `n`: skip image
- `b`: previous image
- `q`: quit

## 4. Build a Candidate Dataset

Use the existing YOLO Ready dataset `data.yaml` as the source. The script copies the Ready train/val/test splits plus only labelled final-day training images into a new isolated candidate dataset.

```powershell
.\.venv-train\Scripts\python.exe training-tools\final_day_dataset.py build `
  --ready-data C:\path\to\YOLO_READY\data.yaml `
  --workspace aiic-final-day `
  --name finals-candidate-001
```

Output:

```text
aiic-final-day/candidate-datasets/finals-candidate-001/data.yaml
aiic-final-day/reports/finals-candidate-001-dataset-report.md
```

The original Ready dataset is not modified.

## 5. Train Candidate Weights

```powershell
.\.venv-train\Scripts\python.exe training-tools\train_aiic.py `
  --data aiic-final-day\candidate-datasets\finals-candidate-001\data.yaml `
  --model yolo11n.pt `
  --epochs 40 `
  --batch 16 `
  --imgsz 640 `
  --name finals-candidate-001
```

Candidate output:

```text
weights/candidates/finals-candidate-001-best.pt
```

Production weights are not modified.

## 6. Validate on Dataset Test Split

```powershell
.\.venv-train\Scripts\python.exe training-tools\validate_aiic.py `
  --model weights\candidates\finals-candidate-001-best.pt `
  --data aiic-final-day\candidate-datasets\finals-candidate-001\data.yaml `
  --split test
```

## 7. Test Untouched Physical Holdout Folder

```powershell
.\.venv-train\Scripts\python.exe training-tools\test_physical.py `
  --model weights\candidates\finals-candidate-001-best.pt `
  --folder aiic-final-day\raw\physical-holdout `
  --conf 0.01
```

The report prints each image, detected classes, confidence, detection count, missed images, and likely duplicate detections.

## 8. Production Promotion

Do not promote a candidate during this workflow. Promotion should be a separate reviewed step after Finals testing. The backend production detector continues to use:

```text
backend/models/orbit_ai_5class_yolo11n_best.pt
```
