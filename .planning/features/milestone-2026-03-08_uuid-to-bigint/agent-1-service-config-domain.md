# Agent 1: ServiceConfig Domain -- UUID to Bigint Refactoring

## <objective>
Refactor the ServiceConfig entity primary key from UUID to bigint auto-increment, and update all files in the ServiceConfig domain (service, controller, controller spec, response DTO, auth service, auth service spec, invoice generation result response DTO) to use numeric IDs instead of UUID strings.
</objective>

## <context>
**Read these files before starting:**
- `AGENTS.md` -- project rules and conventions
- `CLAUDE.md` -- claude-specific instructions

**Files you OWN (only you will modify these):**
- `src/invoicing/entities/service-config.entity.ts`
- `src/invoicing/services/service-config.service.ts`
- `src/invoicing/controllers/service-config.controller.ts`
- `src/invoicing/controllers/service-config.controller.spec.ts`
- `src/invoicing/dto/masked-service-config-response.dto.ts`
- `src/invoicing/dto/invoice-generation-result-response.dto.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.service.spec.ts`

**Key facts:**
- TypeORM bigint columns are returned as `string` in JavaScript (not `number`), because JS cannot safely represent all bigint values. However, for auto-increment IDs in a small app, we will use `number` type in TypeScript and TypeORM will handle the conversion. The `@PrimaryGeneratedColumn('increment')` with no explicit type defaults to `integer` (4-byte). To get `bigint`, specify `{ type: 'bigint' }`.
- DECISION: Use `@PrimaryGeneratedColumn('increment')` WITHOUT specifying bigint type -- this yields a standard PostgreSQL `serial` (4-byte integer), which is more than sufficient for this self-hosted app and avoids the string-representation issue. The TypeScript type will be `number`.
- The `MaskedServiceConfig` interface in `service-config.service.ts` has `id: string` -- change to `id: number`.
- The `InvoiceGenerationResult` interface is in `src/invoicing/dto/invoice-result.dto.ts` which is owned by Agent 2. The Swagger response DTO `InvoiceGenerationResultResponseDto` has `clientMappingId: string` -- change to `clientMappingId: number`. This DTO is a Swagger decorator class that mirrors the interface but is independent.
- Controllers currently accept `:id` as a string param. After refactoring, add `ParseIntPipe` to convert `:id` string params to numbers.
- The auth service uses `ServiceConfig` entity but only via `findOne({ where: {...} })` by serviceName/configKey -- never by ID. So auth.service.ts likely needs no changes to logic, but the entity type change propagates through type checks.
</context>

## <tasks>

### Task 1: Refactor ServiceConfig entity and its service

**<files>**
- `src/invoicing/entities/service-config.entity.ts`
- `src/invoicing/services/service-config.service.ts`

**<action>**

In `service-config.entity.ts`:
1. Change `@PrimaryGeneratedColumn('uuid')` to `@PrimaryGeneratedColumn('increment')`
2. Change `id!: string` to `id!: number`

In `service-config.service.ts`:
1. Change the `MaskedServiceConfig` interface field `id: string` to `id: number`
2. Change the `findOne(id: string)` parameter type to `findOne(id: number)`
3. Change the `update(id: string, ...)` parameter type to `update(id: number, ...)`
4. Change the `remove(id: string)` parameter type to `remove(id: number)`
5. In the `update` method, the duplicate check `if (duplicate && duplicate.id !== id)` -- this comparison is now `number !== number` which is correct, no changes needed to the logic.

Do NOT change any other entity files -- those are owned by Agent 2.

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit --pretty 2>&1 | head -50
```
(Type errors are expected until Agent 2 completes, but verify no syntax errors in the files you changed.)

**<done>**
- `ServiceConfig.id` is `number` with `@PrimaryGeneratedColumn('increment')`
- `MaskedServiceConfig.id` is `number`
- All service methods accept `id: number` instead of `id: string`

---

### Task 2: Refactor ServiceConfig controller, response DTO, and auth module

**<files>**
- `src/invoicing/controllers/service-config.controller.ts`
- `src/invoicing/dto/masked-service-config-response.dto.ts`
- `src/invoicing/dto/invoice-generation-result-response.dto.ts`
- `src/auth/auth.service.ts`

**<action>**

In `service-config.controller.ts`:
1. Add `ParseIntPipe` to the import from `@nestjs/common`
2. Change `findOne(@Param('id') id: string)` to `findOne(@Param('id', ParseIntPipe) id: number)`
3. Change `update(@Param('id') id: string, ...)` to `update(@Param('id', ParseIntPipe) id: number, ...)`
4. Change `remove(@Param('id') id: string)` to `remove(@Param('id', ParseIntPipe) id: number)`
5. Update all `@ApiParam` decorators: change `description` from `'UUID of the service configuration'` to `'ID of the service configuration'` and change `example` from `'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` to `1`

In `masked-service-config-response.dto.ts`:
1. Change `id!: string` to `id!: number`
2. Update the `@ApiProperty` for `id`: change `description` to `'Unique identifier'`, change `example` to `1`

In `invoice-generation-result-response.dto.ts`:
1. Change `clientMappingId!: string` to `clientMappingId!: number`
2. Update the `@ApiProperty` for `clientMappingId`: change `description` to `'ID of the client mapping'`, change `example` to `1`

In `auth.service.ts`:
- No logic changes are needed. The auth service never references `ServiceConfig.id` directly -- it only queries by `serviceName` and `configKey`. But review the file to confirm no `id` references exist that would break.

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit --pretty 2>&1 | grep -E "(service-config|masked-service|invoice-generation-result|auth\.service)" | head -20
```

**<done>**
- Controller uses `ParseIntPipe` for all `:id` params
- All Swagger `@ApiParam` and `@ApiProperty` decorators show numeric ID examples instead of UUIDs
- `MaskedServiceConfigResponseDto.id` is `number`
- `InvoiceGenerationResultResponseDto.clientMappingId` is `number`

---

### Task 3: Update test files for ServiceConfig domain

**<files>**
- `src/invoicing/controllers/service-config.controller.spec.ts`
- `src/auth/auth.service.spec.ts`

**<action>**

In `service-config.controller.spec.ts`:
1. In the `createMaskedConfig` helper, change `id: 'cfg-uuid-1'` to `id: 1`
2. Update all test cases that pass string UUIDs to use numbers instead:
   - `controller.findOne('cfg-uuid-1')` -> `controller.findOne(1)`
   - `service.findOne` `toHaveBeenCalledWith('cfg-uuid-1')` -> `toHaveBeenCalledWith(1)`
   - `controller.update('cfg-uuid-1', ...)` -> `controller.update(1, ...)`
   - `service.update` `toHaveBeenCalledWith('cfg-uuid-1', ...)` -> `toHaveBeenCalledWith(1, ...)`
   - `controller.remove('cfg-uuid-1')` -> `controller.remove(1)`
   - `service.remove` `toHaveBeenCalledWith('cfg-uuid-1')` -> `toHaveBeenCalledWith(1)`
   - `controller.findOne('nonexistent')` -> `controller.findOne(999)`
   - `controller.remove('nonexistent')` -> `controller.remove(999)`
3. Update the second config in `findAll` test: `id: 'cfg-uuid-2'` -> `id: 2`

In `auth.service.spec.ts`:
- In the `'should throw ConflictException if secret already configured'` test, change `repo.findOne.mockResolvedValue({ id: '1', plainValue: 'salt$hash' })` to `repo.findOne.mockResolvedValue({ id: 1, plainValue: 'salt$hash' })`
- In `isSetupComplete` tests, change `repo.findOne.mockResolvedValue({ id: '1' })` to `repo.findOne.mockResolvedValue({ id: 1 })`

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern="service-config.controller.spec|auth.service.spec" --no-coverage 2>&1 | tail -20
```
(Tests may fail if Agent 2 has not yet completed, but the test files themselves should have no syntax errors.)

**<done>**
- All mock IDs in ServiceConfig controller spec use numbers (1, 2, 999) instead of UUID strings
- All mock IDs in auth service spec use numbers instead of strings
- Tests pass when run in isolation (after Agent 2 also completes)
</tasks>

## <verify>
After all tasks are complete, run:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern="service-config.controller.spec|auth.service.spec" --no-coverage
```
Both test suites should pass (once Agent 2 has also completed their changes).

Then run a full type check:
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit
```
(May have errors from files owned by Agent 2 -- that is expected. Verify no errors in YOUR files.)
</verify>
