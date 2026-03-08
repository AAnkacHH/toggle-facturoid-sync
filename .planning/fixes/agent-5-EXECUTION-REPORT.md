## PLAN COMPLETED: Agent 5 - Routes, Controllers, Services & Code Quality

**Tasks:** 2/2

### Changes Summary:

**Task 1: Create constants file, extract ClientMappingService, update MonthPreview DTO**
- Created `src/invoicing/constants.ts` with `SERVICE_NAMES`, `TOGGL_CONFIG_KEYS`, `FAKTUROID_CONFIG_KEYS`, `INVOICE_DEFAULTS`
- Created `src/invoicing/services/client-mapping.service.ts` with full CRUD logic extracted from controller
- Updated `src/invoicing/dto/invoice-result.dto.ts` to add `grandTotal: { hours: number; amount: number }` to `MonthPreview`

**Task 2: Restructure routes, update controllers, fix InvoicingService**
- Changed `ServiceConfigController` route from `api/service-config` to `api/invoicing/config`
- Changed `ClientMappingController` route from `api/client-mappings` to `api/invoicing/clients` and delegated all logic to `ClientMappingService`
- Added 4 new endpoints to `InvoicingController`: `POST reports/fetch`, `GET toggl/clients`, `GET toggl/projects`, `GET fakturoid/subjects`
- Added `status` enum validation in `getInvoiceLogs` (throws `BadRequestException` for invalid status)
- Replaced hardcoded `'hod'` with `INVOICE_DEFAULTS.UNIT_NAME` in `InvoicingService`
- Replaced hardcoded `'bank'` with `INVOICE_DEFAULTS.PAYMENT_METHOD` in `InvoicingService`
- Replaced hardcoded `'fakturoid'`/`'slug'` with `SERVICE_NAMES.FAKTUROID`/`FAKTUROID_CONFIG_KEYS.SLUG` in `getFakturoidSlug`
- Changed `getFakturoidSlug()` from `private` to `public`
- Replaced `throw new Error(...)` with `throw new InternalServerErrorException(...)` in `getFakturoidSlug`
- Added `grandTotal` calculation to `getMonthPreview()`
- Added `ClientMappingService` to `InvoicingModule` providers
- Updated all 3 test files to match new signatures and behaviors

### Created files:
- `src/invoicing/constants.ts`
- `src/invoicing/services/client-mapping.service.ts`

### Modified files:
- `src/invoicing/dto/invoice-result.dto.ts`
- `src/invoicing/controllers/service-config.controller.ts`
- `src/invoicing/controllers/client-mapping.controller.ts`
- `src/invoicing/controllers/invoicing.controller.ts`
- `src/invoicing/services/invoicing.service.ts`
- `src/invoicing/invoicing.module.ts`
- `src/invoicing/controllers/client-mapping.controller.spec.ts`
- `src/invoicing/controllers/invoicing.controller.spec.ts`
- `src/invoicing/services/invoicing.service.spec.ts`

### Verification:
- All 132 tests pass (11 test suites)
- All routes now under `/api/invoicing/` prefix
- No old route prefixes remain
- No hardcoded `'hod'` in invoicing service
- Constants file properly imported and used

### Notes:
- `pnpm run build` fails with pre-existing TS2564 (strictPropertyInitialization) errors across ALL entity and DTO files in the project. These errors existed before this agent's changes and affect files not owned by this agent. The build issues are a project-wide tsconfig concern (strict: true without initializers on decorated properties).
- The constants file defines values for Toggl and Fakturoid config keys, but only files modified by THIS agent import from it. Other agents' files (toggl-client.service.ts, fakturoid-client.service.ts) can adopt the constants in a later wiring step.
