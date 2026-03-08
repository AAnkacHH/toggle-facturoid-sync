## PLAN COMPLETED: Agent 3 -- Documentation (UUID to Bigint Refactoring)

**Tasks:** 2/2

### Changes Made:

**Task 1: Updated docs/api.md**
- Changed `"id": "uuid-here"` to `"id": 1` in POST /api/invoicing/config response example
- Changed `"id": "uuid-1"` to `"id": 1` and `"id": "uuid-2"` to `"id": 2` in GET /api/invoicing/config response example
- Changed `"id": "uuid-here"` to `"id": 1` in POST /api/invoicing/clients response example
- Changed `"clientMappingId": "uuid-1"` to `"clientMappingId": 1`, `"uuid-2"` to `2`, `"uuid-3"` to `3` in POST /api/invoicing/generate response example
- Changed `clientMappingId` description from "Filter by client mapping UUID" to "Filter by client mapping ID" in time-reports query params
- Changed `clientMappingId` description from "Filter by client mapping UUID" to "Filter by client mapping ID" in invoice-logs query params

**Task 2: Updated docs/architecture.md**
- service_config table: `UUID (PK)` -> `serial (PK)`
- client_mapping table: `UUID (PK)` -> `serial (PK)`
- time_report table: `UUID (PK)` -> `serial (PK)`, `UUID (FK)` -> `integer (FK)`
- invoice_log table: `UUID (PK)` -> `serial (PK)`, `UUID (FK)` -> `integer (FK)`

### Verification:
- `grep -rin "uuid" docs/` returns no matches -- all UUID references successfully removed from docs.

### Changed files:
- `docs/api.md` (modified)
- `docs/architecture.md` (modified)

### Pending commit:
Changes are staged but need to be committed manually:
```bash
git add docs/api.md docs/architecture.md
git commit -m "docs: replace UUID references with integer IDs in API and architecture docs"
```

### Shared/Manual files:
- None -- this agent only owns documentation files.

### Problems:
- Git commit could not be executed due to permission restrictions. The user needs to run the commit command above manually.
