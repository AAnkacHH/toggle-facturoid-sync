# Agent 3: Documentation -- UUID to Bigint Refactoring

## <objective>
Update all documentation files to reflect the change from UUID primary keys to auto-increment integer IDs. Replace all UUID references, examples, and schema descriptions with integer equivalents.
</objective>

## <context>
**Read these files before starting:**
- `AGENTS.md` -- project rules and conventions
- `CLAUDE.md` -- claude-specific instructions

**Files you OWN (only you will modify these):**
- `docs/api.md`
- `docs/architecture.md`

**Files you must NOT modify:**
- Any source code files (owned by Agent 1 and Agent 2)

**Key facts:**
- All 4 entity tables (`service_config`, `client_mapping`, `time_report`, `invoice_log`) previously used `UUID` primary keys. They now use auto-increment integer (`serial`) PKs.
- Foreign key columns `client_mapping_id` in `time_report` and `invoice_log` change from `UUID` to `integer`.
- API response examples showing UUID-style IDs (e.g., `"uuid-here"`, `"uuid-1"`, `"uuid-2"`) should be changed to numeric IDs (e.g., `1`, `2`).
- Query parameter descriptions referencing "UUID" should say "ID" instead.
- The schema tables in `architecture.md` list column types -- update `UUID (PK)` to `serial (PK)` and `UUID (FK)` to `integer (FK)`.
</context>

## <tasks>

### Task 1: Update docs/api.md

**<files>**
- `docs/api.md`

**<action>**

1. In the **Service Config Endpoints** section:
   - In the POST response example, change `"id": "uuid-here"` to `"id": 1`
   - In the GET list response example, change `"id": "uuid-1"` to `"id": 1` and `"id": "uuid-2"` to `"id": 2`
   - For `GET /api/invoicing/config/:id`, `PATCH /api/invoicing/config/:id`, `DELETE /api/invoicing/config/:id` -- no UUID examples in path params are shown, but if any text says "UUID" in the description, change to "ID"

2. In the **Client Mapping Endpoints** section:
   - In the POST response example, change `"id": "uuid-here"` to `"id": 1`
   - No other UUID references in this section

3. In the **Invoicing Endpoints** section:
   - In the POST /api/invoicing/generate response example, change `"clientMappingId": "uuid-1"` to `"clientMappingId": 1`, `"uuid-2"` to `2`, `"uuid-3"` to `3`

4. In the **Time Reports & Invoice Logs** section:
   - In the `GET /api/invoicing/time-reports` query parameters table, change `clientMappingId` description from `'Filter by client mapping UUID'` to `'Filter by client mapping ID'`
   - In the `GET /api/invoicing/invoice-logs` query parameters table, change `clientMappingId` description from `'Filter by client mapping UUID'` to `'Filter by client mapping ID'`

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && grep -in "uuid" docs/api.md
```
Should return no matches (all UUID references removed).

**<done>**
- All JSON response examples use numeric IDs
- All parameter descriptions say "ID" instead of "UUID"
- No occurrences of "uuid" remain in `docs/api.md`

---

### Task 2: Update docs/architecture.md

**<files>**
- `docs/architecture.md`

**<action>**

1. In the **Database Schema** section, update the **service_config** table:
   - Change `| \`id\` | UUID (PK) | Auto-generated |` to `| \`id\` | serial (PK) | Auto-generated |`

2. In the **client_mapping** table:
   - Change `| \`id\` | UUID (PK) | Auto-generated |` to `| \`id\` | serial (PK) | Auto-generated |`

3. In the **time_report** table:
   - Change `| \`id\` | UUID (PK) | Auto-generated |` to `| \`id\` | serial (PK) | Auto-generated |`
   - Change `| \`client_mapping_id\` | UUID (FK) | Reference to client_mapping |` to `| \`client_mapping_id\` | integer (FK) | Reference to client_mapping |`

4. In the **invoice_log** table:
   - Change `| \`id\` | UUID (PK) | Auto-generated |` to `| \`id\` | serial (PK) | Auto-generated |`
   - Change `| \`client_mapping_id\` | UUID (FK) | Reference to client_mapping |` to `| \`client_mapping_id\` | integer (FK) | Reference to client_mapping |`

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && grep -in "uuid" docs/architecture.md
```
Should return no matches.

**<done>**
- All schema tables show `serial (PK)` instead of `UUID (PK)`
- All FK columns show `integer (FK)` instead of `UUID (FK)`
- No occurrences of "UUID" remain in `docs/architecture.md`
</tasks>

## <verify>
After all tasks are complete, verify no UUID references remain in docs:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && grep -rin "uuid" docs/
```
Should return no matches.
</verify>
