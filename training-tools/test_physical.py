from pathlib import Path
import argparse
import sys

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(
        description="ORBIT AI physical holdout tester"
    )
    parser.add_argument("--model", required=True, help="Path to candidate .pt model")
    parser.add_argument("--image", required=True, help="Path to physical test image")
    parser.add_argument(
        "--conf",
        type=float,
        default=0.01,
        help="Minimum confidence to display (default: 0.01)",
    )
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    image_path = Path(args.image).resolve()

    if not model_path.is_file():
        sys.exit(f"ERROR: Model not found: {model_path}")

    if not image_path.is_file():
        sys.exit(f"ERROR: Image not found: {image_path}")

    print("=== ORBIT AI PHYSICAL HOLDOUT TEST ===")
    print(f"Model : {model_path}")
    print(f"Image : {image_path}")
    print(f"Conf  : {args.conf}")
    print()

    model = YOLO(str(model_path))

    result = model.predict(
        source=str(image_path),
        conf=args.conf,
        imgsz=args.imgsz,
        device=0,
        verbose=False,
    )[0]

    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        print("DETECTIONS: 0")
        print("No object detected above the requested confidence.")
        return

    detections = []

    for box in boxes:
        class_id = int(box.cls.item())
        confidence = float(box.conf.item())
        xyxy = [round(float(v), 1) for v in box.xyxy[0].tolist()]

        detections.append(
            (
                confidence,
                class_id,
                model.names[class_id],
                xyxy,
            )
        )

    detections.sort(reverse=True, key=lambda x: x[0])

    print(f"DETECTIONS: {len(detections)}")

    for confidence, class_id, class_name, xyxy in detections:
        print(
            f"{class_id} {class_name} | "
            f"confidence={confidence:.4f} | "
            f"box={xyxy}"
        )

    print()
    print("Physical holdout inference only.")
    print("No production model, database, or inventory was modified.")


if __name__ == "__main__":
    main()