## PLAN COMPLETED: Agent 3 - Fakturoid Client Service Fixes

**Tasks:** 2/2

### Changes Summary:

**Task 1: Fix 429 infinite recursion, double DB query, and error leaking**
- Added `MAX_RETRIES = 3` constant to prevent infinite recursion on 429 responses
- Changed `request()` parameter from `isRetry = false` to `retryCount = 0` with increment on each retry
- 429 handler now checks `retryCount >= MAX_RETRIES` before retrying, throws `HttpException(429)` when exceeded
- 401 handler now uses `retryCount === 0` check (only retries auth on first attempt)
- Added `cachedCredentials` field to eliminate double DB query per request
- `getCredentials()` now returns cached credentials if available, caches result before returning
- `authenticate()` now accepts optional `credentials` parameter -- `request()` calls `getCredentials()` once and passes credentials to `authenticate()`, eliminating the second DB query
- `clearCachedToken()` now also clears `cachedCredentials`
- Auth failure in `authenticate()` also clears `cachedCredentials`
- 401 retry in `request()` also clears `cachedCredentials` (forces fresh credentials on retry)
- Sanitized all error messages thrown to clients:
  - 403: logs full response data server-side, throws generic "Check User-Agent and credentials configuration"
  - 422: logs validation errors server-side, throws generic "Check server logs for validation details"
  - Generic errors: logs full error server-side, throws generic "Check server logs for details"
- Added `HttpException` and `HttpStatus` imports for the 429 throw

**Task 2: Add missing Fakturoid invoice payload fields**
- Added `vat_rate?: number` to `FakturoidInvoiceLine`
- Added `issued_on?: string`, `taxable_fulfillment_due?: string`, `due?: number`, `note?: string` to `FakturoidInvoicePayload`
- Added `street`, `city`, `country`, `registration_no` (all `string | null`) to `FakturoidSubject`

### Modified files:
- `src/invoicing/services/fakturoid-client.service.ts` (modified)
- `src/invoicing/dto/fakturoid-invoice.dto.ts` (modified)
- `src/invoicing/services/fakturoid-client.service.spec.ts` (modified)

### Test results:
- 17 tests pass in `fakturoid-client.service.spec.ts` (12 existing + 5 new)
- 132 tests pass across all 11 test suites (full suite, zero regressions)
- New tests added:
  - `should throw ForbiddenException on 403 without leaking response data`
  - `should throw BadRequestException on 422 without leaking validation details`
  - `should throw HttpException with 429 status after MAX_RETRIES exceeded`
  - `should throw generic InternalServerErrorException without leaking error details`
  - `should also clear cached credentials, forcing a new DB query`
  - `should cache credentials and not query DB on subsequent calls`

### Commits:
- Not committed (per instructions: "Do NOT commit or push")

### Shared/Manual files:
- None required

### Problems:
- Pre-existing build errors (TS2564) exist in entity/DTO files outside this agent's scope. These are not caused by this agent's changes and do not affect the files modified here.
