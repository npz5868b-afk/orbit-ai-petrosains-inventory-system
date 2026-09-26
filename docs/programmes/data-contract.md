# Programme catalogue B1 data contract — v1.0.0

This is an ingestion contract, not an operational feasibility decision. The authoritative input is the original workbook identified by SHA-256 in `backend/data/programmes/source_manifest.json`. The original workbook is never saved by the importer. No stock, bookings, personnel, venue evidence or safety approvals are created.

## Files and future TypeScript consumption

All paths below are relative to the repository root. These are ordinary UTF-8 JSON files; a future TypeScript core can consume them without Python or an external LLM. No browser, Next API, recommendation logic or inventory adapter is implemented in B1.

| File under `backend/data/programmes/` | Purpose |
| --- | --- |
| `source_manifest.json` | Input identity, acquisition/source URLs, ordered workbook sheets, layouts and generated-file SHA-256 digests |
| `programme_offerings.json` | All 21 source master records and original field names |
| `programme_theme_mapping.json` | All 25 mappings, explicitly supporting guidance rather than fixed recommendations |
| `programme_constraints.json` | All 12 complete source rule texts; not executable rules yet |
| `programme_dictionary.json` | All 14 dictionary rows and Participant_README cell text |
| `programme_materials.json` | All 21 ACT sheets, candidate rows, source quantity contexts, notes and ambiguous rows |
| `import_audit.json` | Counts, source-located issues, formulas/caches, Excel errors and limitations |

Start with the manifest, dictionary and audit before consuming other files. Join offerings by the exact `Offering_ID` string. Join material sheets and rows by their explicit `Offering_ID`; never by a corrected title. A record has `source.sheet` and `source.row`; each field has a source cell. The document's `source_sha256` resolves the workbook identity through the manifest. This yields workbook → sheet → row/cell provenance without repeating a filename on every cell.

## Cell envelope and special states

Master/mapping/constraint/dictionary records contain `fields[originalColumnName]`. Each cell envelope has:

```json
{"cell":"Q2","raw_value":"Optional","value":"Optional","state":"optional","cell_type":"s"}
```

This is a schema illustration; the cell address is not an assertion about a particular original value. `raw_value` is the original Excel scalar or formula string. `value` is the same scalar, except for formulas where it is the stored cache. Native numeric values remain numeric; textual quantities, punctuation, whitespace, units, titles and apparent typos remain text. Dates, if encountered, are serialized as ISO strings. Formatting, drawings and unsupported Excel extensions are not exported. This is preservation of cell data, not a byte-for-byte or visual workbook conversion.

| Source | `state` | Meaning/consumer obligation |
| --- | --- | --- |
| Empty/missing cell | `blank`, value `null` | No supplied value; never substitute zero or false |
| Empty string / whitespace string | `empty_text` / `whitespace_text` | Retained separately where the reader exposes such text |
| `Unknown` | `unknown` | Dictionary: expected information is unavailable |
| `N/A` | `not_applicable` | Dictionary: field does not apply |
| `To be validated` | `to_be_validated` | Dictionary: data has not been confirmed for competition use |
| `Optional` | `optional` | Exact lexical value retained; not equivalent to required or verified offline readiness |
| `No` / `Yes` | `no` / `yes` | Source text retained; no boolean coercion |
| Numeric 0 | `zero` | Actual numeric zero, not missing evidence |
| Native boolean | `boolean` | Remains a boolean, distinct from numeric zero |
| Other number | `number` | No inferred units, meaning or validation status |
| `TBC`, `To be confirmed`, `NIL` | `undefined_placeholder` | Not defined by the supplied dictionary; preserved and flagged for confirmation |
| Other string | `text` | No guessed enumeration or normalization |
| Excel error | `excel_error` | Error string retained, never converted to zero |

The dictionary explicitly defines only three special markers: `Unknown`, `N/A`, `To be validated`. Other tags above are importer lexical tags, not additions to the official dictionary. Exact official markers use exact matching; the original text is never stripped or replaced. There is no generic truthiness conversion. Audit source-state counts cover populated source cells, not the synthetic blank envelopes used for absent fields.

## Formulas

The importer opens the same file twice in read-only mode: `data_only=False` for original formulas and `data_only=True` for stored caches. A formula has `formula`, `raw_value`, `value`, `cache_status` (`present`, `missing`, `error`) and `recalculated: false`. Missing caches have `value: null`, `state: formula_cache_missing` and a source-located issue. A present cache can be stale. No formula engine is run, and structural import success is never a claim of calculation or operational success.

For this source, 17 formulas have numeric caches; none is missing. The caches are preserved, not recalculated or confirmed as current. All 34 source `#VALUE!` errors occur in photo/image columns and are retained in the audit. Images are not used to infer quantities or specifications.

## ACT layouts, units and demand basis

ACT headers vary and start on rows 3, 4 or 19. `fields[originalHeader]` is an **array of separate cell envelopes**, because a source heading may cover multiple columns. A span runs from one labelled header to the next. Original coordinates are authoritative; grouping does not verify that adjacent notes have identical meaning. Multiple populated cells in one span are flagged. Do not select the first cell and silently discard the others.

The importer retains `headers`, `preamble_rows`, `merged_ranges`, `other_rows`, and `section_context`. A visually merged continuation cell stays blank; `merged_context` provides its anchor and range without copying the value into the blank cell. An item in D7 under the C:D Item header remains D7.

Quantity columns retain their exact source names and values: `Number per pack`, `Number of ready pack needed`, `Quantity needed`, `Quantity (unit) in 1 set`, `Quantity for 40 sets`, `Quantity per Set`, `Quantity`, and `Total unit / session`. A number in one of these columns is not inventory stock. A material `Price/unit` value is not an official programme quotation; some such cells actually contain specification text and are flagged.

`material_row_id` is an importer locator such as `ACT-001:r4`, not an official material SKU. Rows with item text and populated quantity-column content have `row_kind: material`; **this only describes source content**, which may include TBC, formulas or errors. Rows with item text but no quantity content have `material_or_section_needs_review`. No-name rows are preserved as `section_or_note`. No physical-item deduplication is attempted.

For all 275 candidates, `operational_usage_basis`, `inventory_mapping`, `consumption_or_reuse`, and `pack_conversion` are null, and `verification_status` is `needs_verification`. Source facts such as “100 units”, “40 sets”, “80 packs” and “1 unit for 1 session” remain available in their original cells. These facts do not by themselves establish verified participant/group/station/session scaling, units-per-box, reuse counts or inventory compatibility. Establish and cite those separately in the future adapter/resource phase.

## Validation and determinism

The importer rejects missing core sheets/columns, duplicate or malformed official IDs, missing titles, a count different from 21, orphan/missing/duplicate ACT associations, unknown mapping references, missing/incomplete rules, and unreviewed extra sheets. This source version requires RULE-001 through RULE-012. A future source with more/fewer offerings or rules requires review and an intentional importer/test update; records must not be padded or removed to meet these guards.

Dictionary inconsistencies and unresolved evidence are retained and audited rather than silently corrected. `import_integrity: pass` means extraction/schema integrity passed. `operational_validation: needs_verification` remains independent.

JSON uses UTF-8, sorted object keys, compact separators, one final newline, original row order and no NaN. Acquisition metadata is supplied explicitly, not generated from the clock on each import. Same workbook bytes, importer version and acquisition metadata yield identical bytes. The manifest hashes the other six output files; it does not include a self-referential hash. Existing differing output files are refused before any output is written; use a new output directory for a changed source/version.

## Reproduction

Only `openpyxl==3.1.5` is required, isolated in `backend/requirements-programme-import.txt`. It was already available in the execution environment, so no dependency installation or lockfile change was performed.

Place the original `.xlsx` outside tracked source (the local run used `.test-tmp/finals-data/`). Extract `acquisition` from the checked-in manifest into an UTF-8 JSON file with exactly these keys: `source_url`, `source_file_url`, `obtained_at`, `source_display_name`, `downloaded_filename`, `sha256`. Preserve the documented timestamp for a reproduction of this acquisition. A genuinely different acquisition should record its own evidence and will produce a different manifest. The recorded acquisition date is not an official publication/update date.

From repository root, with Python containing the pinned dependency:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python backend/scripts/import_programme_catalogue.py '.test-tmp/finals-data/DATASET_PROGRAMME CATALOGUE.xlsx' --output backend/data/programmes --acquisition .test-tmp/finals-data/acquisition.json
$env:ORBIT_PROGRAMME_WORKBOOK=Join-Path $PWD '.test-tmp/finals-data/DATASET_PROGRAMME CATALOGUE.xlsx'
python -m unittest discover -s tests/programmes -p 'test_*.py' -v
```

With the environment variable, tests check this exact original source, every master/mapping/rule/dictionary data cell, every nonempty ACT cell, output digests and repeated export. Without it, the 8 original-source integration tests are skipped and only synthetic tests run; such a run is not evidence of official source verification. Synthetic workbooks are labelled test data and never included in runtime JSON. Tests use `unittest` to avoid application pytest fixtures and do not initialize SQLite, start services, run migrations or touch inventory.
