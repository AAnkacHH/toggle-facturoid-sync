# Agent 2: ClientMapping + TimeReport + InvoiceLog Domain -- UUID to Bigint Refactoring

## <objective>
Refactor the ClientMapping, TimeReport, and InvoiceLog entity primary keys from UUID to auto-increment integer, update all foreign key columns from UUID to integer, and update all files in this domain (entities, services, controllers, all remaining test specs, and the invoice-result DTO interface) to use numeric IDs.
</objective>

## <context>
**Read these files before starting:**
- `AGENTS.md` -- project rules and conventions
- `CLAUDE.md` -- claude-specific instructions

**Files you OWN (only you will modify these):**
- `src/invoicing/entities/client-mapping.entity.ts`
- `src/invoicing/entities/time-report.entity.ts`
- `src/invoicing/entities/invoice-log.entity.ts`
- `src/invoicing/services/client-mapping.service.ts`
- `src/invoicing/services/invoicing.service.ts`
- `src/invoicing/controllers/client-mapping.controller.ts`
- `src/invoicing/controllers/invoicing.controller.ts`
- `src/invoicing/controllers/client-mapping.controller.spec.ts`
- `src/invoicing/controllers/invoicing.controller.spec.ts`
- `src/invoicing/services/invoicing.service.spec.ts`
- `src/invoicing/services/invoice-cron.service.spec.ts`
- `src/invoicing/dto/invoice-result.dto.ts`

**Files you must NOT modify (owned by Agent 1):**
- `src/invoicing/entities/service-config.entity.ts`
- `src/invoicing/services/service-config.service.ts`
- `src/invoicing/controllers/service-config.controller.ts`
- `src/invoicing/controllers/service-config.controller.spec.ts`
- `src/invoicing/dto/masked-service-config-response.dto.ts`
- `src/invoicing/dto/invoice-generation-result-response.dto.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.service.spec.ts`

**Files you must NOT modify (owned by Agent 3):**
- `docs/api.md`
- `docs/architecture.md`

**Key facts:**
- Use `@PrimaryGeneratedColumn('increment')` (yields PostgreSQL `serial` / 4-byte integer). TypeScript type: `number`.
- Foreign key columns (`clientMappingId` in TimeReport and InvoiceLog) currently use `@Column({ type: 'uuid' })` with TypeScript `string`. Change to `@Column({ type: 'int' })` with TypeScript `number`.
- The `JoinColumn({ name: 'clientMappingId' })` decorator on ManyToOne relations does NOT need a type specification -- TypeORM infers the column type from the related entity's PK.  However, since we have an explicit `@Column({ type: 'uuid' })` for the FK field, we must update it to `@Column({ type: 'int' })`.
- In `invoicing.service.ts`, `mapping.id` is used to set `clientMappingId` on TimeReport and InvoiceLog. After the change, `mapping.id` is `number` and `clientMappingId` is also `number`, so assignments work directly.
- In `invoicing.service.ts`, the `processClientInvoice` method returns `InvoiceGenerationResult` with `clientMappingId: mapping.id`. The interface `InvoiceGenerationResult` in `invoice-result.dto.ts` has `clientMappingId: string` -- change to `clientMappingId: number`.
- In `client-mapping.service.ts`, the `findOne(id: string)` and `update(id: string, ...)` and `remove(id: string)` methods need parameter types changed to `number`.
- In `client-mapping.controller.ts` and `invoicing.controller.ts`, add `ParseIntPipe` for `:id` params.
- The `invoicing.controller.ts` method `getInvoiceLog(@Param('id') id: string)` needs `ParseIntPipe`.
- The `invoicing.controller.ts` methods `getTimeReports` and `getInvoiceLogs` accept `clientMappingId` as a query string. Since it comes as a string from the URL, and `FindOptionsWhere` will compare it against a `number` column, we need to parse it: `where.clientMappingId = parseInt(clientMappingId, 10)`.
- In `ClientMapping` entity, the `@ApiProperty` for `id` has UUID example -- update to numeric.
- In `TimeReport` entity, the `@ApiProperty` for `id` and `clientMappingId` have UUID examples -- update to numeric.
- In `InvoiceLog` entity, the `@ApiProperty` for `id` and `clientMappingId` have UUID examples -- update to numeric.
</context>

## <tasks>

### Task 1: Refactor all three entities (ClientMapping, TimeReport, InvoiceLog)

**<files>**
- `src/invoicing/entities/client-mapping.entity.ts`
- `src/invoicing/entities/time-report.entity.ts`
- `src/invoicing/entities/invoice-log.entity.ts`

**<action>**

In `client-mapping.entity.ts`:
1. Change `@PrimaryGeneratedColumn('uuid')` to `@PrimaryGeneratedColumn('increment')`
2. Change `id!: string` to `id!: number`
3. Update `@ApiProperty` for `id`: description to `'Unique identifier'`, example to `1`

In `time-report.entity.ts`:
1. Change `@PrimaryGeneratedColumn('uuid')` to `@PrimaryGeneratedColumn('increment')`
2. Change `id!: string` to `id!: number`
3. Change `@Column({ type: 'uuid', nullable: false })` on `clientMappingId` to `@Column({ type: 'int', nullable: false })`
4. Change `clientMappingId!: string` to `clientMappingId!: number`
5. Update `@ApiProperty` for `id`: description to `'Unique identifier'`, example to `1`
6. Update `@ApiProperty` for `clientMappingId`: description to `'Client mapping ID'`, example to `1`
7. Ensure the `@JoinColumn({ name: 'clientMappingId' })` decorator remains on the `@ManyToOne` relation -- it does NOT need `referencedColumnName` since it defaults to the PK.

In `invoice-log.entity.ts`:
1. Change `@PrimaryGeneratedColumn('uuid')` to `@PrimaryGeneratedColumn('increment')`
2. Change `id!: string` to `id!: number`
3. Change `@Column({ type: 'uuid', nullable: false })` on `clientMappingId` to `@Column({ type: 'int', nullable: false })`
4. Change `clientMappingId!: string` to `clientMappingId!: number`
5. Update `@ApiProperty` for `id`: description to `'Unique identifier'`, example to `1`
6. Update `@ApiProperty` for `clientMappingId`: description to `'Client mapping ID'`, example to `1`

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && grep -n "PrimaryGeneratedColumn\|type: 'uuid'" src/invoicing/entities/client-mapping.entity.ts src/invoicing/entities/time-report.entity.ts src/invoicing/entities/invoice-log.entity.ts
```
Should show `PrimaryGeneratedColumn('increment')` in all 3 files and NO `type: 'uuid'` remaining.

**<done>**
- All 3 entities use `@PrimaryGeneratedColumn('increment')` with `id!: number`
- FK columns `clientMappingId` use `type: 'int'` with `number` type
- All `@ApiProperty` decorators show numeric examples

---

### Task 2: Refactor services, controllers, and the invoice-result DTO

**<files>**
- `src/invoicing/services/client-mapping.service.ts`
- `src/invoicing/services/invoicing.service.ts`
- `src/invoicing/controllers/client-mapping.controller.ts`
- `src/invoicing/controllers/invoicing.controller.ts`
- `src/invoicing/dto/invoice-result.dto.ts`

**<action>**

In `invoice-result.dto.ts`:
1. Change `clientMappingId: string` to `clientMappingId: number` in the `InvoiceGenerationResult` interface.
2. The `ClientPreview` and `MonthPreview` interfaces do not reference IDs -- no changes needed.

In `client-mapping.service.ts`:
1. Change `findOne(id: string)` to `findOne(id: number)`
2. Change `update(id: string, dto)` to `update(id: number, dto)`
3. Change `remove(id: string)` to `remove(id: number)`
4. The `create` method assigns `togglClientId: String(dto.togglClientId)` etc. -- leave these as-is because those columns are `bigint` type which TypeORM represents as `string`.
5. In `update`, the duplicate check `if (duplicate && duplicate.id !== id)` is now `number !== number` -- correct, no logic change needed.

In `invoicing.service.ts`:
1. No parameter type changes needed (public methods `fetchAndSaveTimeReports`, `generateMonthlyInvoices`, `getMonthPreview` accept `year: number, month: number` -- no ID params).
2. Inside `fetchAndSaveTimeReports`, the line `clientMappingId: mapping.id` in `timeReportRepo.findOne` and `timeReportRepo.create` -- `mapping.id` is now `number` and `clientMappingId` is now `number`, so this works directly. No changes needed.
3. Inside `processClientInvoice`, the return objects have `clientMappingId: mapping.id` -- `mapping.id` is `number` and the `InvoiceGenerationResult` interface now has `clientMappingId: number`. Correct.
4. Inside `generateMonthlyInvoices`, the catch block also returns `clientMappingId: mapping.id` -- same as above, correct.
5. Review the entire file to ensure no string-to-number mismatches. The `mapping.id` was `string` before and is now `number`. All usages assign it to `clientMappingId` which is also now `number`. No explicit `String()` calls on `mapping.id` exist.

In `client-mapping.controller.ts`:
1. Add `ParseIntPipe` to the import from `@nestjs/common`
2. Change `findOne(@Param('id') id: string)` to `findOne(@Param('id', ParseIntPipe) id: number)`
3. Change `update(@Param('id') id: string, ...)` to `update(@Param('id', ParseIntPipe) id: number, ...)`
4. Change `remove(@Param('id') id: string)` to `remove(@Param('id', ParseIntPipe) id: number)`
5. Update all `@ApiParam` decorators: change `description` from `'UUID of the client mapping'` to `'ID of the client mapping'`, change `example` from `'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` to `1`

In `invoicing.controller.ts`:
1. Add `ParseIntPipe` to the existing import from `@nestjs/common` (it is already imported for the preview endpoint)
2. Change `getInvoiceLog(@Param('id') id: string)` to `getInvoiceLog(@Param('id', ParseIntPipe) id: number)`
3. Update `@ApiParam` for invoice-logs `:id`: change description from `'UUID of the invoice log'` to `'ID of the invoice log'`, change example from UUID to `1`
4. In `getTimeReports`, change `where.clientMappingId = clientMappingId` to `where.clientMappingId = parseInt(clientMappingId, 10)` (since query params are strings)
5. In `getInvoiceLogs`, change `where.clientMappingId = clientMappingId` to `where.clientMappingId = parseInt(clientMappingId, 10)`
6. Update `@ApiQuery` for `clientMappingId` in both `getTimeReports` and `getInvoiceLogs`: change description from `'Filter by client mapping UUID'` to `'Filter by client mapping ID'`, change example from UUID to `'1'`
7. In the `getInvoiceLog` method, the `invoiceLogRepo.findOne({ where: { id } })` now receives `id: number` which matches the entity `id: number`. Correct.

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit --pretty 2>&1 | head -60
```

**<done>**
- `InvoiceGenerationResult.clientMappingId` is `number`
- `ClientMappingService` methods accept `id: number`
- Both controllers use `ParseIntPipe` for `:id` params
- Query param `clientMappingId` is parsed to `number` before being used in `where` clauses
- All Swagger decorators show numeric ID examples

---

### Task 3: Update all test files

**<files>**
- `src/invoicing/controllers/client-mapping.controller.spec.ts`
- `src/invoicing/controllers/invoicing.controller.spec.ts`
- `src/invoicing/services/invoicing.service.spec.ts`
- `src/invoicing/services/invoice-cron.service.spec.ts`

**<action>**

In `client-mapping.controller.spec.ts`:
1. In `createMapping` helper, change `id: 'map-uuid-1'` to `id: 1`
2. Update all test calls:
   - `controller.findOne('map-uuid-1')` -> `controller.findOne(1)`
   - `service.findOne` `toHaveBeenCalledWith('map-uuid-1')` -> `toHaveBeenCalledWith(1)`
   - `controller.update('map-uuid-1', ...)` -> `controller.update(1, ...)`
   - `service.update` `toHaveBeenCalledWith('map-uuid-1', ...)` -> `toHaveBeenCalledWith(1, ...)`
   - `controller.remove('map-uuid-1')` -> `controller.remove(1)`
   - `service.remove` `toHaveBeenCalledWith('map-uuid-1')` -> `toHaveBeenCalledWith(1)`
   - `controller.findOne('nonexistent')` -> `controller.findOne(999)`
   - `controller.update('nonexistent', ...)` -> `controller.update(999, ...)`
   - `controller.remove('nonexistent')` -> `controller.remove(999)`

In `invoicing.controller.spec.ts`:
1. In `createTimeReport` helper, change `id: 'tr-uuid-1'` to `id: 1` and `clientMappingId: 'mapping-uuid-1'` to `clientMappingId: 1`
2. In `createInvoiceLog` helper, change `id: 'log-uuid-1'` to `id: 1` and `clientMappingId: 'mapping-uuid-1'` to `clientMappingId: 1`
3. In `generate` test, change `clientMappingId: 'mapping-uuid-1'` to `clientMappingId: 1`
4. In `getTimeReports` filter by clientMappingId test, change `'mapping-uuid-1'` to `'1'` (still a string -- it's a query param). Update the `toHaveBeenCalledWith` to expect `{ where: { clientMappingId: 1 } }` (parsed to number).
5. In `getInvoiceLogs` filter by clientMappingId test, change `'mapping-uuid-1'` to `'1'`. Update `toHaveBeenCalledWith` to expect `{ where: { clientMappingId: 1 } }`.
6. In `getInvoiceLog` test, change `controller.getInvoiceLog('log-uuid-1')` to `controller.getInvoiceLog(1)` and update `invoiceLogRepo.findOne` `toHaveBeenCalledWith({ where: { id: 1 } })`.
7. In `getInvoiceLog` 404 test, change `controller.getInvoiceLog('nonexistent')` to `controller.getInvoiceLog(999)`.

In `invoicing.service.spec.ts`:
1. In `createClientMapping` helper, change `id: 'mapping-uuid-1'` to `id: 1`
2. In `createSecondClientMapping`, change `id: 'mapping-uuid-2'` to `id: 2`
3. In `createTimeReport` helper, change `id: 'tr-uuid-1'` to `id: 1` and `clientMappingId: 'mapping-uuid-1'` to `clientMappingId: 1`
4. In `createInvoiceLog` helper, change `id: 'log-uuid-1'` to `id: 1` and `clientMappingId: 'mapping-uuid-1'` to `clientMappingId: 1`
5. In `createSlugConfig` helper, change `id: 'config-uuid-slug'` to `id: 100` (a different number to avoid confusion with mapping IDs)
6. Update ALL test mock data that creates entities with string UUID ids:
   - `{ ...data, id: 'new-tr-uuid' }` -> `{ ...data, id: 10 }`
   - `{ ...data, id: 'new-uuid' }` -> `{ ...data, id: 10 }`
   - `{ ...data, id: 'log-uuid-new' }` -> `{ ...data, id: 10 }`
   - `{ ...data, id: 'log-new' }` -> `{ ...data, id: 10 }`
   - `{ ...data, id: 'log-uuid-pending' }` -> `{ ...data, id: 10 }`
   - `{ ...data, id: 'log-uuid-err' }` -> `{ ...data, id: 10 }`
7. In `createTimeReport` overrides used in tests, change `clientMappingId: 'mapping-uuid-2'` to `clientMappingId: 2`
8. In the upsert test, change `id: 'existing-tr-uuid'` to `id: 5` and update the assertion `expect(savedEntity.id).toBe('existing-tr-uuid')` to `expect(savedEntity.id).toBe(5)`
9. In the duplicate invoice check test, change `fakturoidInvoiceId: '99999'` -- this is the InvoiceLog's `fakturoidInvoiceId` field which is `bigint` (string type), so leave it as `'99999'`.

In `invoice-cron.service.spec.ts`:
1. Change all `clientMappingId: 'uuid-1'` to `clientMappingId: 1`, `'uuid-2'` to `2`, `'uuid-3'` to `3` in the mock `InvoiceGenerationResult` objects.

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-coverage 2>&1 | tail -30
```
All tests should pass.

**<done>**
- All mock entity IDs in all spec files use numbers instead of UUID strings
- All mock `clientMappingId` values use numbers
- All controller test calls pass numbers for `:id` params
- All query param tests pass string representations of numbers (e.g., `'1'`) and expect parsed numbers in `where` clauses
- All tests pass
</tasks>

## <verify>
After all tasks are complete, run the full test suite:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run test 2>&1 | tail -40
```
All unit tests should pass.

Then run lint:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint 2>&1 | tail -20
```
No lint errors.

Then run build:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run build 2>&1 | tail -20
```
Build should succeed.
</verify>
