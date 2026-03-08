/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InvoiceCronService } from './invoice-cron.service';
import { InvoicingService } from './invoicing.service';
import { InvoiceGenerationResult } from '../dto/invoice-result.dto';

describe('InvoiceCronService', () => {
  let service: InvoiceCronService;
  let invoicingService: jest.Mocked<InvoicingService>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;

  beforeEach(async () => {
    const mockInvoicingService = {
      generateMonthlyInvoices: jest.fn(),
    };

    const mockSchedulerRegistry = {
      addTimeout: jest.fn(),
      deleteTimeout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceCronService,
        { provide: InvoicingService, useValue: mockInvoicingService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get<InvoiceCronService>(InvoiceCronService);
    invoicingService = module.get(InvoicingService);
    schedulerRegistry = module.get(SchedulerRegistry);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPreviousMonth', () => {
    it('should return February 2026 when current date is March 2026', () => {
      const march2026 = new Date(2026, 2, 1); // Month is 0-based: 2 = March
      const result = service.getPreviousMonth(march2026);
      expect(result).toEqual({ year: 2026, month: 2 });
    });

    it('should return December 2025 when current date is January 2026', () => {
      const january2026 = new Date(2026, 0, 1); // Month 0 = January
      const result = service.getPreviousMonth(january2026);
      expect(result).toEqual({ year: 2025, month: 12 });
    });

    it('should return January when current date is February', () => {
      const february = new Date(2026, 1, 15); // Month 1 = February
      const result = service.getPreviousMonth(february);
      expect(result).toEqual({ year: 2026, month: 1 });
    });

    it('should return November when current date is December', () => {
      const december = new Date(2026, 11, 1); // Month 11 = December
      const result = service.getPreviousMonth(december);
      expect(result).toEqual({ year: 2026, month: 11 });
    });
  });

  describe('handleMonthlyInvoiceGeneration', () => {
    it('should call generateMonthlyInvoices with the previous month', async () => {
      // Mock Date to March 1, 2026
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 1, 8, 0, 0));

      const mockResults: InvoiceGenerationResult[] = [
        {
          clientName: 'Client A',
          clientMappingId: 'uuid-1',
          status: 'created',
          totalHours: 10,
          totalAmount: 500,
        },
      ];

      invoicingService.generateMonthlyInvoices.mockResolvedValue(mockResults);

      await service.handleMonthlyInvoiceGeneration();

      expect(invoicingService.generateMonthlyInvoices).toHaveBeenCalledWith(
        2026,
        2,
      );

      jest.useRealTimers();
    });

    it('should handle January edge case correctly', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 0, 1, 8, 0, 0)); // January 1, 2026

      invoicingService.generateMonthlyInvoices.mockResolvedValue([]);

      await service.handleMonthlyInvoiceGeneration();

      expect(invoicingService.generateMonthlyInvoices).toHaveBeenCalledWith(
        2025,
        12,
      );

      jest.useRealTimers();
    });

    it('should catch errors without throwing and schedule a retry', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 1, 8, 0, 0));

      invoicingService.generateMonthlyInvoices.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // The cron handler must NOT throw -- it should catch internally
      await expect(
        service.handleMonthlyInvoiceGeneration(),
      ).resolves.toBeUndefined();

      // Verify retry was scheduled
      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(
        'invoice-retry',
        expect.anything(),
      );

      jest.useRealTimers();
    });

    it('should log a critical warning when all results have error status', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 1, 8, 0, 0));

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      const mockResults: InvoiceGenerationResult[] = [
        {
          clientName: 'Client A',
          clientMappingId: 'uuid-1',
          status: 'error',
          errorMessage: 'API down',
        },
        {
          clientName: 'Client B',
          clientMappingId: 'uuid-2',
          status: 'error',
          errorMessage: 'API down',
        },
      ];

      invoicingService.generateMonthlyInvoices.mockResolvedValue(mockResults);

      await service.handleMonthlyInvoiceGeneration();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
      );

      jest.useRealTimers();
    });

    it('should log summary with correct counts', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 1, 8, 0, 0));

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      const mockResults: InvoiceGenerationResult[] = [
        {
          clientName: 'Client A',
          clientMappingId: 'uuid-1',
          status: 'created',
          totalHours: 10,
          totalAmount: 500,
        },
        {
          clientName: 'Client B',
          clientMappingId: 'uuid-2',
          status: 'skipped_duplicate',
        },
        {
          clientName: 'Client C',
          clientMappingId: 'uuid-3',
          status: 'error',
          errorMessage: 'Failed',
        },
      ];

      invoicingService.generateMonthlyInvoices.mockResolvedValue(mockResults);

      await service.handleMonthlyInvoiceGeneration();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 created, 1 skipped, 1 errored'),
      );

      jest.useRealTimers();
    });
  });

  describe('triggerManualGeneration', () => {
    it('should call generateMonthlyInvoices with provided year/month and return results', async () => {
      const mockResults: InvoiceGenerationResult[] = [
        {
          clientName: 'Client A',
          clientMappingId: 'uuid-1',
          status: 'created',
          totalHours: 20,
          totalAmount: 1000,
        },
      ];

      invoicingService.generateMonthlyInvoices.mockResolvedValue(mockResults);

      const results = await service.triggerManualGeneration(2026, 1);

      expect(invoicingService.generateMonthlyInvoices).toHaveBeenCalledWith(
        2026,
        1,
      );
      expect(results).toEqual(mockResults);
    });

    it('should propagate errors from invoicingService (unlike the cron handler)', async () => {
      invoicingService.generateMonthlyInvoices.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(service.triggerManualGeneration(2026, 1)).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('retry logic', () => {
    it('should remove existing retry timeout before scheduling a new one', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 1, 8, 0, 0));

      // First call: deleteTimeout throws (no existing timeout)
      schedulerRegistry.deleteTimeout.mockImplementationOnce(() => {
        throw new Error('No timeout');
      });

      invoicingService.generateMonthlyInvoices.mockRejectedValue(
        new Error('Connection error'),
      );

      await service.handleMonthlyInvoiceGeneration();

      // deleteTimeout was called (and threw, which was caught)
      expect(schedulerRegistry.deleteTimeout).toHaveBeenCalledWith(
        'invoice-retry',
      );
      // addTimeout was still called
      expect(schedulerRegistry.addTimeout).toHaveBeenCalledWith(
        'invoice-retry',
        expect.anything(),
      );

      jest.useRealTimers();
    });
  });
});
