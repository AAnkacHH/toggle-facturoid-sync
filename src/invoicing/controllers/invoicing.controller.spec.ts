/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from '../services/invoicing.service';
import { TimeReport } from '../entities/time-report.entity';
import { InvoiceLog, InvoiceStatus } from '../entities/invoice-log.entity';
import { ClientMapping } from '../entities/client-mapping.entity';
import {
  InvoiceGenerationResult,
  MonthPreview,
} from '../dto/invoice-result.dto';

function createTimeReport(overrides: Partial<TimeReport> = {}): TimeReport {
  return {
    id: 'tr-uuid-1',
    clientMappingId: 'mapping-uuid-1',
    periodYear: 2026,
    periodMonth: 2,
    togglProjectId: '201',
    projectName: 'Project Alpha',
    totalSeconds: 7200,
    totalHours: '2.00',
    amount: '3000.00',
    fetchedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    clientMapping: null as unknown as ClientMapping,
    ...overrides,
  } as TimeReport;
}

function createInvoiceLog(overrides: Partial<InvoiceLog> = {}): InvoiceLog {
  return {
    id: 'log-uuid-1',
    clientMappingId: 'mapping-uuid-1',
    periodYear: 2026,
    periodMonth: 2,
    fakturoidInvoiceId: '12345',
    fakturoidNumber: '2026-0001',
    totalHours: '3.50',
    totalAmount: '5250.00',
    status: InvoiceStatus.CREATED,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    clientMapping: null as unknown as ClientMapping,
    ...overrides,
  } as InvoiceLog;
}

describe('InvoicingController', () => {
  let controller: InvoicingController;
  let invoicingService: jest.Mocked<InvoicingService>;
  let timeReportRepo: jest.Mocked<Repository<TimeReport>>;
  let invoiceLogRepo: jest.Mocked<Repository<InvoiceLog>>;

  beforeEach(async () => {
    invoicingService = {
      generateMonthlyInvoices: jest.fn(),
      getMonthPreview: jest.fn(),
    } as unknown as jest.Mocked<InvoicingService>;

    timeReportRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<TimeReport>>;

    invoiceLogRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<InvoiceLog>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicingController],
      providers: [
        {
          provide: InvoicingService,
          useValue: invoicingService,
        },
        {
          provide: getRepositoryToken(TimeReport),
          useValue: timeReportRepo,
        },
        {
          provide: getRepositoryToken(InvoiceLog),
          useValue: invoiceLogRepo,
        },
      ],
    }).compile();

    controller = module.get<InvoicingController>(InvoicingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('should call invoicingService.generateMonthlyInvoices and return results', async () => {
      const results: InvoiceGenerationResult[] = [
        {
          clientName: 'Acme Corp',
          clientMappingId: 'mapping-uuid-1',
          status: 'created',
          fakturoidInvoiceId: 12345,
          fakturoidNumber: '2026-0001',
          totalHours: 3.5,
          totalAmount: 5250,
        },
      ];
      invoicingService.generateMonthlyInvoices.mockResolvedValue(results);

      const result = await controller.generate({ year: 2026, month: 2 });

      expect(result).toEqual(results);
      expect(invoicingService.generateMonthlyInvoices).toHaveBeenCalledWith(
        2026,
        2,
      );
    });

    it('should handle empty results when no clients are active', async () => {
      invoicingService.generateMonthlyInvoices.mockResolvedValue([]);

      const result = await controller.generate({ year: 2026, month: 3 });

      expect(result).toEqual([]);
    });
  });

  describe('preview', () => {
    it('should return month preview data', async () => {
      const preview: MonthPreview = {
        year: 2026,
        month: 2,
        clients: [
          {
            clientName: 'Acme Corp',
            togglClientId: 100,
            projects: [
              { projectName: 'Project Alpha', hours: 2, amount: 3000 },
            ],
            totalHours: 2,
            totalAmount: 3000,
            hasExistingInvoice: false,
          },
        ],
      };
      invoicingService.getMonthPreview.mockResolvedValue(preview);

      const result = await controller.preview(2026, 2);

      expect(result).toEqual(preview);
      expect(invoicingService.getMonthPreview).toHaveBeenCalledWith(2026, 2);
    });
  });

  describe('getTimeReports', () => {
    it('should return all time reports without filters', async () => {
      const reports = [createTimeReport()];
      timeReportRepo.find.mockResolvedValue(reports);

      const result = await controller.getTimeReports();

      expect(result).toHaveLength(1);
      expect(timeReportRepo.find).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter time reports by year and month', async () => {
      const reports = [createTimeReport()];
      timeReportRepo.find.mockResolvedValue(reports);

      const result = await controller.getTimeReports('2026', '2');

      expect(result).toHaveLength(1);
      expect(timeReportRepo.find).toHaveBeenCalledWith({
        where: { periodYear: 2026, periodMonth: 2 },
      });
    });

    it('should filter time reports by clientMappingId', async () => {
      const reports = [createTimeReport()];
      timeReportRepo.find.mockResolvedValue(reports);

      const result = await controller.getTimeReports(
        undefined,
        undefined,
        'mapping-uuid-1',
      );

      expect(result).toHaveLength(1);
      expect(timeReportRepo.find).toHaveBeenCalledWith({
        where: { clientMappingId: 'mapping-uuid-1' },
      });
    });
  });

  describe('getInvoiceLogs', () => {
    it('should return all invoice logs without filters', async () => {
      const logs = [createInvoiceLog()];
      invoiceLogRepo.find.mockResolvedValue(logs);

      const result = await controller.getInvoiceLogs();

      expect(result).toHaveLength(1);
      expect(invoiceLogRepo.find).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter invoice logs by year, month, and status', async () => {
      const logs = [createInvoiceLog()];
      invoiceLogRepo.find.mockResolvedValue(logs);

      const result = await controller.getInvoiceLogs('2026', '2', 'created');

      expect(result).toHaveLength(1);
      expect(invoiceLogRepo.find).toHaveBeenCalledWith({
        where: {
          periodYear: 2026,
          periodMonth: 2,
          status: 'created',
        },
      });
    });

    it('should filter invoice logs by clientMappingId', async () => {
      const logs = [createInvoiceLog()];
      invoiceLogRepo.find.mockResolvedValue(logs);

      const result = await controller.getInvoiceLogs(
        undefined,
        undefined,
        undefined,
        'mapping-uuid-1',
      );

      expect(result).toHaveLength(1);
      expect(invoiceLogRepo.find).toHaveBeenCalledWith({
        where: { clientMappingId: 'mapping-uuid-1' },
      });
    });
  });

  describe('getInvoiceLog', () => {
    it('should return a single invoice log', async () => {
      const log = createInvoiceLog();
      invoiceLogRepo.findOne.mockResolvedValue(log);

      const result = await controller.getInvoiceLog('log-uuid-1');

      expect(result).toEqual(log);
      expect(invoiceLogRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'log-uuid-1' },
      });
    });

    it('should throw NotFoundException for missing ID', async () => {
      invoiceLogRepo.findOne.mockResolvedValue(null);

      await expect(controller.getInvoiceLog('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
