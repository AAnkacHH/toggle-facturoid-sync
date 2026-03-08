## PLAN COMPLETED: Agent 4 — Toggl Client Service — New API Methods & Error Standardization

**Tasks:** 2/2

### Changes Summary:

**Task 1: Add getClients/getProjects methods + refactor requestWithRetry + standardize errors**
- Added `TOGGL_API_BASE_URL` constant for Toggl API v9 (`https://api.track.toggl.com/api/v9`)
- Refactored `requestWithRetry` to accept `method: 'GET' | 'POST'` parameter, now uses `axios.request()` instead of `axios.post()`
- Updated `getMonthSummary` to call refactored `requestWithRetry` with `'POST'` method
- Added `getClients(workspaceId?: string)` method — calls `GET /api/v9/workspaces/{id}/clients`
- Added `getProjects(workspaceId?: string)` method — calls `GET /api/v9/workspaces/{id}/projects`
- Replaced `HttpException(..., HttpStatus.UNAUTHORIZED)` with `UnauthorizedException(...)` (6 occurrences in getCredentials and requestWithRetry)
- Replaced `HttpException(..., HttpStatus.BAD_GATEWAY)` with `BadGatewayException(...)` (2 occurrences in requestWithRetry)
- Kept `HttpException(..., HttpStatus.TOO_MANY_REQUESTS)` as-is (no built-in NestJS exception for 429)
- Updated imports to include `UnauthorizedException`, `BadGatewayException`

**Task 2: Convert DTOs to interfaces + add new response types**
- Converted `TogglProjectSummary` from `class` to `interface`
- Converted `TogglMonthSummary` from `class` to `interface`
- Added `TogglClient` interface for Toggl API v9 client responses
- Added `TogglProject` interface for Toggl API v9 project responses
- Updated `parseResponse` in service to use object literals instead of `new` constructors

### Modified files:
- `src/invoicing/services/toggl-client.service.ts` (modified)
- `src/invoicing/dto/toggl-summary.dto.ts` (modified)
- `src/invoicing/services/toggl-client.service.spec.ts` (modified)

### Test results:
- 22 tests pass (15 existing tests updated + 7 new tests for getClients/getProjects)
- Test file updated: mock changed from `axios.post` to `axios.request` to match refactored service
- New test cases: getClients URL, getClients custom workspaceId, getClients 401 error, getProjects URL, getProjects custom workspaceId, getProjects 401 error, getProjects 5xx error

### Verification:
- No `export class` in `toggl-summary.dto.ts` (all interfaces)
- No `new TogglMonthSummary` / `new TogglProjectSummary` in service
- `getClients` and `getProjects` methods present
- `UnauthorizedException` and `BadGatewayException` used throughout
- `TOGGL_API_BASE_URL` constant defined
- No build errors in modified files (pre-existing TS2564 errors in other files are from other agents' scope)

### Commits:
- Not committed per instructions ("Do NOT commit or push")

### Shared/Manual files (not touched):
- None needed

### Problems:
- Build (`pnpm run build`) fails with 59 TS2564 errors, but all are in files outside this agent's scope (entities, other DTOs, other services). Zero errors from the 3 files modified by this agent.
