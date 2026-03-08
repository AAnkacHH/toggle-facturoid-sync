# Agent 6: Cron Job -- Monthly Invoice Generation

**Jira:** MP-42 (Cron Job -- Monthly Invoice Generation)
**Wave:** 4 (depends on Wave 3: Agent 4 must complete first)
**Prerequisite:** Agents 1, 2, 3, and 4 must have completed (all entities, services, and orchestration exist)

## <objective>

Create a NestJS scheduled task that automatically triggers invoice generation on the 1st of every month at 8:00 AM for the previous month. Implement error handling, logging, and retry logic. Write unit tests.

</objective>

## <context>

Read these files before starting:
- `AGENTS.md` — architecture rules
- `.context/REQUIREMENTS.md` — scheduling requirements
- `src/invoicing/invoicing.module.ts` — module where you register the cron service
- `src/invoicing/services/invoicing.service.ts` — the orchestration service you will call
- `src/app.module.ts` — verify ScheduleModule.forRoot() is imported (Agent 1 did this)

**@nestjs/schedule is already installed and ScheduleModule.forRoot() is already imported in AppModule by Agent 1.**

</context>

## <tasks>

### Task 1: Create Cron Service + Unit Tests

**<files>**
- CREATE: `src/invoicing/services/invoice-cron.service.ts`
- CREATE: `src/invoicing/services/invoice-cron.service.spec.ts`
- MODIFY: `src/invoicing/invoicing.module.ts` (add InvoiceCronService to providers)

**<action>**

1. Create `src/invoicing/services/invoice-cron.service.ts`:
   - Injectable NestJS service
   - Constructor: inject `InvoicingService`, `Logger`
   - Use `@Cron('0 8 1 * *')` decorator on the main method (fires at 08:00 on the 1st of every month)
   - Method `handleMonthlyInvoiceGeneration()`:
     1. Calculate previous month: if current month is January, use December of previous year
     2. Log: `"Starting monthly invoice generation for {year}-{month}"`
     3. Call `invoicingService.generateMonthlyInvoices(year, month)`
     4. Log summary: how many created, skipped, errored
     5. If ALL results have status='error', log a critical warning
   - Error handling:
     - Wrap entire method in try/catch
     - On error, log the full error with stack trace using NestJS Logger
     - Implement simple retry: if the method fails completely (not per-client errors, which are handled by InvoicingService), wait 30 minutes and retry once
     - Use `setTimeout` with a bound method call for the retry (or use `@nestjs/schedule`'s `SchedulerRegistry` to add a dynamic timeout)
   - Add a public method `triggerManualGeneration(year: number, month: number)` that allows manual invocation (used by the REST API controller)
     - This does the same thing as the cron handler but with explicit year/month
     - Returns the result array

2. Add `InvoiceCronService` to `providers` array in `invoicing.module.ts`.

3. Create `src/invoicing/services/invoice-cron.service.spec.ts`:
   - Mock `InvoicingService`
   - Test cases:
     - `handleMonthlyInvoiceGeneration` calculates previous month correctly (e.g., March 2026 -> February 2026)
     - January edge case: January 2026 -> December 2025
     - Calls `invoicingService.generateMonthlyInvoices` with correct year/month
     - Logs summary after successful execution
     - Catches and logs errors without throwing (cron must not crash the app)
     - `triggerManualGeneration` calls service with provided year/month and returns results

**Testing notes:**
- Use `jest.useFakeTimers()` or mock `Date` to control the current date for previous-month calculation tests
- Mock the Logger to verify logging calls
- Do NOT test the actual cron schedule expression — just test the handler logic

**DO NOT:**
- Let uncaught exceptions propagate from the cron handler (this could crash the NestJS process)
- Use `process.exit()` or any process-level error handling
- Hardcode year/month — always calculate dynamically
- Skip the January->December edge case test

**<verify>**
```bash
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='invoice-cron' --no-cache 2>&1 | tail -20
```

**<done>**
- `invoice-cron.service.ts` exists with `@Cron('0 8 1 * *')` decorated method
- Previous month calculation works correctly including January edge case
- Error handling prevents cron from crashing the app
- Retry logic implemented for complete failures
- All unit tests pass (minimum 5 test cases)
- InvoiceCronService registered in InvoicingModule
- TypeScript compiles without errors
- `pnpm run lint` passes

</tasks>

## <verify>

Run these commands to verify all work is complete:

```bash
# 1. TypeScript compilation
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx tsc --noEmit

# 2. Unit tests for cron service
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --testPathPattern='invoice-cron' --no-cache

# 3. All tests still pass
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && npx jest --no-cache

# 4. Linting
cd /Users/ankach/Programing/MyProjects/toggle-facturoid-sync && pnpm run lint

# 5. Verify cron decorator exists
grep -r "@Cron" src/invoicing/
```

</verify>
