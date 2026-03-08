import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClientMapping } from '../entities/client-mapping.entity';
import { TimeReport } from '../entities/time-report.entity';
import { InvoiceLog, InvoiceStatus } from '../entities/invoice-log.entity';
import { ServiceConfig } from '../entities/service-config.entity';
import { TogglClientService } from './toggl-client.service';
import { FakturoidClientService } from './fakturoid-client.service';
import {
  InvoiceGenerationResult,
  MonthPreview,
  ClientPreview,
} from '../dto/invoice-result.dto';
import { FakturoidInvoiceLine } from '../dto/fakturoid-invoice.dto';
import {
  INVOICE_DEFAULTS,
  SERVICE_NAMES,
  FAKTUROID_CONFIG_KEYS,
} from '../constants';

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    @InjectRepository(ClientMapping)
    private readonly clientMappingRepo: Repository<ClientMapping>,
    @InjectRepository(TimeReport)
    private readonly timeReportRepo: Repository<TimeReport>,
    @InjectRepository(InvoiceLog)
    private readonly invoiceLogRepo: Repository<InvoiceLog>,
    @InjectRepository(ServiceConfig)
    private readonly serviceConfigRepo: Repository<ServiceConfig>,
    private readonly togglClient: TogglClientService,
    private readonly fakturoidClient: FakturoidClientService,
  ) {}

  /**
   * Fetches time data from Toggl for a given month and saves/upserts
   * time reports into the database for all active client mappings.
   */
  async fetchAndSaveTimeReports(
    year: number,
    month: number,
  ): Promise<TimeReport[]> {
    const clientMappings = await this.clientMappingRepo.find({
      where: { isActive: true },
    });

    if (clientMappings.length === 0) {
      this.logger.warn('No active client mappings found');
      return [];
    }

    const togglSummaries = await this.togglClient.getMonthSummary(year, month);
    const savedReports: TimeReport[] = [];

    for (const mapping of clientMappings) {
      const clientSummary = togglSummaries.find(
        (s) => s.clientId === Number(mapping.togglClientId),
      );

      if (!clientSummary) {
        this.logger.debug(
          `No Toggl data found for client "${mapping.name}" (togglClientId=${mapping.togglClientId})`,
        );
        continue;
      }

      for (const project of clientSummary.projects) {
        const totalHours =
          Math.round((project.totalSeconds / 3600) * 100) / 100;
        const amount =
          Math.round(totalHours * parseFloat(mapping.hourlyRate) * 100) / 100;

        // Upsert: find existing record by unique constraint fields
        let timeReport = await this.timeReportRepo.findOne({
          where: {
            clientMappingId: mapping.id,
            periodYear: year,
            periodMonth: month,
            togglProjectId: String(project.projectId),
          },
        });

        if (timeReport) {
          // Update existing
          timeReport.projectName = project.projectName;
          timeReport.totalSeconds = project.totalSeconds;
          timeReport.totalHours = String(totalHours);
          timeReport.amount = String(amount);
          timeReport.fetchedAt = new Date();
        } else {
          // Create new
          timeReport = this.timeReportRepo.create({
            clientMappingId: mapping.id,
            periodYear: year,
            periodMonth: month,
            togglProjectId: String(project.projectId),
            projectName: project.projectName,
            totalSeconds: project.totalSeconds,
            totalHours: String(totalHours),
            amount: String(amount),
            fetchedAt: new Date(),
          });
        }

        const saved = await this.timeReportRepo.save(timeReport);
        savedReports.push(saved);
      }
    }

    this.logger.log(
      `Fetched and saved ${savedReports.length} time reports for ${year}-${String(month).padStart(2, '0')}`,
    );

    return savedReports;
  }

  /**
   * Orchestrates the full monthly invoice generation flow:
   * 1. Fetch and save time reports from Toggl
   * 2. For each active client mapping, check duplicates, skip zero hours,
   *    build invoice payload, create in Fakturoid, and log results
   *
   * Error isolation: one client's failure does not block others.
   */
  async generateMonthlyInvoices(
    year: number,
    month: number,
  ): Promise<InvoiceGenerationResult[]> {
    await this.fetchAndSaveTimeReports(year, month);

    const clientMappings = await this.clientMappingRepo.find({
      where: { isActive: true },
    });

    const slug = await this.getFakturoidSlug();
    const results: InvoiceGenerationResult[] = [];

    // Process sequentially to respect Fakturoid rate limits
    for (const mapping of clientMappings) {
      try {
        const result = await this.processClientInvoice(
          mapping,
          year,
          month,
          slug,
        );
        results.push(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Unexpected error processing client "${mapping.name}": ${errorMessage}`,
        );
        results.push({
          clientName: mapping.name,
          clientMappingId: mapping.id,
          status: 'error',
          errorMessage,
        });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status !== 'created').length;
    this.logger.log(
      `Invoice generation complete for ${year}-${String(month).padStart(2, '0')}: ${created} created, ${skipped} skipped/errored`,
    );

    return results;
  }

  /**
   * Returns a preview of what invoices would be generated for a given month,
   * without creating anything.
   */
  async getMonthPreview(year: number, month: number): Promise<MonthPreview> {
    const clientMappings = await this.clientMappingRepo.find({
      where: { isActive: true },
    });

    const clients: ClientPreview[] = [];

    for (const mapping of clientMappings) {
      const timeReports = await this.timeReportRepo.find({
        where: {
          clientMappingId: mapping.id,
          periodYear: year,
          periodMonth: month,
        },
      });

      const existingInvoice = await this.invoiceLogRepo.findOne({
        where: {
          clientMappingId: mapping.id,
          periodYear: year,
          periodMonth: month,
          status: In([
            InvoiceStatus.CREATED,
            InvoiceStatus.SENT,
            InvoiceStatus.PAID,
          ]),
        },
      });

      const projects = timeReports.map((tr) => ({
        projectName: tr.projectName,
        hours: parseFloat(tr.totalHours),
        amount: parseFloat(tr.amount),
      }));

      const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);
      const totalAmount = projects.reduce((sum, p) => sum + p.amount, 0);

      clients.push({
        clientName: mapping.name,
        togglClientId: Number(mapping.togglClientId),
        projects,
        totalHours,
        totalAmount,
        hasExistingInvoice: !!existingInvoice,
      });
    }

    const grandTotal = {
      hours: clients.reduce((sum, c) => sum + c.totalHours, 0),
      amount: clients.reduce((sum, c) => sum + c.totalAmount, 0),
    };

    return { year, month, clients, grandTotal };
  }

  /**
   * Process a single client mapping for invoice generation.
   * Handles duplicate check, zero-hours check, Fakturoid API call,
   * and invoice_log creation/update.
   */
  private async processClientInvoice(
    mapping: ClientMapping,
    year: number,
    month: number,
    slug: string,
  ): Promise<InvoiceGenerationResult> {
    // Check for duplicate invoice
    const existingInvoice = await this.invoiceLogRepo.findOne({
      where: {
        clientMappingId: mapping.id,
        periodYear: year,
        periodMonth: month,
        status: In([
          InvoiceStatus.CREATED,
          InvoiceStatus.SENT,
          InvoiceStatus.PAID,
        ]),
      },
    });

    if (existingInvoice) {
      this.logger.debug(
        `Skipping client "${mapping.name}": duplicate invoice exists (${existingInvoice.id})`,
      );
      return {
        clientName: mapping.name,
        clientMappingId: mapping.id,
        status: 'skipped_duplicate',
      };
    }

    // Get time reports for this client and period
    const timeReports = await this.timeReportRepo.find({
      where: {
        clientMappingId: mapping.id,
        periodYear: year,
        periodMonth: month,
      },
    });

    // Check zero hours
    const totalHours = timeReports.reduce(
      (sum, tr) => sum + parseFloat(tr.totalHours),
      0,
    );

    if (timeReports.length === 0 || totalHours === 0) {
      this.logger.debug(
        `Skipping client "${mapping.name}": zero hours tracked`,
      );
      return {
        clientName: mapping.name,
        clientMappingId: mapping.id,
        status: 'skipped_zero_hours',
        totalHours: 0,
      };
    }

    // Build invoice lines
    const lines: FakturoidInvoiceLine[] = timeReports.map((tr) => ({
      name: tr.projectName,
      quantity: parseFloat(tr.totalHours),
      unit_name: INVOICE_DEFAULTS.UNIT_NAME,
      unit_price: parseFloat(mapping.hourlyRate),
    }));

    const totalAmount = timeReports.reduce(
      (sum, tr) => sum + parseFloat(tr.amount),
      0,
    );

    // Create pending invoice_log BEFORE calling Fakturoid
    const invoiceLog = this.invoiceLogRepo.create({
      clientMappingId: mapping.id,
      periodYear: year,
      periodMonth: month,
      totalHours: String(totalHours),
      totalAmount: String(totalAmount),
      status: InvoiceStatus.PENDING,
    });

    const savedLog = await this.invoiceLogRepo.save(invoiceLog);

    // Call Fakturoid API
    try {
      const response = await this.fakturoidClient.createInvoice(slug, {
        subject_id: Number(mapping.fakturoidSubjectId),
        payment_method: INVOICE_DEFAULTS.PAYMENT_METHOD,
        currency: mapping.currency,
        lines,
      });

      // Update invoice_log with Fakturoid response
      savedLog.fakturoidInvoiceId = String(response.id);
      savedLog.fakturoidNumber = response.number;
      savedLog.status = InvoiceStatus.CREATED;
      await this.invoiceLogRepo.save(savedLog);

      this.logger.log(
        `Invoice created for client "${mapping.name}": Fakturoid #${response.number} (id=${response.id})`,
      );

      return {
        clientName: mapping.name,
        clientMappingId: mapping.id,
        status: 'created',
        fakturoidInvoiceId: response.id,
        fakturoidNumber: response.number,
        totalHours,
        totalAmount,
      };
    } catch (error: unknown) {
      // Update invoice_log with error status
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      savedLog.status = InvoiceStatus.ERROR;
      savedLog.errorMessage = errorMessage;
      await this.invoiceLogRepo.save(savedLog);

      this.logger.error(
        `Failed to create invoice for client "${mapping.name}": ${errorMessage}`,
      );

      return {
        clientName: mapping.name,
        clientMappingId: mapping.id,
        status: 'error',
        totalHours,
        totalAmount,
        errorMessage,
      };
    }
  }

  /**
   * Retrieves the Fakturoid account slug from service_config.
   */
  async getFakturoidSlug(): Promise<string> {
    const config = await this.serviceConfigRepo.findOne({
      where: {
        serviceName: SERVICE_NAMES.FAKTUROID,
        configKey: FAKTUROID_CONFIG_KEYS.SLUG,
      },
    });

    if (!config?.plainValue) {
      throw new InternalServerErrorException(
        'Fakturoid slug not found in service_config. Please configure slug for the fakturoid service.',
      );
    }

    return config.plainValue;
  }
}
