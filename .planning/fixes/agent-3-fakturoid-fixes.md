# Agent 3: Fakturoid Client Service Fixes

## <objective>
Fix the infinite recursion bug in Fakturoid 429 retry logic, eliminate the double DB query for credentials, stop leaking internal error details to the client, and add missing fields to the Fakturoid invoice payload. This agent handles FIX 4, FIX 6, and the Fakturoid-related parts of FIX 7 (S-MAJ-3, C-MIN-5).
</objective>

## <context>
Read these files before starting:
- `AGENTS.md` — project rules, tech stack, architecture
- `src/invoicing/services/fakturoid-client.service.ts` — the main file to modify (all fixes apply here)
- `src/invoicing/services/toggl-client.service.ts` — reference for correct retry pattern with `MAX_RETRIES`
- `src/invoicing/dto/fakturoid-invoice.dto.ts` — needs additional fields
- `src/invoicing/services/fakturoid-client.service.spec.ts` — existing tests (update if needed)

IMPORTANT: Do NOT modify any other service files, controllers, or entities. Only modify the files listed above.
</context>

## <tasks>

### Task 1: Fix 429 infinite recursion, double DB query, and error leaking

<files>
- `src/invoicing/services/fakturoid-client.service.ts` (modify)
</files>

<action>
1. **Fix 429 infinite recursion (FIX 4 — S-CRIT-2):**
   - Change the `request()` method signature from `isRetry = false` to `retryCount = 0`
   - Add a constant `MAX_RETRIES = 3` at the top of the file (next to `TOKEN_REFRESH_BUFFER_SECONDS`)
   - In the 429 handler, check `if (retryCount >= MAX_RETRIES)` and throw `HttpException('Fakturoid API rate limit exceeded after maximum retries.', HttpStatus.TOO_MANY_REQUESTS)` if exceeded
   - Otherwise, call `return this.request<T>(method, path, data, retryCount + 1)`
   - For the 401 retry, change to pass `retryCount` through: `if (status === 401 && retryCount === 0)` (only retry auth on first attempt), then `return this.request<T>(method, path, data, retryCount + 1)`

2. **Fix double DB query (FIX 6 — S-CRIT-3):**
   - Add a cached credentials field alongside the existing token cache:
     ```typescript
     private cachedCredentials: FakturoidCredentials | null = null;
     ```
   - Modify `getCredentials()` to cache: at the start, if `this.cachedCredentials` is not null, return it. At the end (before return), set `this.cachedCredentials = result`.
   - In `clearCachedToken()`, also clear `this.cachedCredentials = null`
   - In the `authenticate()` method, when clearing token on auth failure, also clear `this.cachedCredentials = null`
   - In the `request()` method, remove the separate `await this.getCredentials()` call for `userAgentEmail`. Instead, call `getCredentials()` once at the top and pass the email through:
     ```typescript
     const credentials = await this.getCredentials();
     const token = await this.authenticate();
     // use credentials.userAgentEmail for the User-Agent header
     ```
   - Actually, even better: have `authenticate()` return both the token AND the credentials. Or just call `getCredentials()` once in `request()` and pass `clientId`/`clientSecret` to `authenticate()`. The cleanest approach:
     - Call `const credentials = await this.getCredentials();` once in `request()`
     - Pass `credentials` to a modified `authenticate(credentials)` that accepts them as a parameter instead of calling `getCredentials()` internally
     - Use `credentials.userAgentEmail` directly in `request()` for the header
     - This eliminates both the double query AND makes the code clearer
   - Update `authenticate()` signature to `authenticate(credentials: FakturoidCredentials): Promise<string>` — it no longer calls `getCredentials()` itself

3. **Stop leaking internal error details (FIX 7 — S-MAJ-3):**
   - In the 403 handler: log the full response data with `this.logger.error(...)`, but throw a generic message:
     ```typescript
     this.logger.error(`Fakturoid API 403: ${JSON.stringify(error.response?.data)}`);
     throw new ForbiddenException('Fakturoid API returned 403 Forbidden. Check User-Agent and credentials configuration.');
     ```
   - In the 422 handler: log the validation errors, throw generic message:
     ```typescript
     this.logger.error(`Fakturoid validation errors: ${JSON.stringify(error.response?.data)}`);
     throw new BadRequestException('Fakturoid rejected the invoice payload. Check server logs for validation details.');
     ```
   - In the generic error handler at the bottom: log the full error, throw generic:
     ```typescript
     this.logger.error(`Fakturoid API error ${String(status)}: ${JSON.stringify(error.response?.data)}`);
     throw new InternalServerErrorException('Fakturoid API request failed. Check server logs for details.');
     ```
</action>

<verify>
```bash
# Verify no more infinite recursion pattern
grep -n "MAX_RETRIES" src/invoicing/services/fakturoid-client.service.ts
grep -n "retryCount" src/invoicing/services/fakturoid-client.service.ts

# Verify no double getCredentials call in request()
grep -c "getCredentials" src/invoicing/services/fakturoid-client.service.ts
# Should be 2 or fewer (once in request() and the method definition itself)

# Verify no JSON.stringify in thrown exceptions
grep -n "throw.*JSON.stringify" src/invoicing/services/fakturoid-client.service.ts || echo "PASS: no internal details in exceptions"

# TypeScript compilation
npx tsc --noEmit 2>&1 | grep "fakturoid-client" | head -10
```
</verify>

<done>
- 429 handler has `MAX_RETRIES = 3` check, no infinite recursion possible
- `request()` calls `getCredentials()` exactly once, caching prevents repeated DB queries
- Error messages thrown to client are generic; detailed info is logged server-side only
- `clearCachedToken()` also clears cached credentials
</done>

### Task 2: Add missing Fakturoid invoice payload fields

<files>
- `src/invoicing/dto/fakturoid-invoice.dto.ts` (modify)
</files>

<action>
1. Add optional fields to `FakturoidInvoicePayload` that the Jira spec requires:
   ```typescript
   export interface FakturoidInvoicePayload {
     subject_id: number;
     payment_method: string;
     currency: string;
     lines: FakturoidInvoiceLine[];
     // Optional fields per Fakturoid API v3
     issued_on?: string;              // ISO date string, e.g. '2026-03-01'
     taxable_fulfillment_due?: string; // ISO date string
     due?: number;                     // payment due days
     note?: string;                    // invoice note
   }
   ```

2. Add optional `vat_rate` to `FakturoidInvoiceLine`:
   ```typescript
   export interface FakturoidInvoiceLine {
     name: string;
     quantity: number;
     unit_name: string;
     unit_price: number;
     vat_rate?: number;  // VAT rate percentage, e.g. 21
   }
   ```

3. Add missing fields to `FakturoidSubject` that are useful for the dropdown:
   ```typescript
   export interface FakturoidSubject {
     id: number;
     name: string;
     email: string | null;
     street: string | null;
     city: string | null;
     country: string | null;
     registration_no: string | null;  // ICO
   }
   ```
</action>

<verify>
```bash
grep -n "issued_on" src/invoicing/dto/fakturoid-invoice.dto.ts && echo "PASS: issued_on field added"
grep -n "vat_rate" src/invoicing/dto/fakturoid-invoice.dto.ts && echo "PASS: vat_rate field added"
npx tsc --noEmit 2>&1 | grep "fakturoid-invoice" | head -5
```
</verify>

<done>
- `FakturoidInvoicePayload` has `issued_on`, `taxable_fulfillment_due`, `due`, `note` optional fields
- `FakturoidInvoiceLine` has `vat_rate` optional field
- `FakturoidSubject` has additional address/registration fields
- All fields are optional to maintain backward compatibility
</done>

</tasks>

## <verify>
Final verification:
```bash
# 1. No infinite recursion possible
grep "MAX_RETRIES" src/invoicing/services/fakturoid-client.service.ts

# 2. Credentials cached
grep "cachedCredentials" src/invoicing/services/fakturoid-client.service.ts

# 3. No error details leaked
grep "throw.*JSON.stringify" src/invoicing/services/fakturoid-client.service.ts | wc -l
# Should output 0

# 4. New DTO fields exist
grep "issued_on\|vat_rate\|taxable_fulfillment_due" src/invoicing/dto/fakturoid-invoice.dto.ts

# 5. Tests still pass (if they exist)
pnpm test -- --testPathPattern="fakturoid" --passWithNoTests 2>&1 | tail -5
```
</verify>
