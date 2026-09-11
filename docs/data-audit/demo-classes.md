\# ORBIT AI — Demo Computer Vision Classes



\## Scope



For the first real computer-vision prototype, ORBIT AI will train and evaluate only the following 5 demo classes.



The goal is to prove the complete Bulk Return workflow reliably before expanding to all 109 inventory classes.



\## Selected Demo Classes



| SKU | Item | Official Photos | Reason |

|---|---|---:|---|

| T003 | Screwdriver | 42 | Already used in ORBIT Bulk Return demo; visually distinctive and has enough images |

| T005 | Measure Tape | 47 | Already used in ORBIT Bulk Return demo; strong photo coverage |

| L003 | Beaker 250ml | 60 | Already used in ORBIT Bulk Return demo; strongest photo coverage among selected classes |

| E018 | LED Red | 22 | Important lookalike case for human review |

| E019 | LED Blue | 20 | Visually similar to LED Red; useful for uncertainty and Review Needed |



\## Why These 5 Classes



These classes directly match the current ORBIT Bulk Return demo:



\- Screwdriver

\- Measure Tape

\- Beaker 250ml

\- LED Red

\- LED Blue



This allows the real detector to replace the existing deterministic Mock AI without changing the frontend workflow or REST API contract.



The first goal is NOT to claim support for all 109 inventory classes.



The first goal is to demonstrate:



Camera / Image

→ Multi-object detection

→ Item classification

→ Counting

→ Confidence

→ Human Review when uncertain

→ Return Summary

→ User Confirmation

→ Inventory Update



\## Lookalike Test



LED Red and LED Blue are intentionally kept as separate classes.



They will be used to test:



\- visually similar object recognition

\- confidence uncertainty

\- possible matches

\- Review Needed

\- human confirmation

\- auditability



The model should not silently force a prediction when confidence is insufficient.



\## Dataset Notes



Current official-image counts:



\- T003 Screwdriver: 42

\- T005 Measure Tape: 47

\- L003 Beaker 250ml: 60

\- E018 LED Red: 22

\- E019 LED Blue: 20



Total official source images for the 5-class demo scope:



191 images



Important:



The official images currently provide image-level class information only.



They do not yet provide:



\- bounding boxes

\- object-count labels

\- negative-scene labels

\- mixed-item scene annotations

\- capture-session metadata



Therefore the official image set must NOT be presented as a finished object-detection dataset.



\## Beaker 250ml Format Warning



All 60 official L003 Beaker 250ml files are recorded with a format/signature mismatch in the resource audit.



Before annotation/training:



\- preserve the originals

\- create converted training copies

\- use JPEG or PNG

\- verify every converted image is readable

\- do not overwrite the official source files



\## Phase 1 Demo Dataset Requirements



Before training the 5-class detector:



\- \[ ] Locate all official source images for the 5 selected classes

\- \[ ] Create training-format copies

\- \[ ] Convert incompatible HEIC / format-mismatch files

\- \[ ] Keep original source images untouched

\- \[ ] Annotate every visible target object with bounding boxes

\- \[ ] Use official SKU as the class identity

\- \[ ] Add negative images containing none of the 5 target classes

\- \[ ] Add mixed-item scenes

\- \[ ] Add repeated same-class objects for counting

\- \[ ] Include overlap and partial occlusion

\- \[ ] Include different distances and angles

\- \[ ] Include poor-light / glare examples where practical

\- \[ ] Review annotations manually

\- \[ ] Prevent duplicate leakage between train / validation / test

\- \[ ] Freeze the final split before reporting metrics



\## Class IDs



Proposed detector class order:



0 — T003 — Screwdriver  

1 — T005 — Measure Tape  

2 — L003 — Beaker 250ml  

3 — E018 — LED Red  

4 — E019 — LED Blue  



Do not change the class order after training starts unless the dataset/model version is changed and documented.



\## Success Criteria



The first real detector is considered demo-ready only if it can:



\- detect more than one item in the same image

\- identify the selected class

\- count repeated objects

\- return normalized bounding boxes

\- return confidence scores

\- distinguish or appropriately flag LED Red vs LED Blue

\- return uncertain cases to Human Review

\- avoid changing inventory directly

\- integrate through the existing ORBIT detector adapter

\- preserve the existing frontend/API contract



\## Expansion Rule



Only after this 5-class workflow works end-to-end should the team expand to more inventory classes.



Priority after the first 5 may include:



\- Arduino Uno

\- HC-SR04 Ultrasonic Sensor

\- Infrared Proximity Sensor

\- additional tools

\- additional laboratory items



Expansion should be evidence-driven, not done only to increase the number of classes.



