## PLAN COMPLETED: Agent 2 - Toggl API Client Service

**Tasks:** 2/2

### Changes Made:

#### Task 1: Create Toggl Client Service
- **Created:** `src/invoicing/services/toggl-client.service.ts`
  - Injectable NestJS service with `getMonthSummary(year, month)` public method
  - Private `getCredentials()` reads api_token (encrypted) and workspace_id (plain) from `service_config` table via `@InjectRepository(ServiceConfig)` and `EncryptionService`
  - HTTP Basic Auth: `apiToken:api_token` encoded as Base64
  - POSTs to Toggl Reports API v3 `/workspace/{id}/summary/time_entries`
  - Rate limit handling (429) with exponential backoff: 1s, 2s, 4s (max 3 retries), respects `Retry-After` header
  - Auth error handling (401) with descriptive message
  - Server error handling (5xx) mapped to 502 Bad Gateway
  - Converts seconds to hours (rounded to 2 decimal places)
  - Filters out null client IDs (unassigned time entries)
  - Uses `axios.isAxiosError()` for reliable error type checking
  - Configurable `User-Agent: toggl-facturoid-sync/1.0` header
- **DTO file** `src/invoicing/dto/toggl-summary.dto.ts` already existed from Wave 1 with correct shape -- no changes needed

#### Task 2: Register Service + Unit Tests
- **Modified:** `src/invoicing/invoicing.module.ts` -- added `TogglClientService` to providers and exports (note: another agent also added `FakturoidClientService` to the same file)
- **Created:** `src/invoicing/services/toggl-client.service.spec.ts` -- 15 test cases:
  1. Correctly parsed data with hours calculated from seconds
  2. Null client IDs filtered out
  3. 401 throws HttpException UNAUTHORIZED
  4. 429 triggers retry and succeeds on subsequent attempt
  5. Exceeding max retries on 429 throws TOO_MANY_REQUESTS
  6. Retry-After header is respected on 429
  7. Missing credentials throws UNAUTHORIZED
  8. Correct date range for February 2026 (28 days)
  9. Correct date range for 31-day month
  10. Correct date range for leap year February (29 days)
  11. Correct Basic Auth header construction
  12. Correct request body with grouping parameters
  13. 5xx server errors throw BAD_GATEWAY
  14. EncryptionService.decrypt called with correct parameters
  15. Missing encrypted fields throw UNAUTHORIZED

### Verification Results:
- TypeScript compilation: PASS (zero errors)
- Unit tests: 15/15 PASS
- All project tests: 39/39 PASS (4 suites)
- Build (`pnpm run build`): PASS
- Lint: PASS for my files (0 errors in toggl-client.service.ts and toggl-client.service.spec.ts)

### Created/Modified Files:
- `src/invoicing/services/toggl-client.service.ts` (created)
- `src/invoicing/services/toggl-client.service.spec.ts` (created)
- `src/invoicing/invoicing.module.ts` (modified -- TogglClientService added to providers/exports)

### Shared/Manual Files:
- `src/invoicing/invoicing.module.ts` -- was modified by both Agent 2 (me) and Agent 3 concurrently. The final state includes both TogglClientService and FakturoidClientService.

### Issues:
- Pre-existing lint errors exist in `src/invoicing/services/fakturoid-client.service.spec.ts` (24 errors) and `src/main.ts` (1 warning). These are from other agents' code and were not touched.
