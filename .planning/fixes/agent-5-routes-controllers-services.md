# Agent 5: Routes, Controllers, Services & Code Quality

## <objective>
Restructure API routes to match the Jira spec (all under `/api/invoicing/`), extract ClientMappingService from the controller, add missing endpoints (reports/fetch, toggl/clients, toggl/projects, fakturoid/subjects), validate status enum, add grandTotal to MonthPreview, extract magic strings to constants, fix hardcoded 'hod' unit name, and standardize error handling in InvoicingService. This agent handles FIX 5, and the controller/service/DTO parts of FIX 7.
</objective>

## <context>
Read these files before starting:
- `AGENTS.md` — project rules, tech stack, architecture
- `src/invoicing/controllers/invoicing.controller.ts` — restructure and add endpoints
- `src/invoicing/controllers/client-mapping.controller.ts` — change route prefix, extract service
- `src/invoicing/controllers/service-config.controller.ts` — change route prefix
- `src/invoicing/services/invoicing.service.ts` — add constants, fix 'hod', standardize errors, add grandTotal
- `src/invoicing/dto/invoice-result.dto.ts` — add grandTotal to MonthPreview
- `src/invoicing/dto/generate-invoices.dto.ts` — reference
- `src/invoicing/entities/invoice-log.entity.ts` — reference for InvoiceStatus enum
- `src/invoicing/invoicing.module.ts` — add new ClientMappingService provider

IMPORTANT: Do NOT modify `fakturoid-client.service.ts`, `toggl-client.service.ts`, `toggl-summary.dto.ts`, or `fakturoid-invoice.dto.ts` — other agents work on those files.

NOTE: This agent depends on Agent 4 having added `getClients()` and `getProjects()` methods to `TogglClientService`. If working truly in parallel, implement the controller endpoints and trust that the methods will exist. The TypeScript compiler will catch mismatches later.
</context>

## <tasks>

### Task 1: Create constants file, extract ClientMappingService, update MonthPreview DTO

<files>
- `src/invoicing/constants.ts` (create)
- `src/invoicing/services/client-mapping.service.ts` (create)
- `src/invoicing/dto/invoice-result.dto.ts` (modify)
</files>

<action>
1. **Create `src/invoicing/constants.ts`** — extract all magic strings:
   ```typescript
   /** Service names used in service_config table */
   export const SERVICE_NAMES = {
     TOGGL: 'toggl',
     FAKTUROID: 'fakturoid',
     SYSTEM: 'system',
   } as const;

   /** Config keys for Toggl service */
   export const TOGGL_CONFIG_KEYS = {
     API_TOKEN: 'api_token',
     WORKSPACE_ID: 'workspace_id',
   } as const;

   /** Config keys for Fakturoid service */
   export const FAKTUROID_CONFIG_KEYS = {
     CLIENT_ID: 'client_id',
     CLIENT_SECRET: 'client_secret',
     SLUG: 'slug',
     USER_AGENT_EMAIL: 'user_agent_email',
   } as const;

   /** Invoice line defaults */
   export const INVOICE_DEFAULTS = {
     UNIT_NAME: 'hod',
     PAYMENT_METHOD: 'bank',
     DEFAULT_CURRENCY: 'CZK',
   } as const;
   ```
   NOTE: These constants are defined here but will NOT be imported by Agent 3 or Agent 4's files right now to avoid conflicts. They can be adopted in those files later during the wiring step. For now, only files THIS agent modifies will import from this constants file.

2. **Create `src/invoicing/services/client-mapping.service.ts`** — extract business logic from controller:
   ```typescript
   @Injectable()
   export class ClientMappingService {
     constructor(
       @InjectRepository(ClientMapping)
       private readonly repo: Repository<ClientMapping>,
     ) {}

     async create(dto: CreateClientMappingDto): Promise<ClientMapping> {
       // Move duplicate check logic from controller
       const existing = await this.repo.findOne({
         where: { togglClientId: String(dto.togglClientId) },
       });
       if (existing) {
         throw new ConflictException(
           `ClientMapping with togglClientId=${dto.togglClientId} already exists`,
         );
       }

       const entity = this.repo.create({
         name: dto.name,
         togglClientId: String(dto.togglClientId),
         togglWorkspaceId: String(dto.togglWorkspaceId),
         fakturoidSubjectId: String(dto.fakturoidSubjectId),
         hourlyRate: String(dto.hourlyRate),
         currency: dto.currency ?? INVOICE_DEFAULTS.DEFAULT_CURRENCY,
         isActive: dto.isActive ?? true,
       });

       return this.repo.save(entity);
     }

     async findAll(active?: string): Promise<ClientMapping[]> {
       if (active === 'true') {
         return this.repo.find({ where: { isActive: true } });
       }
       if (active === 'false') {
         return this.repo.find({ where: { isActive: false } });
       }
       return this.repo.find();
     }

     async findOne(id: string): Promise<ClientMapping> {
       const mapping = await this.repo.findOne({ where: { id } });
       if (!mapping) {
         throw new NotFoundException(`ClientMapping with id="${id}" not found`);
       }
       return mapping;
     }

     async update(id: string, dto: UpdateClientMappingDto): Promise<ClientMapping> {
       // Move update logic from controller
       const mapping = await this.findOne(id);

       if (dto.togglClientId !== undefined) {
         const duplicate = await this.repo.findOne({
           where: { togglClientId: String(dto.togglClientId) },
         });
         if (duplicate && duplicate.id !== id) {
           throw new ConflictException(
             `ClientMapping with togglClientId=${dto.togglClientId} already exists`,
           );
         }
         mapping.togglClientId = String(dto.togglClientId);
       }

       if (dto.name !== undefined) mapping.name = dto.name;
       if (dto.togglWorkspaceId !== undefined) mapping.togglWorkspaceId = String(dto.togglWorkspaceId);
       if (dto.fakturoidSubjectId !== undefined) mapping.fakturoidSubjectId = String(dto.fakturoidSubjectId);
       if (dto.hourlyRate !== undefined) mapping.hourlyRate = String(dto.hourlyRate);
       if (dto.currency !== undefined) mapping.currency = dto.currency;
       if (dto.isActive !== undefined) mapping.isActive = dto.isActive;

       return this.repo.save(mapping);
     }

     async remove(id: string): Promise<void> {
       const mapping = await this.findOne(id);
       await this.repo.remove(mapping);
     }
   }
   ```
   Import `INVOICE_DEFAULTS` from `../constants`.

3. **Modify `src/invoicing/dto/invoice-result.dto.ts`** — add grandTotal:
   ```typescript
   export interface MonthPreview {
     year: number;
     month: number;
     clients: ClientPreview[];
     grandTotal: {
       hours: number;
       amount: number;
     };
   }
   ```
</action>

<verify>
```bash
test -f src/invoicing/constants.ts && echo "PASS: constants file created"
test -f src/invoicing/services/client-mapping.service.ts && echo "PASS: client-mapping.service.ts created"
grep "grandTotal" src/invoicing/dto/invoice-result.dto.ts && echo "PASS: grandTotal added to MonthPreview"
```
</verify>

<done>
- `src/invoicing/constants.ts` exists with `SERVICE_NAMES`, `TOGGL_CONFIG_KEYS`, `FAKTUROID_CONFIG_KEYS`, `INVOICE_DEFAULTS`
- `src/invoicing/services/client-mapping.service.ts` exists with full CRUD logic extracted from controller
- `MonthPreview` interface includes `grandTotal: { hours: number; amount: number }`
</done>

### Task 2: Restructure routes, update controllers, fix InvoicingService

<files>
- `src/invoicing/controllers/client-mapping.controller.ts` (modify — change route, use service)
- `src/invoicing/controllers/service-config.controller.ts` (modify — change route)
- `src/invoicing/controllers/invoicing.controller.ts` (modify — add new endpoints, validate status)
- `src/invoicing/services/invoicing.service.ts` (modify — use constants, fix 'hod', add grandTotal, standardize errors)
- `src/invoicing/invoicing.module.ts` (modify — add ClientMappingService provider)
</files>

<action>
1. **Change `service-config.controller.ts` route prefix:**
   - Change `@Controller('api/service-config')` to `@Controller('api/invoicing/config')`
   - No other changes needed

2. **Refactor `client-mapping.controller.ts`:**
   - Change `@Controller('api/client-mappings')` to `@Controller('api/invoicing/clients')`
   - Replace `@InjectRepository(ClientMapping) private readonly repo: Repository<ClientMapping>` with `private readonly clientMappingService: ClientMappingService`
   - Delegate all methods to the service:
     ```typescript
     @Post()
     @HttpCode(HttpStatus.CREATED)
     create(@Body() dto: CreateClientMappingDto): Promise<ClientMapping> {
       return this.clientMappingService.create(dto);
     }

     @Get()
     findAll(@Query('active') active?: string): Promise<ClientMapping[]> {
       return this.clientMappingService.findAll(active);
     }
     // ... etc
     ```
   - Remove all `Repository` and `InjectRepository` imports
   - Remove `ConflictException` import (it's in the service now)

3. **Add new endpoints to `invoicing.controller.ts`:**
   - Add `POST /api/invoicing/reports/fetch` endpoint:
     ```typescript
     @Post('reports/fetch')
     @HttpCode(HttpStatus.OK)
     fetchReports(@Body() dto: GenerateInvoicesDto): Promise<TimeReport[]> {
       return this.invoicingService.fetchAndSaveTimeReports(dto.year, dto.month);
     }
     ```
   - Add `GET /api/invoicing/toggl/clients` endpoint:
     ```typescript
     @Get('toggl/clients')
     getTogglClients(): Promise<TogglClient[]> {
       return this.togglClient.getClients();
     }
     ```
     Inject `TogglClientService` in the controller constructor.
   - Add `GET /api/invoicing/toggl/projects` endpoint:
     ```typescript
     @Get('toggl/projects')
     getTogglProjects(): Promise<TogglProject[]> {
       return this.togglClient.getProjects();
     }
     ```
   - Add `GET /api/invoicing/fakturoid/subjects` endpoint:
     ```typescript
     @Get('fakturoid/subjects')
     async getFakturoidSubjects(): Promise<FakturoidSubject[]> {
       const slug = await this.invoicingService.getFakturoidSlug();
       return this.fakturoidClient.getSubjects(slug);
     }
     ```
     Inject `FakturoidClientService` in the controller constructor.
     NOTE: `getFakturoidSlug()` is currently a `private` method on InvoicingService. Make it `public` (or add a public wrapper).
   - **Validate `status` enum** in `getInvoiceLogs` (FIX 7 — S-MAJ-2):
     ```typescript
     if (status) {
       if (Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
         where.status = status as InvoiceStatus;
       } else {
         throw new BadRequestException(
           `Invalid status. Must be one of: ${Object.values(InvoiceStatus).join(', ')}`,
         );
       }
     }
     ```
     Add `BadRequestException` to imports.

4. **Fix `invoicing.service.ts`:**
   - Import constants: `import { INVOICE_DEFAULTS, SERVICE_NAMES, FAKTUROID_CONFIG_KEYS } from '../constants';`
   - Replace `'hod'` with `INVOICE_DEFAULTS.UNIT_NAME` in the `processClientInvoice` method (line 293)
   - Replace `'bank'` with `INVOICE_DEFAULTS.PAYMENT_METHOD` (line 318)
   - Replace `'fakturoid'` with `SERVICE_NAMES.FAKTUROID` in `getFakturoidSlug` (line 373)
   - Replace `'slug'` with `FAKTUROID_CONFIG_KEYS.SLUG` in `getFakturoidSlug` (line 374)
   - Change `getFakturoidSlug()` from `private` to `public` (so the controller can call it for the subjects endpoint)
   - Replace `throw new Error(...)` in `getFakturoidSlug()` with `throw new InternalServerErrorException(...)` (standardize error handling)
   - Add `import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';`
   - Add `grandTotal` calculation to `getMonthPreview()`:
     ```typescript
     const grandTotal = {
       hours: clients.reduce((sum, c) => sum + c.totalHours, 0),
       amount: clients.reduce((sum, c) => sum + c.totalAmount, 0),
     };
     return { year, month, clients, grandTotal };
     ```

5. **Update `invoicing.module.ts`:**
   - Add `import { ClientMappingService } from './services/client-mapping.service';`
   - Add `ClientMappingService` to `providers` array
   - Remove `ClientMappingService` from `exports` (not needed by other modules)
   - While here, trim the `exports` array — only export what other modules need. Since no other module currently imports from InvoicingModule, remove all exports except `TypeOrmModule` (which might be needed):
     ```typescript
     exports: [TypeOrmModule],
     ```
     Actually, check if any other module uses these exports. Since the only other module is `AppModule` and it doesn't import services from `InvoicingModule`, we can safely trim exports. But keep them for now to avoid breaking anything — just add `ClientMappingService` to providers.
</action>

<verify>
```bash
# Verify route changes
grep "api/invoicing/config" src/invoicing/controllers/service-config.controller.ts && echo "PASS: config route"
grep "api/invoicing/clients" src/invoicing/controllers/client-mapping.controller.ts && echo "PASS: clients route"

# Verify new endpoints
grep "reports/fetch\|toggl/clients\|toggl/projects\|fakturoid/subjects" src/invoicing/controllers/invoicing.controller.ts

# Verify status validation
grep "InvoiceStatus" src/invoicing/controllers/invoicing.controller.ts | grep -v "import"

# Verify constants usage
grep "INVOICE_DEFAULTS\|SERVICE_NAMES" src/invoicing/services/invoicing.service.ts

# Verify grandTotal
grep "grandTotal" src/invoicing/services/invoicing.service.ts

# Verify ClientMappingService in module
grep "ClientMappingService" src/invoicing/invoicing.module.ts

# TypeScript check
npx tsc --noEmit 2>&1 | grep -E "(invoicing|client-mapping|service-config)" | head -20
```
</verify>

<done>
- `ServiceConfigController` route: `/api/invoicing/config`
- `ClientMappingController` route: `/api/invoicing/clients`, uses `ClientMappingService`
- `InvoicingController` has new endpoints: `reports/fetch`, `toggl/clients`, `toggl/projects`, `fakturoid/subjects`
- `status` query parameter is validated against `InvoiceStatus` enum
- `InvoicingService` uses constants instead of magic strings
- `getMonthPreview` includes `grandTotal`
- `getFakturoidSlug` is public and throws `InternalServerErrorException`
- `ClientMappingService` is registered in `InvoicingModule`
</done>

</tasks>

## <verify>
Final verification:
```bash
# 1. All routes are under /api/invoicing/
grep "@Controller" src/invoicing/controllers/*.ts

# 2. No more "api/client-mappings" or "api/service-config"
grep "api/client-mappings\|api/service-config" src/invoicing/controllers/*.ts | wc -l
# Should be 0

# 3. Constants file exists and is imported
test -f src/invoicing/constants.ts && echo "PASS"
grep "constants" src/invoicing/services/invoicing.service.ts && echo "PASS"

# 4. ClientMappingService exists and is in module
test -f src/invoicing/services/client-mapping.service.ts && echo "PASS"
grep "ClientMappingService" src/invoicing/invoicing.module.ts && echo "PASS"

# 5. No 'hod' hardcode in service
grep "'hod'" src/invoicing/services/invoicing.service.ts | wc -l
# Should be 0

# 6. Tests
pnpm test -- --testPathPattern="invoicing|client-mapping|service-config" --passWithNoTests 2>&1 | tail -10
```
</verify>
