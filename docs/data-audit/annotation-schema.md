# Detection annotation contract

Use YOLO normalized bounding boxes for model training and retain a parallel JSONL evidence file.

Each YOLO label line is `class_index x_center y_center width height`, with every coordinate in `[0, 1]`. `class_index` is fixed by `class-dictionary.json`; never infer it from folder order at training time.

The JSONL evidence record must include `image_id`, `source_member_path`, `sha256`, `capture_group`, `split`, `width`, `height`, `objects`, `is_negative`, `annotator`, `reviewer`, `annotation_version`, and `license_or_permission`. Each object includes `official_sku`, `bbox_xywh_normalized`, `condition`, `occluded`, `truncated`, and optional `notes`.

Reject labels with an unknown SKU, non-positive box area, coordinates outside the image, duplicate boxes, unreadable source images, or a split that differs from `split-manifest.csv`. Empty target scenes must have `is_negative: true` and an empty object list.
