from pathlib import Path
import argparse
import sys

import torch
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(
        description="ORBIT AI candidate model validator"
    )
    parser.add_argument("--model", required=True, help="Candidate .pt model")
    parser.add_argument("--data", required=True, help="Path to YOLO data.yaml")
    parser.add_argument("--split", default="test")
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    data_path = Path(args.data).resolve()

    if not model_path.is_file():
        sys.exit(f"ERROR: Model not found: {model_path}")

    if not data_path.is_file():
        sys.exit(f"ERROR: Dataset YAML not found: {data_path}")

    if not torch.cuda.is_available():
        sys.exit("ERROR: CUDA GPU is not available.")

    print("=== ORBIT AI CANDIDATE VALIDATION ===")
    print(f"Model   : {model_path}")
    print(f"Dataset : {data_path}")
    print(f"Split   : {args.split}")
    print(f"GPU     : {torch.cuda.get_device_name(0)}")
    print()

    model = YOLO(str(model_path))

    results = model.val(
        data=str(data_path),
        split=args.split,
        imgsz=args.imgsz,
        batch=args.batch,
        device=0,
        workers=0,
        plots=False,
    )

    print()
    print("=== VALIDATION SUMMARY ===")
    print(f"Precision : {results.box.mp:.4f}")
    print(f"Recall    : {results.box.mr:.4f}")
    print(f"mAP50     : {results.box.map50:.4f}")
    print(f"mAP50-95  : {results.box.map:.4f}")
    print()
    print("Validation only. No production model was modified.")


if __name__ == "__main__":
    main()