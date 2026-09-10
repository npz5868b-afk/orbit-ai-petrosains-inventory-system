# Backend and frontend integration report

## Baseline and boundary

The implementation started from the private repository snapshot at commit `7b3598962358d3b83eab696f1c1136abada31144` (`Finalize ORBIT AI frontend`). The existing Next.js page structure, labels, navigation, and locked Bulk Return sequence were preserved. Backend, persistence, detector normalization, review decisions, transactions, offline queue, tests, and technical documentation were added.

The source snapshot did not include Git metadata because command-line authentication to the private repository was unavailable. The work is complete in this workspace; remote branch creation/push remains a delivery action.

## Frontend integration map

| Frontend area | File / function | API | Behavior |
|---|---|---|---|
| Shell connection count | `components/app-shell.tsx` | `GET /api/stores` | Uses official fallback, then live status |
| Inventory list | `components/inventory/inventory-browser.tsx` | `GET /api/inventory` | 109-item fallback; live refresh after transactions |
| Item detail | `components/inventory/item-detail.tsx` | `GET /api/inventory/{id}` | Refreshes persisted quantity |
| Store status | `components/system/system-overview.tsx` | `GET /api/stores` | Shows two connected and two offline-design locations |
| Checkout | `components/scan/checkout-flow.tsx` | `POST /api/transactions/checkout` | Stable UUID, atomic update, offline enqueue |
| Start scan | `components/scan/bulk-return-flow.tsx` | `POST /api/scans` | Receives normalized items only |
| Review | `components/scan/bulk-return-flow.tsx` | `POST /api/scans/{scan}/reviews/{detection}` | Saves selected official item and audit evidence |
| Confirm return | `components/scan/bulk-return-flow.tsx` | `POST /api/transactions/returns` | Exactly-once stock update and before/after screen |
| Activity | `components/activity/activity-timeline.tsx` | `GET /api/activity` | Reads persisted server events |
| Offline sync | `lib/offline-queue.ts` | `POST /api/sync` | Ordered queue; retains failed/conflicted operations |

## Contract corrections

- Replaced eight invented catalog examples with all 109 official items and five official category names.
- Replaced invented SKU formats with official codes such as `T003`, `L003`, and `E018`.
- Corrected Store 3 and Store 4 to offline-design locations; Store 1 and Store 2 are connected.
- Mapped workbook locations to fact-sheet rooms: `STORE 1 → store-1`, `MAKER STUDIO → store-2`, `CHEMICAL ROOM → store-3`, `CHILLAX → store-4`. This mapping is recorded as an evidence-based operational inference and should be confirmed by the owner.
- Kept Pack and Box as their own base units with conversion `1`; no unsupported Pack/Box-to-individual conversion is invented.
- Changed scan confidence from UI percentages to API decimals in `[0,1]`, then mapped back to display percentages at the UI boundary.
- Removed raw detector objects from the frontend contract.

## Safety properties

- SQLite foreign keys, checks, WAL, busy timeout, and `BEGIN IMMEDIATE` protect local writes.
- Multi-line transactions validate every line before any stock update and roll back on error.
- A return cannot use an unresolved, expired, mismatched, or previously confirmed scan.
- Same idempotency ID and payload replays the stored response; a different payload returns `IDEMPOTENCY_CONFLICT`.
- Good returns cannot exceed total stock. Damaged/unknown conditions are audited without adding available stock.
- Errors expose a stable code and trace ID while omitting request contents and internal stack traces.
- JPEG/PNG type and size are validated; filenames and client paths are never trusted or persisted.
