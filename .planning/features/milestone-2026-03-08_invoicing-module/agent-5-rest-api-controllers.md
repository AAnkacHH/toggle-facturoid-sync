# Agent 5: REST API Controllers

**Jira:** MP-41 (REST API Controllers -- Invoicing Endpoints)
**Wave:** 4 (depends on Wave 3: Agent 4 must complete first)
**Prerequisite:** Agents 1, 2, 3, and 4 must have completed (all entities, services, and orchestration exist)

## <objective>

Create REST API controllers for: service_config CRUD (with secret masking), client_mapping CRUD, invoice generation trigger, time reports listing, invoice logs listing, and month preview. Apply validation pipes and proper HTTP status codes.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules (credentials never returned in plaintext)
- `.context/REQUIREMENTS.md` — REST API requirements
- `src/invoicing/invoicing.module.ts` — module where you register controllers
- `src/invoicing/entities/service-config.entity.ts` — service config entity
- `src/invoicing/entities/client-mapping.entity.ts` — client mapping entity
- `src/invoicing/entities/time-report.entity.ts` — time report entity
- `src/invoicing/entities/invoice-log.entity.ts` — invoice log entity
- `src/invoicing/services/invoicing.service.ts` — orchestration service
- `src/invoicing/services/encryption.service.ts` — encryption service
- `src/invoicing/dto/invoice-result.dto.ts` — result DTOs
- `src/main.ts` — bootstrap (you will add ValidationPipe here)

</context>

## <tasks>

### Task 1: Create DTOs for Request Validation + Service Config CRUD

**<files>**
- CREATE: `src/invoicing/dto/create-service-config.dto.ts`
- CREATE: `src/invoicing/dto/update-service-config.dto.ts`
- CREATE: `src/invoicing/dto/create-client-mapping.dto.ts`
- CREATE: `src/invoicing/dto/update-client-mapping.dto.ts`
- CREATE: `src/invoicing/dto/generate-invoices.dto.ts`
- CREATE: `src/invoicing/controllers/service-config.controller.ts`
- CREATE: `src/invoicing/services/service-config.service.ts`
- MODIFY: `src/main.ts` (add global ValidationPipe)

**<action>**

1. Update `src/main.ts`:
   - Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` before `app.listen()`
   - Import `ValidationPipe` from `@nestjs/common`

2. Create request DTOs using class-validator decorators:

   `create-service-config.dto.ts`:
   ```typescript
   {
     serviceName: string;   // @IsString(), @Length(1, 100)
     configKey: string;     // @IsString(), @Length(1, 100)
     value: string;         // @IsString() — the plaintext value to store
     isSecret: boolean;     // @IsBoolean()
   }
   ```

   `update-service-config.dto.ts`:
   - Same fields but all optional (@IsOptional on each)
   - If `value` is provided and `isSecret` is true, re-encrypt

   `create-client-mapping.dto.ts`:
   ```typescript
   {
     name: string;              // @IsString(), @Length(1, 255)
     togglClientId: number;     // @IsNumber(), @IsPositive()
     togglWorkspaceId: number;  // @IsNumber(), @IsPositive()
     fakturoidSubjectId: number; // @IsNumber(), @IsPositive()
     hourlyRate: number;        // @IsNumber(), @IsPositive()
     currency?: string;         // @IsOptional(), @IsString(), @Length(3, 3), default 'CZK'
     isActive?: boolean;        // @IsOptional(), @IsBoolean(), default true
   }
   ```

   `update-client-mapping.dto.ts`:
   - All fields optional

   `generate-invoices.dto.ts`:
   ```typescript
   {
     year: number;    // @IsNumber(), @Min(2020), @Max(2100)
     month: number;   // @IsNumber(), @Min(1), @Max(12)
   }
   ```

3. Create `src/invoicing/services/service-config.service.ts`:
   - Injectable service handling CRUD for service_config
   - Constructor: inject `Repository<ServiceConfig>`, `EncryptionService`
   - `create(dto)`: if isSecret=true, encrypt the value and store in encryptedValue/iv/authTag; if isSecret=false, store in plainValue
   - `findAll()`: return all configs with secrets MASKED (replace encryptedValue with '***')
   - `findOne(id)`: same masking
   - `findByService(serviceName)`: get all configs for a service name, masked
   - `update(id, dto)`: if updating value and isSecret=true, re-encrypt
   - `remove(id)`: soft or hard delete

   **CRITICAL: Never return encryptedValue, iv, or authTag in API responses.** Transform the entity before returning:
   - For secret configs: return `{ id, serviceName, configKey, isSecret: true, value: '******' }`
   - For plain configs: return `{ id, serviceName, configKey, isSecret: false, value: plainValue }`

4. Create `src/invoicing/controllers/service-config.controller.ts`:
   - `@Controller('api/service-config')`
   - `POST /` — create config (returns 201)
   - `GET /` — list all configs (masked secrets)
   - `GET /:id` — get single config (masked)
   - `GET /service/:serviceName` — get configs by service name (masked)
   - `PATCH /:id` — update config
   - `DELETE /:id` — delete config (returns 204)
   - Use proper HTTP exceptions (NotFoundException for missing IDs)

**DO NOT:**
- Return encrypted values, IVs, or auth tags in any API response
- Return decrypted secret values in any API response
- Log secret values
- Allow duplicate (serviceName, configKey) combinations — handle ConflictException

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- All DTO files exist with class-validator decorators
- ServiceConfigService exists with CRUD and secret masking
- ServiceConfigController exists with all endpoints
- ValidationPipe added to main.ts
- Secrets are NEVER exposed in responses

---

### Task 2: Create Client Mapping & Invoicing Controllers

**<files>**
- CREATE: `src/invoicing/controllers/client-mapping.controller.ts`
- CREATE: `src/invoicing/controllers/invoicing.controller.ts`
- MODIFY: `src/invoicing/invoicing.module.ts` (register all controllers and ServiceConfigService)

**<action>**

1. Create `src/invoicing/controllers/client-mapping.controller.ts`:
   - `@Controller('api/client-mappings')`
   - `POST /` — create client mapping (returns 201)
   - `GET /` — list all client mappings (optionally filter by `?active=true`)
   - `GET /:id` — get single client mapping
   - `PATCH /:id` — update client mapping
   - `DELETE /:id` — delete client mapping (returns 204)
   - Inject `Repository<ClientMapping>` directly (simple CRUD, no separate service needed)
   - Handle NotFoundException for missing IDs
   - Handle ConflictException for duplicate togglClientId

2. Create `src/invoicing/controllers/invoicing.controller.ts`:
   - `@Controller('api/invoicing')`
   - `POST /generate` — trigger invoice generation
     - Body: `GenerateInvoicesDto` (year, month)
     - Calls `invoicingService.generateMonthlyInvoices(year, month)`
     - Returns 200 with array of InvoiceGenerationResult
   - `GET /preview/:year/:month` — get month preview without creating anything
     - Calls `invoicingService.getMonthPreview(year, month)`
     - Returns 200 with MonthPreview
   - `GET /time-reports` — list time reports
     - Query params: `?year=2026&month=2&clientMappingId=uuid` (all optional filters)
     - Inject `Repository<TimeReport>` and query with filters
     - Returns 200 with array
   - `GET /invoice-logs` — list invoice logs
     - Query params: `?year=2026&month=2&status=created&clientMappingId=uuid` (all optional)
     - Inject `Repository<InvoiceLog>` and query with filters
     - Returns 200 with array
   - `GET /invoice-logs/:id` — get single invoice log
     - Returns 200 or 404

3. Update `src/invoicing/invoicing.module.ts`:
   - Add all 3 controllers to the `controllers` array: `ServiceConfigController`, `ClientMappingController`, `InvoicingController`
   - Add `ServiceConfigService` to providers
   - Ensure all repositories (ServiceConfig, ClientMapping, TimeReport, InvoiceLog) are in `TypeOrmModule.forFeature()`

**DO NOT:**
- Create a separate service for client_mapping CRUD — use repository directly in the controller (it is simple enough)
- Expose any Toggl or Fakturoid credentials through the invoicing endpoints
- Allow invoice generation without year/month validation

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit 2>&1 | head -20
```

**<done>**
- ClientMappingController exists with full CRUD
- InvoicingController exists with generate, preview, time-reports, and invoice-logs endpoints
- All controllers registered in InvoicingModule
- TypeScript compiles without errors

---

### Task 3: Write Controller Unit Tests

**<files>**
- CREATE: `src/invoicing/controllers/service-config.controller.spec.ts`
- CREATE: `src/invoicing/controllers/client-mapping.controller.spec.ts`
- CREATE: `src/invoicing/controllers/invoicing.controller.spec.ts`

**<action>**

Write unit tests for all 3 controllers:

1. `service-config.controller.spec.ts`:
   - Test that creating a secret config returns masked value
   - Test that listing configs returns masked secrets
   - Test NotFoundException for missing ID
   - Test ConflictException for duplicate serviceName+configKey

2. `client-mapping.controller.spec.ts`:
   - Test CRUD operations (create, list, get, update, delete)
   - Test NotFoundException for missing ID
   - Test that filtering by active works

3. `invoicing.controller.spec.ts`:
   - Test generate endpoint calls service and returns results
   - Test preview endpoint returns preview data
   - Test time-reports listing with query filters
   - Test invoice-logs listing with query filters

**Testing approach:**
- Mock all injected services and repositories
- Use `@nestjs/testing` Test.createTestingModule
- Focus on HTTP status codes, response shapes, and error handling

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='controller' --no-cache 2>&1 | tail -30
```

**<done>**
- All controller unit tests pass (minimum 12 test cases across 3 files)
- TypeScript compiles without errors
- `pnpm run lint` passes

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. All unit tests
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache

# 3. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint

# 4. Verify all controller files exist
ls -la src/invoicing/controllers/
ls -la src/invoicing/dto/
```

</verify>
