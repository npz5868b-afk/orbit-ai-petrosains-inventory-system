from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


CLASSES = [
    "T003 Screwdriver",
    "T005 Measure Tape",
    "L003 Beaker 250ml",
    "E018 LED Red",
    "E019 LED Blue",
]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass
class Box:
    class_id: int
    x1: int
    y1: int
    x2: int
    y2: int


def image_files(root: Path) -> list[Path]:
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def label_path(image: Path, images_root: Path, labels_root: Path) -> Path:
    relative = image.relative_to(images_root)
    return labels_root / relative.with_suffix(".txt")


def load_boxes(label_file: Path, width: int, height: int) -> list[Box]:
    if not label_file.exists():
        return []
    boxes: list[Box] = []
    for line in label_file.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if len(parts) != 5:
            continue
        class_id = int(float(parts[0]))
        x_center, y_center, box_w, box_h = [float(value) for value in parts[1:]]
        x1 = int((x_center - box_w / 2) * width)
        y1 = int((y_center - box_h / 2) * height)
        x2 = int((x_center + box_w / 2) * width)
        y2 = int((y_center + box_h / 2) * height)
        boxes.append(Box(class_id, x1, y1, x2, y2))
    return boxes


def save_boxes(label_file: Path, boxes: list[Box], width: int, height: int) -> None:
    label_file.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for box in boxes:
        x1, x2 = sorted((max(0, box.x1), min(width, box.x2)))
        y1, y2 = sorted((max(0, box.y1), min(height, box.y2)))
        if x2 <= x1 or y2 <= y1:
            continue
        x_center = ((x1 + x2) / 2) / width
        y_center = ((y1 + y2) / 2) / height
        box_w = (x2 - x1) / width
        box_h = (y2 - y1) / height
        lines.append(
            f"{box.class_id} {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}"
        )
    label_file.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def draw_overlay(cv2, frame, boxes: list[Box], current_class: int, image_name: str, index: int, total: int):
    colours = [
        (80, 220, 255),
        (60, 180, 255),
        (120, 255, 160),
        (80, 80, 255),
        (255, 120, 80),
    ]
    for box in boxes:
        colour = colours[box.class_id % len(colours)]
        cv2.rectangle(frame, (box.x1, box.y1), (box.x2, box.y2), colour, 2)
        cv2.putText(
            frame,
            f"{box.class_id} {CLASSES[box.class_id]}",
            (box.x1, max(22, box.y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            colour,
            2,
            cv2.LINE_AA,
        )

    header = f"{index + 1}/{total} {image_name} | class {current_class}: {CLASSES[current_class]}"
    footer = "Drag=box | 0-4 class | u undo | s save next | n skip | b back | q quit"
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 34), (10, 18, 28), -1)
    cv2.putText(frame, header, (10, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (230, 245, 255), 2)
    cv2.rectangle(frame, (0, frame.shape[0] - 34), (frame.shape[1], frame.shape[0]), (10, 18, 28), -1)
    cv2.putText(frame, footer, (10, frame.shape[0] - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (230, 245, 255), 1)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Quick OpenCV YOLO annotator for ORBIT AI final-day photos."
    )
    parser.add_argument("--images", required=True, help="Folder containing images to annotate")
    parser.add_argument("--labels", required=True, help="Output folder for YOLO .txt labels")
    parser.add_argument("--start-class", type=int, default=0, choices=range(5))
    parser.add_argument("--max-width", type=int, default=1280)
    parser.add_argument("--max-height", type=int, default=820)
    args = parser.parse_args()

    import cv2

    images_root = Path(args.images).resolve()
    labels_root = Path(args.labels).resolve()
    images = image_files(images_root)
    if not images:
        raise SystemExit(f"ERROR: No images found under {images_root}")

    current_class = args.start_class
    index = 0
    window = "ORBIT AI YOLO Annotator"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)

    while 0 <= index < len(images):
        image_path = images[index]
        original = cv2.imread(str(image_path))
        if original is None:
            print(f"SKIP unreadable image: {image_path}")
            index += 1
            continue

        height, width = original.shape[:2]
        scale = min(args.max_width / width, args.max_height / height, 1.0)
        display_size = (int(width * scale), int(height * scale))
        label_file = label_path(image_path, images_root, labels_root)
        boxes = load_boxes(label_file, width, height)
        drawing = {"active": False, "start": (0, 0), "end": (0, 0)}

        def to_original(point: tuple[int, int]) -> tuple[int, int]:
            return int(point[0] / scale), int(point[1] / scale)

        def mouse(event, x, y, _flags, _param):
            if event == cv2.EVENT_LBUTTONDOWN:
                drawing.update({"active": True, "start": (x, y), "end": (x, y)})
            elif event == cv2.EVENT_MOUSEMOVE and drawing["active"]:
                drawing["end"] = (x, y)
            elif event == cv2.EVENT_LBUTTONUP and drawing["active"]:
                drawing["active"] = False
                start = to_original(drawing["start"])
                end = to_original((x, y))
                if abs(start[0] - end[0]) > 4 and abs(start[1] - end[1]) > 4:
                    boxes.append(Box(current_class, start[0], start[1], end[0], end[1]))

        cv2.setMouseCallback(window, mouse)

        while True:
            frame = cv2.resize(original, display_size, interpolation=cv2.INTER_AREA)
            scaled_boxes = [
                Box(
                    box.class_id,
                    int(box.x1 * scale),
                    int(box.y1 * scale),
                    int(box.x2 * scale),
                    int(box.y2 * scale),
                )
                for box in boxes
            ]
            if drawing["active"]:
                cv2.rectangle(frame, drawing["start"], drawing["end"], (255, 255, 255), 1)
            draw_overlay(cv2, frame, scaled_boxes, current_class, image_path.name, index, len(images))
            cv2.imshow(window, frame)
            key = cv2.waitKey(30) & 0xFF
            if key in [ord(str(i)) for i in range(5)]:
                current_class = int(chr(key))
            elif key == ord("u"):
                if boxes:
                    boxes.pop()
            elif key == ord("s"):
                save_boxes(label_file, boxes, width, height)
                print(f"SAVED {label_file} ({len(boxes)} boxes)")
                index += 1
                break
            elif key == ord("n"):
                print(f"SKIP {image_path}")
                index += 1
                break
            elif key == ord("b"):
                index = max(0, index - 1)
                break
            elif key == ord("q") or key == 27:
                cv2.destroyAllWindows()
                return

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
