# Official resource audit

Generated from the four official submission archives and inventory workbook. No inventory image is copied into the repository.

## Fixed facts and coverage

- Official inventory records: **109**
- Official categories: **5** (Laboratory & Science Supplies: 26, Electronics & Robotics: 30, Craft Materials & STEM Kits: 23, Stationery & Office Supplies: 15, Tools & Equipment: 15)
- Inventory photo folders: **109**
- Inventory photos: **2788**
- Readable images: **2788**; unreadable: **0**
- Extension/signature mismatches: **1096** (readable files that need conversion/renaming before common training tools)
- Detected formats: heic: 2097, jpeg: 691
- Exact-duplicate groups: **101**, covering **226** files
- Exact or perceptual duplicate components: **113**
- Leakage-controlled split: train 1983, validation 406, test 399

## Mapping findings

All photo folders are mapped through the workbook's `Image` reference before falling back to the folder code. **6** folders have a folder code that does not equal the official SKU. This includes the shifted C018–C023 craft-photo codes. The API and detector class dictionary use the official workbook SKU; the source folder name is retained for traceability.

## What the photographs can support now

The folders provide image-level class labels and are useful for catalog classification, data exploration, and assisted pre-annotation. They do **not** include bounding boxes, instance masks, per-image counts, capture-session IDs, or negative-scene labels. A multi-object detector/counting model cannot be evaluated honestly until those labels and held-out multi-item scenes exist.

Automated image checks cover readability, format/signature, resolution, brightness, contrast, edge-detail proxy, exact duplicates, perceptual duplicates, class balance, and split leakage. Item size, angle, background complexity, occlusion, packaging variation, and label visibility remain marked for human visual review; the script does not pretend to infer them reliably.

## Required next collection/annotation work

1. Convert approved HEIC images to a training format without overwriting originals.
2. Annotate every visible target instance with a bounding box and official SKU class.
3. Add empty and distractor storeroom scenes with no target items.
4. Add mixed-item scenes, repeated same-class counts, overlap, glare, poor light, distance, and partial occlusion.
5. Review duplicate components before labeling and keep every component in one split.
6. Record capture session, source person/device, license/permission, and annotation reviewer.
7. Freeze the generated class dictionary and split manifest before training.

The exact evidence is in `class-audit.csv`, `file-manifest.csv`, `duplicate-groups.csv`, `split-manifest.csv`, `class-dictionary.json`, and `lookalike-groups.json`.
