from pathlib import Path
import argparse
import sys


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def image_files(folder: Path) -> list[Path]:
    return sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def box_area(box: list[float]) -> float:
    return max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1])


def duplicate_score(box_a: list[float], box_b: list[float]) -> tuple[float, float]:
    x1 = max(box_a[0], box_b[0])
    y1 = max(box_a[1], box_b[1])
    x2 = min(box_a[2], box_b[2])
    y2 = min(box_a[3], box_b[3])
    intersection = box_area([x1, y1, x2, y2])
    area_a = box_area(box_a)
    area_b = box_area(box_b)
    union = area_a + area_b - intersection
    iou = intersection / union if union else 0.0
    smaller = min(area_a, area_b)
    contained = intersection / smaller if smaller else 0.0
    return iou, contained


def main():
    parser = argparse.ArgumentParser(
        description="ORBIT AI physical holdout tester"
    )
    parser.add_argument("--model", required=True, help="Path to candidate .pt model")
    parser.add_argument("--image", help="Path to one physical test image")
    parser.add_argument("--folder", help="Folder of untouched physical holdout images")
    parser.add_argument(
        "--conf",
        type=float,
        default=0.01,
        help="Minimum confidence to display (default: 0.01)",
    )
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", default="0")
    parser.add_argument("--duplicate-iou", type=float, default=0.70)
    parser.add_argument("--duplicate-contained", type=float, default=0.80)
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    image_path = Path(args.image).resolve() if args.image else None
    folder_path = Path(args.folder).resolve() if args.folder else None

    if not model_path.is_file():
        sys.exit(f"ERROR: Model not found: {model_path}")

    if bool(image_path) == bool(folder_path):
        sys.exit("ERROR: Provide exactly one of --image or --folder")

    if image_path and not image_path.is_file():
        sys.exit(f"ERROR: Image not found: {image_path}")

    if folder_path and not folder_path.is_dir():
        sys.exit(f"ERROR: Folder not found: {folder_path}")

    images = [image_path] if image_path else image_files(folder_path)
    if not images:
        sys.exit("ERROR: No physical holdout images found")

    from ultralytics import YOLO

    print("=== ORBIT AI PHYSICAL HOLDOUT TEST ===")
    print(f"Model : {model_path}")
    if image_path:
        print(f"Image : {image_path}")
    else:
        print(f"Folder: {folder_path}")
    print(f"Conf  : {args.conf}")
    print()

    model = YOLO(str(model_path))
    missed: list[Path] = []
    duplicate_rows: list[str] = []
    total_detections = 0

    for image in images:
        result = model.predict(
            source=str(image),
            conf=args.conf,
            imgsz=args.imgsz,
            device=args.device,
            verbose=False,
        )[0]

        boxes = result.boxes

        if boxes is None or len(boxes) == 0:
            missed.append(image)
            print(f"{image.name} | detections=0 | MISS")
            continue

        detections = []

        for box in boxes:
            class_id = int(box.cls.item())
            confidence = float(box.conf.item())
            xyxy = [float(v) for v in box.xyxy[0].tolist()]

            detections.append(
                {
                    "confidence": confidence,
                    "class_id": class_id,
                    "class_name": model.names[class_id],
                    "xyxy": xyxy,
                }
            )

        detections.sort(reverse=True, key=lambda row: row["confidence"])
        total_detections += len(detections)
        classes = ", ".join(
            f"{row['class_id']} {row['class_name']} {row['confidence']:.3f}"
            for row in detections
        )
        duplicate_count = 0
        for index, first in enumerate(detections):
            for second in detections[index + 1:]:
                if first["class_id"] != second["class_id"]:
                    continue
                iou, contained = duplicate_score(first["xyxy"], second["xyxy"])
                if iou >= args.duplicate_iou or contained >= args.duplicate_contained:
                    duplicate_count += 1
        if duplicate_count:
            duplicate_rows.append(image.name)
        print(
            f"{image.name} | detections={len(detections)} | "
            f"duplicates={duplicate_count} | {classes}"
        )
        if image_path:
            for row in detections:
                xyxy = [round(value, 1) for value in row["xyxy"]]
                print(
                    f"  {row['class_id']} {row['class_name']} | "
                    f"confidence={row['confidence']:.4f} | box={xyxy}"
                )

    print()
    print("=== PHYSICAL HOLDOUT SUMMARY ===")
    print(f"Images checked        : {len(images)}")
    print(f"Total detections      : {total_detections}")
    print(f"Missed images         : {len(missed)}")
    for image in missed:
        print(f"  MISS {image.name}")
    print(f"Images with duplicates: {len(duplicate_rows)}")
    for image_name in duplicate_rows:
        print(f"  DUPLICATE {image_name}")

    print("Physical holdout inference only.")
    print("No production model, database, or inventory was modified.")


if __name__ == "__main__":
    main()
