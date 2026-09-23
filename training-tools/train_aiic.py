from pathlib import Path
import argparse
import shutil
import sys

import torch
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(
        description="ORBIT AI rapid YOLO training tool"
    )
    parser.add_argument("--data", required=True, help="Path to YOLO data.yaml")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--name", default="aiic-candidate")
    args = parser.parse_args()

    data = Path(args.data).resolve()

    if not data.is_file():
        sys.exit(f"ERROR: Dataset YAML not found: {data}")

    if not torch.cuda.is_available():
        sys.exit("ERROR: CUDA GPU is not available. Training aborted.")

    print("=== ORBIT AI RAPID TRAINING ===")
    print(f"Dataset : {data}")
    print(f"GPU     : {torch.cuda.get_device_name(0)}")
    print(f"Model   : {args.model}")
    print(f"Epochs  : {args.epochs}")
    print(f"Batch   : {args.batch}")
    print(f"Image   : {args.imgsz}")
    print()
    print("IMPORTANT: This tool creates a candidate model only.")
    print("It will NOT overwrite the ORBIT production model.")
    print()

    model = YOLO(args.model)

    result = model.train(
        data=str(data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=0,
        workers=0,
        amp=True,
        project="runs/aiic-training",
        name=args.name,
        exist_ok=True,
        plots=True,
    )

    best = Path(result.save_dir) / "weights" / "best.pt"

    if not best.is_file():
        sys.exit(
            f"ERROR: Training finished but best.pt was not found: {best}"
        )

    candidate_dir = Path("weights/candidates")
    candidate_dir.mkdir(parents=True, exist_ok=True)

    candidate = candidate_dir / f"{args.name}-best.pt"
    shutil.copy2(best, candidate)

    print()
    print("=== TRAINING COMPLETE ===")
    print(f"Candidate model: {candidate.resolve()}")
    print("Production model was NOT modified.")
    print("Next step: validate this candidate before deployment.")


if __name__ == "__main__":
    main()