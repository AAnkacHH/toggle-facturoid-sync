# Agent 4: Invoicing Orchestration Service

**Jira:** MP-40 (Invoicing Service -- Business Logic & Orchestration)
**Wave:** 3 (depends on Wave 2: Agents 2 and 3 must complete first)
**Prerequisite:** Agents 1, 2, and 3 must have completed (entities, encryption, Toggl client, Fakturoid client all exist)

## <objective>

Create the InvoicingService that orchestrates the full invoicing flow: fetch active client mappings, pull Toggl time summaries, save time reports to DB (upsert), check for duplicate invoices, create Fakturoid invoices, and save invoice logs. Implement error isolation per client so one client's failure does not block others.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules (duplicate invoice protection)
- `.context/REQUIREMENTS.md` — flow details
- `src/invoicing/invoicing.module.ts` — module where you register your service
- `src/invoicing/entities/client-mapping.entity.ts` — client mapping entity
- `src/invoicing/entities/time-report.entity.ts` — time report entity
- `src/invoicing/entities/invoice-log.entity.ts` — invoice log entity (InvoiceStatus enum)
- `src/invoicing/services/toggl-client.service.ts` — Toggl API client (getMonthSummary method)
- `src/invoicing/services/fakturoid-client.service.ts` — Fakturoid API client (createInvoice method)
- `src/invoicing/services/encryption.service.ts` — encryption service
- `src/invoicing/dto/toggl-summary.dto.ts` — Toggl DTOs
- `src/invoicing/dto/fakturoid-invoice.dto.ts` — Fakturoid DTOs

</context>

## <tasks>

### Task 1: Create Invoicing Service

**<files>**
- CREATE: `src/invoicing/services/invoicing.service.ts`
- CREATE: `src/invoicing/dto/invoice-result.dto.ts`

**<action>**

1. Create `src/invoicing/dto/invoice-result.dto.ts`:
   - `InvoiceGenerationResult`:
     ```typescript
     {
       clientName: string;
       clientMappingId: string;
       status: 'created' | 'skipped_zero_hours' | 'skipped_duplicate' | 'error';
       fakturoidInvoiceId?: number;
       fakturoidNumber?: string;
       totalHours?: number;
       totalAmount?: number;
       errorMessage?: string;
     }
     ```
   - `MonthPreview`:
     ```typescript
     {
       year: number;
       month: number;
       clients: ClientPreview[];
     }
     ```
   - `ClientPreview`:
     ```typescript
     {
       clientName: string;
       togglClientId: number;
       projects: { projectName: string; hours: number; amount: number }[];
       totalHours: number;
       totalAmount: number;
       hasExistingInvoice: boolean;
     }
     ```

2. Create `src/invoicing/services/invoicing.service.ts`:
   - Injectable NestJS service
   - Constructor: inject `Repository<ClientMapping>`, `Repository<TimeReport>`, `Repository<InvoiceLog>`, `Repository<ServiceConfig>`, `TogglClientService`, `FakturoidClientService`, `EncryptionService`, `Logger`

   - Public method `fetchAndSaveTimeReports(year: number, month: number): Promise<TimeReport[]>`:
     1. Get all active client mappings (`isActive = true`)
     2. For each client mapping, get the workspace_id from the mapping
     3. Call `togglClient.getMonthSummary(workspaceId, year, month)`
     4. For each project in the summary that matches the client's togglClientId:
        - Calculate amount = totalHours * clientMapping.hourlyRate
        - Upsert into time_report table (match on unique constraint: clientMappingId + periodYear + periodMonth + togglProjectId)
        - Use TypeORM's `.save()` with the existing record if found via `.findOne()`, or create new
     5. Return all saved time reports

   - Public method `generateMonthlyInvoices(year: number, month: number): Promise<InvoiceGenerationResult[]>`:
     1. Call `fetchAndSaveTimeReports(year, month)` first
     2. Get all active client mappings
     3. Get Fakturoid slug from service_config (plainValue where serviceName='fakturoid', configKey='slug')
     4. For each client mapping (process sequentially to respect rate limits):
        a. **Check duplicate**: query invoice_log for this client+year+month where status IN ('created', 'sent', 'paid'). If exists, add result with status='skipped_duplicate', continue.
        b. **Get time reports**: query time_report for this client+year+month
        c. **Check zero hours**: if no time reports or total hours = 0, add result with status='skipped_zero_hours', continue
        d. **Build invoice payload**:
           - subject_id = clientMapping.fakturoidSubjectId
           - currency = clientMapping.currency
           - lines = one line per project: { name: projectName, quantity: totalHours, unit_name: 'hod', unit_price: hourlyRate }
        e. **Create invoice_log** with status='pending' BEFORE calling Fakturoid (so we have a record even if API fails)
        f. **Call Fakturoid**: `fakturoidClient.createInvoice(slug, payload)`
        g. **Update invoice_log**: set fakturoidInvoiceId, fakturoidNumber, totalHours, totalAmount, status='created'
        h. **Error handling**: if Fakturoid API fails, update invoice_log with status='error' and errorMessage. Do NOT throw — continue to next client (error isolation).
     5. Return array of InvoiceGenerationResult

   - Public method `getMonthPreview(year: number, month: number): Promise<MonthPreview>`:
     1. Get all active client mappings
     2. For each, query existing time_reports for the period
     3. Check if invoice_log already exists for this client+period
     4. Return the preview without creating anything

**Critical business rules:**
- **Duplicate protection**: The UNIQUE constraint on invoice_log (clientMappingId, periodYear, periodMonth) is the DB-level guard. The service-level check queries for existing non-error invoice_logs before creating.
- **Error isolation**: One client's API failure must NOT prevent other clients from being invoiced. Wrap each client's processing in try/catch.
- **Zero hours**: Skip clients with 0 tracked hours (do not create empty invoices).
- **Upsert time reports**: If Toggl data is re-fetched, update existing records rather than creating duplicates.

**DO NOT:**
- Use JavaScript floats for money calculations — all decimal values come from the DB as strings, pass them through as-is or use parseFloat only for display
- Create invoices for clients with 0 hours
- Let one client's error block processing of other clients
- Skip the pending invoice_log record before calling Fakturoid API

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- `invoicing.service.ts` exists with `fetchAndSaveTimeReports()`, `generateMonthlyInvoices()`, `getMonthPreview()` methods
- Result DTO file exists
- Duplicate protection implemented (both DB constraint and service-level check)
- Error isolation per client implemented
- Zero-hours skip logic implemented

---

### Task 2: Register Service in Module + Write Unit Tests

**<files>**
- MODIFY: `src/invoicing/invoicing.module.ts` (add InvoicingService to providers and exports)
- CREATE: `src/invoicing/services/invoicing.service.spec.ts`

**<action>**

1. Add `InvoicingService` to `providers` and `exports` arrays in `invoicing.module.ts`.

2. Create `src/invoicing/services/invoicing.service.spec.ts`:
   - Mock all repositories (ClientMapping, TimeReport, InvoiceLog, ServiceConfig)
   - Mock TogglClientService and FakturoidClientService
   - Mock EncryptionService
   - Test cases for `fetchAndSaveTimeReports`:
     - Fetches from Toggl and saves time reports to DB
     - Upserts existing time reports (finds existing record, updates it)
     - Handles empty Toggl response gracefully
   - Test cases for `generateMonthlyInvoices`:
     - Happy path: fetches time, creates invoice in Fakturoid, saves invoice_log with status='created'
     - Skips clients with 0 hours (status='skipped_zero_hours')
     - Skips duplicate invoices (existing invoice_log with status='created')
     - Error isolation: one client fails, others still process (returns error result for failed client)
     - Creates pending invoice_log before calling Fakturoid API
     - Updates invoice_log to 'error' status when Fakturoid API fails
   - Test cases for `getMonthPreview`:
     - Returns preview with time report data and existing invoice status

**Testing approach:**
- Use `@nestjs/testing` Test.createTestingModule with all mocked providers
- Create realistic mock data matching the entity shapes
- Verify repository .save() and .findOne() calls with correct parameters

**DO NOT:**
- Make real API calls
- Skip the error isolation test
- Skip the duplicate protection test

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='invoicing.service.spec' --no-cache 2>&1 | tail -30
```

**<done>**
- All unit tests pass (minimum 8 test cases)
- InvoicingService registered in InvoicingModule
- TypeScript compiles without errors
- `pnpm run lint` passes

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. Unit tests for this service
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='invoicing.service.spec' --no-cache

# 3. All tests still pass
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache

# 4. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint
```

</verify>
