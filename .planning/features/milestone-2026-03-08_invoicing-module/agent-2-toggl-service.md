# Agent 2: Toggl API Client Service

**Jira:** MP-38 (Toggl Service -- API Integration)
**Wave:** 2 (depends on Wave 1: Agent 1 must complete first)
**Prerequisite:** Agent 1 must have completed (entities + encryption service exist)

## <objective>

Create the Toggl Track API client service that authenticates via HTTP Basic Auth, fetches time entry summaries grouped by clients and projects for a given month, handles pagination, rate limiting (429), and auth errors. Write comprehensive unit tests with mocked HTTP responses.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules
- `.context/REQUIREMENTS.md` — Toggl API reference
- `src/invoicing/invoicing.module.ts` — module where you register your service
- `src/invoicing/entities/service-config.entity.ts` — how credentials are stored
- `src/invoicing/services/encryption.service.ts` — how to decrypt credentials

**Toggl Track Reports API v3 reference:**
- Base URL: `https://api.track.toggl.com/reports/api/v3`
- Auth: HTTP Basic Auth with API Token as username and literal string `"api_token"` as password
- Key endpoint: `POST /workspace/{workspace_id}/summary/time_entries`
- Request body example:
  ```json
  {
    "start_date": "2026-02-01",
    "end_date": "2026-02-28",
    "grouping": "clients",
    "sub_grouping": "projects",
    "include_time_entry_ids": false
  }
  ```
- Response: JSON with `groups[]` array. Each group has `id` (client_id) and `sub_groups[]` with `id` (project_id), `title` (project name), and `seconds` (total tracked seconds).

**Credentials are stored in DB (service_config table), NOT in ENV.** The agent must read them from the repository and decrypt using EncryptionService.

</context>

## <tasks>

### Task 1: Create Toggl Client Service

**<files>**
- CREATE: `src/invoicing/services/toggl-client.service.ts`
- CREATE: `src/invoicing/dto/toggl-summary.dto.ts`

**<action>**

1. Create `src/invoicing/dto/toggl-summary.dto.ts`:
   - Define TypeScript interfaces (not classes) for the Toggl API response shape:
     - `TogglSummaryResponse`: `{ groups: TogglClientGroup[] }`
     - `TogglClientGroup`: `{ id: number | null; sub_groups: TogglProjectGroup[] }`
     - `TogglProjectGroup`: `{ id: number | null; title: string; seconds: number }`
   - Define a processed DTO class:
     - `TogglMonthSummary`: `{ clientId: number; projects: TogglProjectSummary[] }`
     - `TogglProjectSummary`: `{ projectId: number; projectName: string; totalSeconds: number; totalHours: number }`

2. Create `src/invoicing/services/toggl-client.service.ts`:
   - Injectable NestJS service
   - Constructor: inject `Repository<ServiceConfig>` (via `@InjectRepository(ServiceConfig)`), `EncryptionService`, and a `Logger`
   - Private method `getCredentials(): Promise<{ apiToken: string; workspaceId: string }>`:
     - Query service_config for `serviceName = 'toggl'` and `configKey IN ('api_token', 'workspace_id')`
     - For the api_token (isSecret=true): decrypt using EncryptionService
     - For workspace_id (isSecret=false): read from plainValue
     - Throw `HttpException(401)` if credentials not found
   - Public method `getMonthSummary(workspaceId: string, year: number, month: number): Promise<TogglMonthSummary[]>`:
     - Calculate `start_date` (first day of month) and `end_date` (last day of month) in YYYY-MM-DD format
     - POST to `${BASE_URL}/workspace/${workspaceId}/summary/time_entries`
     - Set Authorization header: `Basic ${Buffer.from(apiToken + ':api_token').toString('base64')}`
     - Parse response: convert `groups` to `TogglMonthSummary[]`, converting seconds to hours (seconds / 3600, rounded to 2 decimal places)
     - Filter out groups where client id is null (unassigned time entries)
     - Handle errors: 401 (bad token), 429 (rate limit with retry after exponential backoff: 1s, 2s, 4s, max 3 retries), 5xx (server error)
   - Use axios for HTTP calls (already installed by Agent 1)
   - Add a configurable `User-Agent` header: `toggl-facturoid-sync/1.0`

**Rate limit handling:**
- On 429 response, read `Retry-After` header if present
- Wait the specified time (or default 1 second), then retry
- Maximum 3 retries before throwing
- Use exponential backoff: 1s, 2s, 4s

**DO NOT:**
- Store credentials in ENV or hardcode them
- Log the API token value
- Use `fetch` — use axios for consistency
- Implement getClients() or getProjects() methods yet (not needed for MVP flow)

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- `toggl-client.service.ts` exists with `getMonthSummary()` and private `getCredentials()` methods
- DTO file exists with proper TypeScript interfaces
- Service reads credentials from DB and decrypts secrets
- Rate limit retry logic implemented with exponential backoff

---

### Task 2: Register Service in Module + Write Unit Tests

**<files>**
- MODIFY: `src/invoicing/invoicing.module.ts` (add TogglClientService to providers and exports)
- CREATE: `src/invoicing/services/toggl-client.service.spec.ts`

**<action>**

1. Add `TogglClientService` to `providers` and `exports` arrays in `invoicing.module.ts`.

2. Create `src/invoicing/services/toggl-client.service.spec.ts`:
   - Mock `Repository<ServiceConfig>` to return fake credentials
   - Mock `EncryptionService` to return decrypted api_token
   - Mock axios to return fake Toggl API responses
   - Test cases:
     - `getMonthSummary` returns correctly parsed data with hours calculated from seconds
     - Null client IDs are filtered out
     - 401 error throws appropriate exception
     - 429 error triggers retry (mock axios to fail once with 429 then succeed)
     - Missing credentials throws appropriate exception
     - Correct date range is calculated (e.g., February 2026 = 2026-02-01 to 2026-02-28)
     - Correct Basic Auth header is constructed

**Testing approach:**
- Use `jest.mock('axios')` or create an axios instance mock
- Use `@nestjs/testing` Test.createTestingModule with mocked providers
- Each test should be independent and not rely on external services

**DO NOT:**
- Make real HTTP calls to Toggl API in tests
- Skip the retry logic tests

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='toggl-client.service.spec' --no-cache 2>&1 | tail -20
```

**<done>**
- All unit tests pass (minimum 6 test cases)
- TogglClientService registered in InvoicingModule
- TypeScript compiles without errors
- `pnpm run lint` passes

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. Unit tests for this service
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='toggl-client' --no-cache

# 3. All tests still pass
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache

# 4. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint
```

</verify>
