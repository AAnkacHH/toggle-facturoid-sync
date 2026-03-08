import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InvoicingService } from './invoicing.service';
import { InvoiceGenerationResult } from '../dto/invoice-result.dto';

/**
 * Scheduled service that triggers monthly invoice generation
 * on the 1st of every month at 08:00.
 *
 * Uses InvoicingService.generateMonthlyInvoices() for the previous month.
 * Implements retry logic: on complete failure, retries once after 30 minutes.
 */
@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  private static readonly RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly RETRY_TIMEOUT_NAME = 'invoice-retry';

  constructor(
    private readonly invoicingService: InvoicingService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Cron handler: runs at 08:00 on the 1st of every month.
   * Calculates the previous month and triggers invoice generation.
   */
  @Cron('0 8 1 * *')
  async handleMonthlyInvoiceGeneration(): Promise<void> {
    const { year, month } = this.getPreviousMonth(new Date());

    this.logger.log(
      `Starting monthly invoice generation for ${year}-${String(month).padStart(2, '0')}`,
    );

    try {
      const results = await this.invoicingService.generateMonthlyInvoices(
        year,
        month,
      );

      this.logSummary(results, year, month);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Monthly invoice generation failed completely: ${errorMessage}`,
        stack,
      );

      this.scheduleRetry(year, month);
    }
  }

  /**
   * Manual trigger for invoice generation with explicit year/month.
   * Can be called from REST API controllers.
   */
  async triggerManualGeneration(
    year: number,
    month: number,
  ): Promise<InvoiceGenerationResult[]> {
    this.logger.log(
      `Manual invoice generation triggered for ${year}-${String(month).padStart(2, '0')}`,
    );

    const results = await this.invoicingService.generateMonthlyInvoices(
      year,
      month,
    );

    this.logSummary(results, year, month);

    return results;
  }

  /**
   * Calculates the previous month from a given date.
   * Handles January -> December of the previous year.
   */
  getPreviousMonth(now: Date): { year: number; month: number } {
    const currentMonth = now.getMonth() + 1; // getMonth() is 0-based
    const currentYear = now.getFullYear();

    if (currentMonth === 1) {
      return { year: currentYear - 1, month: 12 };
    }

    return { year: currentYear, month: currentMonth - 1 };
  }

  /**
   * Logs a summary of the invoice generation results.
   * Emits a critical warning if ALL results have error status.
   */
  private logSummary(
    results: InvoiceGenerationResult[],
    year: number,
    month: number,
  ): void {
    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter(
      (r) =>
        r.status === 'skipped_duplicate' || r.status === 'skipped_zero_hours',
    ).length;
    const errored = results.filter((r) => r.status === 'error').length;

    this.logger.log(
      `Invoice generation summary for ${year}-${String(month).padStart(2, '0')}: ` +
        `${created} created, ${skipped} skipped, ${errored} errored (total: ${results.length})`,
    );

    if (results.length > 0 && results.every((r) => r.status === 'error')) {
      this.logger.warn(
        `CRITICAL: All invoice generation results for ${year}-${String(month).padStart(2, '0')} have error status. ` +
          `Manual intervention may be required.`,
      );
    }
  }

  /**
   * Schedules a one-time retry after 30 minutes using SchedulerRegistry.
   * If a retry is already scheduled, it will be replaced.
   */
  private scheduleRetry(year: number, month: number): void {
    this.logger.warn(
      `Scheduling retry for invoice generation in ${InvoiceCronService.RETRY_DELAY_MS / 60000} minutes`,
    );

    // Remove existing retry timeout if present
    try {
      this.schedulerRegistry.deleteTimeout(
        InvoiceCronService.RETRY_TIMEOUT_NAME,
      );
    } catch {
      // Timeout doesn't exist yet, which is fine
    }

    const timeout = setTimeout(() => {
      void this.executeRetry(year, month);
    }, InvoiceCronService.RETRY_DELAY_MS);

    this.schedulerRegistry.addTimeout(
      InvoiceCronService.RETRY_TIMEOUT_NAME,
      timeout,
    );
  }

  /**
   * Executes the retry attempt for invoice generation.
   * Separated from scheduleRetry to avoid async callback in setTimeout.
   */
  private async executeRetry(year: number, month: number): Promise<void> {
    this.logger.log(
      `Retrying monthly invoice generation for ${year}-${String(month).padStart(2, '0')}`,
    );

    try {
      const results = await this.invoicingService.generateMonthlyInvoices(
        year,
        month,
      );

      this.logSummary(results, year, month);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Retry of monthly invoice generation also failed: ${errorMessage}`,
        stack,
      );
    } finally {
      // Clean up the timeout from the registry
      try {
        this.schedulerRegistry.deleteTimeout(
          InvoiceCronService.RETRY_TIMEOUT_NAME,
        );
      } catch {
        // Already cleaned up
      }
    }
  }
}
