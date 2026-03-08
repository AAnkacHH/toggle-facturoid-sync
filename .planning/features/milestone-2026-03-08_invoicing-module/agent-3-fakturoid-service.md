# Agent 3: Fakturoid API Client Service

**Jira:** MP-39 (Fakturoid Service -- OAuth2 + API Integration)
**Wave:** 2 (depends on Wave 1: Agent 1 must complete first)
**Prerequisite:** Agent 1 must have completed (entities + encryption service exist)

## <objective>

Create the Fakturoid API client service that authenticates via OAuth 2.0 Client Credentials Flow, caches access tokens in memory with auto-refresh, creates draft invoices, fetches subjects, and handles rate limiting and error responses. Write comprehensive unit tests.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules
- `.context/REQUIREMENTS.md` — Fakturoid API reference
- `src/invoicing/invoicing.module.ts` — module where you register your service
- `src/invoicing/entities/service-config.entity.ts` — how credentials are stored
- `src/invoicing/services/encryption.service.ts` — how to decrypt credentials

**Fakturoid API v3 reference:**
- Base URL: `https://app.fakturoid.cz/api/v3`
- Auth: OAuth 2.0 Client Credentials Flow
- Token endpoint: `POST https://app.fakturoid.cz/api/v3/oauth/token`
  - Authorization header: `Basic ${base64(client_id:client_secret)}`
  - Body (form-urlencoded): `grant_type=client_credentials`
  - Response: `{ access_token: string, token_type: "Bearer", expires_in: 7200 }`
- All API requests require `Authorization: Bearer {access_token}` header
- All API requests MUST include a `User-Agent` header (Fakturoid returns 403 without it)
- Rate limit: 400 requests per 60 seconds
- Key endpoints:
  - `POST /accounts/{slug}/invoices.json` — create invoice
  - `GET /accounts/{slug}/subjects.json` — list subjects
  - `GET /accounts/{slug}/invoices/{id}.json` — get single invoice

**Credentials stored in DB (service_config table):** `fakturoid` service with keys: `client_id`, `client_secret` (both secret), `slug` (plain), `user_agent_email` (plain).

</context>

## <tasks>

### Task 1: Create Fakturoid Client Service

**<files>**
- CREATE: `src/invoicing/services/fakturoid-client.service.ts`
- CREATE: `src/invoicing/dto/fakturoid-invoice.dto.ts`

**<action>**

1. Create `src/invoicing/dto/fakturoid-invoice.dto.ts`:
   - Define TypeScript interfaces for Fakturoid API payloads:
     - `FakturoidInvoicePayload`: the request body for creating an invoice
       ```typescript
       {
         subject_id: number;
         payment_method: string;  // 'bank'
         currency: string;        // 'CZK'
         lines: FakturoidInvoiceLine[];
       }
       ```
     - `FakturoidInvoiceLine`:
       ```typescript
       {
         name: string;           // project name
         quantity: number;        // hours
         unit_name: string;      // 'hod' (Czech for hours)
         unit_price: number;     // hourly rate
       }
       ```
     - `FakturoidInvoiceResponse`: the response from invoice creation
       ```typescript
       {
         id: number;
         number: string;
         total: string;
         status: string;
         subject_id: number;
         html_url: string;
       }
       ```
     - `FakturoidSubject`:
       ```typescript
       {
         id: number;
         name: string;
         email: string | null;
       }
       ```

2. Create `src/invoicing/services/fakturoid-client.service.ts`:
   - Injectable NestJS service
   - Constructor: inject `Repository<ServiceConfig>`, `EncryptionService`, `Logger`
   - Private state:
     - `accessToken: string | null`
     - `tokenExpiresAt: Date | null`
   - Private method `getCredentials(): Promise<{ clientId: string; clientSecret: string; slug: string; userAgentEmail: string }>`:
     - Query service_config for `serviceName = 'fakturoid'`
     - Decrypt `client_id` and `client_secret` (isSecret=true)
     - Read `slug` and `user_agent_email` from plainValue
     - Throw if any credential is missing
   - Private method `authenticate(): Promise<string>`:
     - If `accessToken` is still valid (current time + 5 min buffer < tokenExpiresAt), return cached token
     - Otherwise POST to `https://app.fakturoid.cz/api/v3/oauth/token`:
       - Authorization: `Basic ${base64(clientId:clientSecret)}`
       - Content-Type: `application/x-www-form-urlencoded`
       - Body: `grant_type=client_credentials`
     - Parse response, store `accessToken` and calculate `tokenExpiresAt` from `expires_in`
     - Return the access_token
   - Private method `request<T>(method: string, path: string, data?: any): Promise<T>`:
     - Generic HTTP wrapper that handles auth, headers, and errors
     - Calls `authenticate()` before each request
     - Sets headers: `Authorization: Bearer ${token}`, `User-Agent: TogglFakturoidSync (<email>)`, `Content-Type: application/json`
     - On 401: clear cached token, re-authenticate once, retry the request
     - On 429: wait and retry (similar to Toggl, but rate limit is 400/60s so less likely)
     - On 422: parse validation errors from response body, throw descriptive error
     - On 403: likely missing User-Agent, throw descriptive error
   - Public method `createInvoice(slug: string, payload: FakturoidInvoicePayload): Promise<FakturoidInvoiceResponse>`:
     - POST to `/accounts/${slug}/invoices.json`
     - Return parsed response
   - Public method `getSubjects(slug: string): Promise<FakturoidSubject[]>`:
     - GET `/accounts/${slug}/subjects.json`
     - Handle pagination if needed (Fakturoid paginates with `page` query param)
   - Public method `getInvoice(slug: string, invoiceId: number): Promise<FakturoidInvoiceResponse>`:
     - GET `/accounts/${slug}/invoices/${invoiceId}.json`

**Token caching strategy:**
- Store token in memory (instance variable), not in DB
- Refresh 5 minutes before expiry (expires_in is 7200s = 2 hours, so refresh at 6900s)
- On 401 during a request: clear token, re-auth, retry once

**DO NOT:**
- Store the OAuth access token in the database — it is short-lived and should be cached in memory only
- Log client_id, client_secret, or access_token values
- Forget the User-Agent header — Fakturoid returns 403 without it
- Use fetch — use axios

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- `fakturoid-client.service.ts` exists with `authenticate()`, `createInvoice()`, `getSubjects()`, `getInvoice()` methods
- DTO file exists with proper TypeScript interfaces
- OAuth 2.0 Client Credentials flow implemented with token caching and auto-refresh
- 401 retry, 429 rate limit, 422 validation error handling implemented

---

### Task 2: Register Service in Module + Write Unit Tests

**<files>**
- MODIFY: `src/invoicing/invoicing.module.ts` (add FakturoidClientService to providers and exports)
- CREATE: `src/invoicing/services/fakturoid-client.service.spec.ts`

**<action>**

1. Add `FakturoidClientService` to `providers` and `exports` arrays in `invoicing.module.ts`.

2. Create `src/invoicing/services/fakturoid-client.service.spec.ts`:
   - Mock `Repository<ServiceConfig>` to return fake Fakturoid credentials
   - Mock `EncryptionService` to return decrypted client_id/client_secret
   - Mock axios for all HTTP calls
   - Test cases:
     - `authenticate()` gets a token via Client Credentials grant
     - Token is cached — second call does NOT make HTTP request
     - Token refresh happens when token is about to expire (set tokenExpiresAt to past)
     - `createInvoice()` sends correct payload and returns parsed response
     - `getSubjects()` returns parsed subject list
     - 401 during request triggers re-authentication and retry
     - 403 without User-Agent throws descriptive error
     - 422 validation error is parsed and thrown with details
     - Missing credentials throws appropriate exception

**Testing approach:**
- Use `jest.mock('axios')` or mock axios instance
- Use `@nestjs/testing` Test.createTestingModule with mocked providers
- Manipulate time for token expiry tests (use `jest.useFakeTimers()` or set `tokenExpiresAt` directly)

**DO NOT:**
- Make real HTTP calls to Fakturoid API in tests
- Skip the token caching/refresh tests — they are critical

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='fakturoid-client.service.spec' --no-cache 2>&1 | tail -20
```

**<done>**
- All unit tests pass (minimum 7 test cases)
- FakturoidClientService registered in InvoicingModule
- TypeScript compiles without errors
- `pnpm run lint` passes

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. Unit tests for this service
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='fakturoid-client' --no-cache

# 3. All tests still pass
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache

# 4. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint
```

</verify>
