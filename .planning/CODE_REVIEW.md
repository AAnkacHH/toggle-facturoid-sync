# Code Review Report — Toggl-Facturoid Sync

**Date:** 2026-03-08
**Scope:** Full codebase review (30 files, ~2000 LOC)
**Reviewed by:** Claude Code

---

## Summary

| Category | Score | Issues |
|----------|-------|--------|
| Security | 4/10 | 3 critical, 4 major |
| Architecture | 6/10 | 2 critical, 5 major |
| Code Quality | 7/10 | 3 major, 6 minor |
| Conventions | 5/10 | 2 critical, 4 major |
| Modernity | 7/10 | 5 minor |

---

## 1. SECURITY

### [S-CRIT-1] No Authentication on API Endpoints

**Severity:** CRITICAL
**Files:** All controllers

All endpoints are completely open — no auth guards, no JWT, no API key. Anyone can:
- Read/modify encrypted credentials via `/api/service-config`
- Trigger invoice generation via `/api/invoicing/generate`
- Delete client mappings

**Fix:** Add at minimum an API key guard or JWT auth. Even a simple `@UseGuards(ApiKeyGuard)` on all controllers.

```typescript
// Example: src/common/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    return apiKey === process.env.API_KEY;
  }
}
```

---

### [S-CRIT-2] FakturoidClientService 429 Retry Has No Max Limit — Infinite Recursion

**Severity:** CRITICAL
**File:** `src/invoicing/services/fakturoid-client.service.ts:254-264`

```typescript
if (status === 429) {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return this.request<T>(method, path, data, isRetry); // <-- no retry counter!
}
```

If Fakturoid keeps returning 429, this recursion will eventually cause a stack overflow. The Toggl service correctly limits retries to `MAX_RETRIES = 3`.

**Fix:** Add a `retryCount` parameter with a maximum (e.g., 3).

---

### [S-CRIT-3] FakturoidClientService Double DB Query Per Request

**Severity:** MAJOR (perf) + SECURITY (info leak risk)
**File:** `src/invoicing/services/fakturoid-client.service.ts:200-201`

```typescript
private async request<T>(...): Promise<T> {
  const token = await this.authenticate();       // calls getCredentials() internally
  const { userAgentEmail } = await this.getCredentials(); // second DB query!
```

Every single API request triggers 2 DB queries for credentials. The credentials are decrypted twice, doubling the crypto operations and DB load.

**Fix:** Cache credentials in memory (like the token), or restructure `authenticate()` to return the email alongside the token.

---

### [S-MAJ-1] Database Default Password

**Severity:** MAJOR
**File:** `src/config/database.config.ts:25`

```typescript
password: configService.get<string>('DB_PASSWORD', 'postgres'),
```

Default password `'postgres'` is a security risk if someone deploys without setting `DB_PASSWORD`.

**Fix:** Remove default values for credentials. Throw if `DB_PASSWORD` is missing (or require `DATABASE_URL`).

---

### [S-MAJ-2] Unsafe Cast of `status` Query Parameter

**Severity:** MAJOR
**File:** `src/invoicing/controllers/invoicing.controller.ts:81`

```typescript
where.status = status as InvoiceStatus; // unsafe cast, no validation
```

Attacker can pass any string, potentially causing unexpected TypeORM behavior.

**Fix:** Validate against the `InvoiceStatus` enum:
```typescript
if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
  where.status = status as InvoiceStatus;
}
```

---

### [S-MAJ-3] Error Responses Leak Internal API Details

**Severity:** MAJOR
**File:** `src/invoicing/services/fakturoid-client.service.ts:241-249`

```typescript
throw new ForbiddenException(
  'Fakturoid API returned 403 ...' +
  `Response: ${JSON.stringify(error.response?.data)}` // leaks Fakturoid error details
);
throw new BadRequestException(
  `Fakturoid validation error: ${JSON.stringify(validationErrors)}` // leaks validation details
);
```

Internal error details from Fakturoid should be logged, not returned to the client.

**Fix:** Log the details with `this.logger.error()`, return a generic message to the client.

---

### [S-MAJ-4] No Rate Limiting on API Endpoints

**Severity:** MAJOR

No `@nestjs/throttler` or similar. Someone could spam `/api/invoicing/generate` and exhaust Fakturoid/Toggl API quotas.

**Fix:** Add `@nestjs/throttler` with appropriate limits.

---

## 2. ARCHITECTURE

### [A-CRIT-1] No TypeORM Migrations Exist

**Severity:** CRITICAL

Config says `synchronize: false` and `migrationsRun: true`, but there are **zero migration files**. The app will start but no tables will be created — it will crash on first DB query.

**Fix:** Generate initial migration:
```bash
npx typeorm migration:generate src/migrations/InitialSchema -d src/config/database.config.ts
```

---

### [A-CRIT-2] No TypeORM Naming Strategy — DB Column Names Will Be camelCase

**Severity:** CRITICAL
**File:** `src/config/database.config.ts`

TypeORM default naming produces `serviceName`, `configKey`, `clientMappingId`, etc. as column names. The spec says `service_name`, `config_key`, `client_mapping_id`.

**Fix:** Install and configure `typeorm-naming-strategies`:
```bash
pnpm add typeorm-naming-strategies
```
```typescript
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
// in database config:
namingStrategy: new SnakeNamingStrategy(),
```

---

### [A-MAJ-1] Business Logic in Controllers

**Severity:** MAJOR
**File:** `src/invoicing/controllers/client-mapping.controller.ts`

The controller has duplicate checks, `String()` conversions, and entity creation logic. This violates the thin-controller pattern used by `ServiceConfigController`.

**Fix:** Create `ClientMappingService` to match the pattern of `ServiceConfigService`.

---

### [A-MAJ-2] N+1 Query Pattern in fetchAndSaveTimeReports

**Severity:** MAJOR
**File:** `src/invoicing/services/invoicing.service.ts:73-104`

For each project, individual `findOne()` + `save()` calls. With 10 clients x 5 projects = 100 individual queries.

**Fix:** Use TypeORM `upsert()` or batch operations:
```typescript
await this.timeReportRepo.upsert(reports, {
  conflictPaths: ['clientMappingId', 'periodYear', 'periodMonth', 'togglProjectId'],
});
```

---

### [A-MAJ-3] Missing Toggl API Methods

**Severity:** MAJOR
**File:** `src/invoicing/services/toggl-client.service.ts`

Jira spec MP-38 requires:
- `getClients(workspaceId)` — list Toggl clients for mapping UI
- `getProjects(workspaceId)` — list Toggl projects for mapping UI

Only `getMonthSummary()` was implemented. The REST controller (MP-41) expects these for the dropdown endpoints.

---

### [A-MAJ-4] Race Condition on Invoice Duplicate Check

**Severity:** MAJOR
**File:** `src/invoicing/services/invoicing.service.ts:238-312`

Between checking for an existing invoice (line 238) and saving the PENDING log (line 312), another concurrent request could create an invoice for the same client/month.

**Fix:** Wrap in a transaction or use `INSERT ... ON CONFLICT DO NOTHING` and check the result.

---

### [A-MAJ-5] Module Exports Everything

**Severity:** MINOR
**File:** `src/invoicing/invoicing.module.ts:39-47`

All services are exported. `InvoiceCronService`, `ServiceConfigService`, and internal services shouldn't be available to other modules.

**Fix:** Only export what other modules actually need (probably nothing for now, since InvoicingModule is self-contained).

---

## 3. CODE QUALITY

### [C-MAJ-1] Inconsistent Error Handling Patterns

**Severity:** MAJOR

- `TogglClientService`: Uses `new HttpException(message, HttpStatus.XXX)`
- `FakturoidClientService`: Uses specific exceptions (`UnauthorizedException`, `ForbiddenException`)
- `InvoicingService.getFakturoidSlug()`: Throws plain `Error`

**Fix:** Standardize on NestJS built-in exceptions (`UnauthorizedException`, `BadGatewayException`, etc.) across all services.

---

### [C-MAJ-2] Magic Strings for Service Names and Config Keys

**Severity:** MAJOR
**Files:** Multiple services

`'toggl'`, `'fakturoid'`, `'api_token'`, `'workspace_id'`, `'client_id'`, `'client_secret'`, `'slug'`, `'user_agent_email'` are hardcoded strings scattered across multiple files.

**Fix:** Define constants:
```typescript
export const SERVICE_NAMES = { TOGGL: 'toggl', FAKTUROID: 'fakturoid' } as const;
export const TOGGL_CONFIG_KEYS = { API_TOKEN: 'api_token', WORKSPACE_ID: 'workspace_id' } as const;
export const FAKTUROID_CONFIG_KEYS = { CLIENT_ID: 'client_id', CLIENT_SECRET: 'client_secret', SLUG: 'slug', USER_AGENT_EMAIL: 'user_agent_email' } as const;
```

---

### [C-MAJ-3] TogglProjectSummary/TogglMonthSummary Are Classes Used as Plain Objects

**Severity:** MINOR
**File:** `src/invoicing/dto/toggl-summary.dto.ts:25-35`

```typescript
export class TogglProjectSummary {
  projectId: number;
  projectName: string;
  // ...
}
// Used as:
const project = new TogglProjectSummary();
project.projectId = subGroup.id ?? 0;
```

No class features (decorators, methods) are used. Should be `interface` for consistency with other DTOs.

---

### [C-MIN-1] Missing Return Type Annotations on Controller Methods

**Files:** `service-config.controller.ts`, `invoicing.controller.ts`

```typescript
@Get()
findAll() { // <-- no return type
  return this.serviceConfigService.findAll();
}
```

**Fix:** Add `Promise<MaskedServiceConfig[]>` etc. to all controller methods.

---

### [C-MIN-2] MonthPreview Missing `grandTotal`

**File:** `src/invoicing/dto/invoice-result.dto.ts`

Jira spec MP-40 says preview should include:
```
grandTotal: { hours: 60.5, amount: 3025.0 }
```

This is missing from the interface and `getMonthPreview()` implementation.

---

### [C-MIN-3] Hardcoded `unit_name: 'hod'`

**File:** `src/invoicing/services/invoicing.service.ts:293`

Czech word "hod" is hardcoded. Should be a configurable constant.

---

### [C-MIN-4] No Endpoint for `POST /api/invoicing/reports/fetch`

**File:** `src/invoicing/controllers/invoicing.controller.ts`

Jira spec MP-41 requires an endpoint to force-fetch from Toggl without generating invoices. Only `generate` and `preview` exist. Missing `fetchAndSaveTimeReports` endpoint.

---

### [C-MIN-5] `FakturoidInvoicePayload` Missing Optional Fields from Spec

**File:** `src/invoicing/dto/fakturoid-invoice.dto.ts`

The Jira spec shows `issued_on`, `taxable_fulfillment_due`, `due` (days), and `vat_rate` per line. These are missing from the payload interface. Invoices will be created without these important fields.

---

### [C-MIN-6] `payment_method: 'bank'` Hardcoded in InvoicingService

**File:** `src/invoicing/services/invoicing.service.ts:318`

Should be configurable via `service_config` (e.g., `fakturoid.default_payment_method`).

---

## 4. CONVENTIONS

### [V-CRIT-1] API Route Structure Doesn't Match Jira Spec

**Severity:** CRITICAL

Jira MP-41 specifies:
```
GET    /api/invoicing/clients          -> list client mappings
POST   /api/invoicing/clients          -> create mapping
GET    /api/invoicing/toggl/clients    -> Toggl clients dropdown
GET    /api/invoicing/toggl/projects   -> Toggl projects dropdown
GET    /api/invoicing/fakturoid/subjects -> Fakturoid contacts dropdown
```

Actual implementation:
```
GET    /api/client-mappings            -> different path!
POST   /api/client-mappings            -> different path!
GET    /api/service-config             -> different path!
// toggl/clients, toggl/projects, fakturoid/subjects -> NOT IMPLEMENTED
```

**Fix:** Move all routes under `/api/invoicing/` prefix as specified.

---

### [V-CRIT-2] DB Column Names Will Be camelCase, Not snake_case

**Severity:** CRITICAL (same as A-CRIT-2)

PostgreSQL convention is `snake_case`. Without a naming strategy, columns will be `serviceName` instead of `service_name`. This will break if you later try to use raw SQL or connect another tool to the DB.

---

### [V-MAJ-1] Inconsistent DTO File Naming

```
toggl-summary.dto.ts      -> API response shapes (interfaces)
fakturoid-invoice.dto.ts   -> API response shapes (interfaces)
invoice-result.dto.ts      -> Internal result shapes (interfaces)
create-service-config.dto.ts -> Request DTOs (classes with validators)
```

The first three are not request DTOs — they're interfaces/types. Naming them `.dto.ts` is confusing.

**Fix:** Rename non-request types to `.types.ts` or `.interfaces.ts`.

---

### [V-MAJ-2] No `@Column({ name: 'column_name' })` Explicit Mapping

Entities rely on the naming strategy (which is not configured). Should either:
1. Configure SnakeNamingStrategy (recommended), OR
2. Add explicit `@Column({ name: 'service_name' })` on every column

---

### [V-MAJ-3] `tsconfig.json` Has Loose Settings

**File:** `tsconfig.json`

```json
"noImplicitAny": false,        // should be true
"strictBindCallApply": false,  // should be true
"noFallthroughCasesInSwitch": false  // should be true
```

Missing `"strict": true` — only `strictNullChecks` is enabled. This is the NestJS v11 default but should be tightened for a new project.

---

### [V-MAJ-4] eslint.config.mjs Disables `no-explicit-any`

```javascript
'@typescript-eslint/no-explicit-any': 'off',
```

For a new project, `any` should be avoided. Set to `'warn'` at minimum.

---

## 5. MODERNITY

### [M-MIN-1] No Swagger/OpenAPI Documentation

Missing `@nestjs/swagger` decorators. For a self-hostable open-source service, API documentation is important.

### [M-MIN-2] No Docker/docker-compose for Development

No way to easily spin up PostgreSQL for local dev.

### [M-MIN-3] No `.env.example` File

New developers won't know what environment variables to set.

### [M-MIN-4] Jest v30 + ts-jest v29 Version Mismatch

```json
"jest": "^30.0.0",
"ts-jest": "^29.2.5"
```

Could cause compatibility issues. Either downgrade jest or upgrade ts-jest when v30-compatible version is available.

### [M-MIN-5] No API Versioning Prefix

Endpoints are under `/api/` without a version prefix. Should be `/api/v1/` for future compatibility.

---

## Prioritized Action Plan

### Phase A — Must Fix Before First Deploy (Blockers)

| ID | Issue | Effort |
|----|-------|--------|
| A-CRIT-1 | Generate TypeORM migration | Small |
| A-CRIT-2 / V-CRIT-2 | Add SnakeNamingStrategy | Small |
| S-CRIT-1 | Add API authentication guard | Medium |
| S-CRIT-2 | Fix Fakturoid 429 infinite recursion | Small |
| V-CRIT-1 | Restructure API routes per spec | Medium |

### Phase B — Should Fix Before Release

| ID | Issue | Effort |
|----|-------|--------|
| S-CRIT-3 | Fix double DB query for credentials | Small |
| S-MAJ-1 | Remove DB default password | Small |
| S-MAJ-2 | Validate `status` enum in query | Small |
| S-MAJ-3 | Stop leaking internal errors to client | Small |
| A-MAJ-3 | Add missing Toggl API methods | Medium |
| A-MAJ-4 | Fix duplicate invoice race condition | Medium |
| C-MAJ-1 | Standardize error handling | Medium |
| C-MAJ-2 | Extract magic strings to constants | Small |
| C-MIN-4 | Add missing `/reports/fetch` endpoint | Small |
| C-MIN-5 | Add missing Fakturoid payload fields | Small |

### Phase C — Nice to Have

| ID | Issue | Effort |
|----|-------|--------|
| S-MAJ-4 | Add rate limiting | Small |
| A-MAJ-1 | Extract ClientMappingService | Medium |
| A-MAJ-2 | Optimize N+1 queries | Medium |
| V-MAJ-3 | Tighten tsconfig | Small |
| V-MAJ-4 | Set `no-explicit-any` to warn | Small |
| M-MIN-1 | Add Swagger docs | Medium |
| M-MIN-2 | Add Docker Compose | Small |
| M-MIN-3 | Add .env.example | Small |
| M-MIN-5 | Add API version prefix | Small |
