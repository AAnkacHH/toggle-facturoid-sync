# Agent 4: Toggl Client Service — New API Methods & Error Standardization

## <objective>
Add missing Toggl API methods (`getClients`, `getProjects`) needed for the dropdown endpoints, convert TogglProjectSummary/TogglMonthSummary from classes to interfaces, and standardize error handling to use NestJS built-in exceptions. This agent handles FIX 8 and the Toggl-related parts of FIX 7 (C-MAJ-1, C-MAJ-3).
</objective>

## <context>
Read these files before starting:
- `AGENTS.md` — project rules, tech stack, architecture
- `src/invoicing/services/toggl-client.service.ts` — main file to modify
- `src/invoicing/dto/toggl-summary.dto.ts` — DTOs to modify (convert classes to interfaces)
- `src/invoicing/services/toggl-client.service.spec.ts` — existing tests (update if needed)
- `src/invoicing/services/fakturoid-client.service.ts` — reference for how errors are structured (the TARGET pattern after Agent 3 fixes it)

IMPORTANT: Do NOT modify any other files. Only the files listed above.
</context>

## <tasks>

### Task 1: Add getClients and getProjects methods

<files>
- `src/invoicing/services/toggl-client.service.ts` (modify)
</files>

<action>
1. **Add Toggl regular API base URL constant:**
   The existing `BASE_URL` is for the Reports API (`/reports/api/v3`). The new methods use the regular Toggl API. Add:
   ```typescript
   const TOGGL_API_BASE_URL = 'https://api.track.toggl.com/api/v9';
   ```

2. **Add response interfaces** (either in this file or in the DTO file — put them in the DTO file, see Task 2):
   - `TogglClient`: `{ id: number; name: string; wid: number; archived: boolean; }`
   - `TogglProject`: `{ id: number; name: string; wid: number; cid: number | null; client_id: number | null; active: boolean; color: string; }`

3. **Add `getClients(workspaceId?: string)` method:**
   ```typescript
   async getClients(workspaceId?: string): Promise<TogglClient[]> {
     const { apiToken, workspaceId: configWorkspaceId } = await this.getCredentials();
     const wsId = workspaceId ?? configWorkspaceId;

     const url = `${TOGGL_API_BASE_URL}/workspaces/${wsId}/clients`;
     const headers = {
       Authorization: this.buildAuthHeader(apiToken),
       'Content-Type': 'application/json',
       'User-Agent': USER_AGENT,
     };

     return this.getRequestWithRetry<TogglClient[]>(url, headers);
   }
   ```
   - The `workspaceId` parameter is optional — if not provided, use the one from service_config
   - These are GET requests, not POST, so you need a separate `getRequestWithRetry` method or refactor `requestWithRetry` to support GET

4. **Add `getProjects(workspaceId?: string)` method:**
   ```typescript
   async getProjects(workspaceId?: string): Promise<TogglProject[]> {
     const { apiToken, workspaceId: configWorkspaceId } = await this.getCredentials();
     const wsId = workspaceId ?? configWorkspaceId;

     const url = `${TOGGL_API_BASE_URL}/workspaces/${wsId}/projects`;
     const headers = {
       Authorization: this.buildAuthHeader(apiToken),
       'Content-Type': 'application/json',
       'User-Agent': USER_AGENT,
     };

     return this.getRequestWithRetry<TogglProject[]>(url, headers);
   }
   ```

5. **Refactor `requestWithRetry` to support both GET and POST:**
   - Rename existing `requestWithRetry` to support a `method` parameter, or create a more generic version:
     ```typescript
     private async requestWithRetry<T>(
       method: 'GET' | 'POST',
       url: string,
       headers: Record<string, string>,
       body?: Record<string, unknown>,
     ): Promise<T> {
       for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
         try {
           const response = await axios.request<T>({
             method,
             url,
             headers,
             data: body,
           });
           return response.data;
         } catch (error) {
           // ... existing retry logic
         }
       }
       // ...
     }
     ```
   - Update `getMonthSummary` to call the refactored method

6. **Standardize error handling (FIX 7 — C-MAJ-1):**
   Replace `HttpException` with NestJS built-in exceptions throughout the service:
   - `new HttpException('...', HttpStatus.UNAUTHORIZED)` -> `new UnauthorizedException('...')`
   - `new HttpException('...', HttpStatus.TOO_MANY_REQUESTS)` -> `new HttpException('...', HttpStatus.TOO_MANY_REQUESTS)` (keep this one, no built-in for 429)
   - `new HttpException('...', HttpStatus.BAD_GATEWAY)` -> `new BadGatewayException('...')`
   - Add imports: `import { Injectable, Logger, UnauthorizedException, BadGatewayException, HttpException, HttpStatus } from '@nestjs/common';`
</action>

<verify>
```bash
# Verify new methods exist
grep -n "getClients\|getProjects" src/invoicing/services/toggl-client.service.ts

# Verify error handling uses NestJS exceptions
grep -n "UnauthorizedException\|BadGatewayException" src/invoicing/services/toggl-client.service.ts

# Verify TOGGL_API_BASE_URL constant
grep "TOGGL_API_BASE_URL" src/invoicing/services/toggl-client.service.ts

# TypeScript check
npx tsc --noEmit 2>&1 | grep "toggl-client" | head -10
```
</verify>

<done>
- `getClients()` method exists and calls `GET /api/v9/workspaces/{id}/clients`
- `getProjects()` method exists and calls `GET /api/v9/workspaces/{id}/projects`
- Both methods use the same retry logic as `getMonthSummary`
- Error handling uses NestJS built-in exceptions (`UnauthorizedException`, `BadGatewayException`)
- `requestWithRetry` supports both GET and POST methods
</done>

### Task 2: Convert TogglProjectSummary/TogglMonthSummary to interfaces, add new response types

<files>
- `src/invoicing/dto/toggl-summary.dto.ts` (modify)
</files>

<action>
1. Convert `TogglProjectSummary` class to interface:
   ```typescript
   export interface TogglProjectSummary {
     projectId: number;
     projectName: string;
     totalSeconds: number;
     totalHours: number;
   }
   ```

2. Convert `TogglMonthSummary` class to interface:
   ```typescript
   export interface TogglMonthSummary {
     clientId: number;
     projects: TogglProjectSummary[];
   }
   ```

3. Add new Toggl API response interfaces:
   ```typescript
   /** Toggl API v9 — GET /workspaces/{id}/clients */
   export interface TogglClient {
     id: number;
     name: string;
     wid: number;
     archived: boolean;
   }

   /** Toggl API v9 — GET /workspaces/{id}/projects */
   export interface TogglProject {
     id: number;
     name: string;
     wid: number;
     cid: number | null;
     client_id: number | null;
     active: boolean;
     color: string;
   }
   ```

4. In `toggl-client.service.ts`, update the `parseResponse` method. Since `TogglMonthSummary` and `TogglProjectSummary` are now interfaces (not classes), change `new TogglMonthSummary()` / `new TogglProjectSummary()` to object literal creation:
   ```typescript
   private parseResponse(response: TogglSummaryResponse): TogglMonthSummary[] {
     return response.groups
       .filter((group) => group.id !== null)
       .map((group): TogglMonthSummary => ({
         clientId: group.id as number,
         projects: group.sub_groups.map((subGroup): TogglProjectSummary => ({
           projectId: subGroup.id ?? 0,
           projectName: subGroup.title,
           totalSeconds: subGroup.seconds,
           totalHours: Math.round((subGroup.seconds / 3600) * 100) / 100,
         })),
       }));
   }
   ```
</action>

<verify>
```bash
# Verify classes are now interfaces
grep "export interface TogglProjectSummary" src/invoicing/dto/toggl-summary.dto.ts && echo "PASS"
grep "export interface TogglMonthSummary" src/invoicing/dto/toggl-summary.dto.ts && echo "PASS"

# Verify new types exist
grep "export interface TogglClient" src/invoicing/dto/toggl-summary.dto.ts && echo "PASS"
grep "export interface TogglProject" src/invoicing/dto/toggl-summary.dto.ts && echo "PASS"

# Verify no "new TogglMonthSummary" or "new TogglProjectSummary" exists in service
grep "new Toggl" src/invoicing/services/toggl-client.service.ts && echo "FAIL: still using class constructor" || echo "PASS: no class constructors"

# TypeScript check
npx tsc --noEmit 2>&1 | grep "toggl" | head -10
```
</verify>

<done>
- `TogglProjectSummary` and `TogglMonthSummary` are interfaces, not classes
- `TogglClient` and `TogglProject` interfaces added for the new API methods
- `parseResponse` uses object literals instead of `new` constructors
- All existing tests still pass
</done>

</tasks>

## <verify>
Final verification:
```bash
# 1. New methods exist
grep -c "async getClients\|async getProjects" src/invoicing/services/toggl-client.service.ts
# Should output 2

# 2. Interfaces (not classes)
grep "export class" src/invoicing/dto/toggl-summary.dto.ts | wc -l
# Should output 0

# 3. No class constructors in service
grep "new TogglMonthSummary\|new TogglProjectSummary" src/invoicing/services/toggl-client.service.ts | wc -l
# Should output 0

# 4. Tests pass
pnpm test -- --testPathPattern="toggl" --passWithNoTests 2>&1 | tail -5
```
</verify>
