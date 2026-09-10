# Work and decision log

| Date | Baseline | Work completed | Verification | Result |
|---|---|---|---|---|
| 2026-09-10 | `7b3598962358d3b83eab696f1c1136abada31144` | Repository/UI/service inspection and contract mismatch map | Source review and production baseline build | Complete |
| 2026-09-10 | workspace snapshot | FastAPI, SQLite schema/seed, inventory/store/activity APIs | Backend test suite | Complete |
| 2026-09-10 | workspace snapshot | Checkout, scan/review, Bulk Return, idempotency and sync | Atomicity/replay/conflict tests | Complete |
| 2026-09-10 | workspace snapshot | Official 109-item frontend integration and offline queue | TypeScript, production build, browser E2E | Complete |
| 2026-09-10 | official ZIPs/workbook | Full 2,788-photo and 30-room-photo audit | All images decoded; generated CSV/JSON/contact sheet | Complete |

## Decisions

| Decision | Reason | Impact |
|---|---|---|
| Keep Next.js UX structure | Frontend ownership and locked competition flow | Only data/action/state behavior changed |
| FastAPI + standard-library SQLite | Matches handoff and keeps local demo small | No ORM dependency; explicit SQL and transactions |
| Local detector interface | Store 3/4 must work without internet | Mock and optional Ultralytics use one REST contract |
| Human confirmation before writes | Responsible AI and recovery requirements | AI output remains a proposal with audit evidence |
| Pack/Box remain their own base units | Source provides no item-per-pack conversion | Prevents invented quantity math |
| Workbook Image reference precedes folder code | Six craft folder codes are shifted | Official SKU stays the system identifier |
| Duplicate component stays in one split | Reduces leakage | Split is conservative; every class has validation/test coverage |

## Blockers

| Blocker | Evidence | Required input | Status |
|---|---|---|---|
| Real detector training/evaluation | No bounding boxes, counts, negatives, license/capture metadata or weights | Reviewed annotation set and target demo hardware | Open, documented |
| Remote branch/push | Private repo CLI has no credential and source was obtained as commit-matched archive | Repository owner authenticates Git CLI or approves browser/GCM login | Open; local implementation complete |
