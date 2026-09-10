# Storeroom and offline requirements

The official fact-sheet folders contain **30** photos across four locations:

- **Store 1 — Store Level 4:** connected deployment; local API/database still keeps the demo independent of internet access.
- **Store 2 — Edustore / Maker Studio:** connected deployment; same local-first transaction path.
- **Store 3 — Chemical Room:** no-internet operating case. Scanning, review, checkout, return, and SQLite commits must work on the device/LAN without cloud inference.
- **Store 4 — Store Concourse / Chillax:** underground/no-internet operating case with the same local-first requirement.

Operational implications derived from the supplied room photos and challenge brief: expect shelves, drawers, cabinets, bins, clutter, reflective packaging/glass, small components, variable distance and lighting, narrow aisles, and partially hidden labels. The camera workflow needs a close-up/retry path, explicit store selection, review before quantity changes, and a device queue for any later cross-site synchronization. Model weights, class mapping, thresholds, and the SQLite database must be available locally.

The contact sheet `storeroom-contact-sheet.jpg` and `storeroom-manifest.csv` retain the visual evidence used for this architecture review.
