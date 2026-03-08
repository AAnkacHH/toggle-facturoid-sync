/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientMapping } from '../entities/client-mapping.entity';
import { TimeReport } from '../entities/time-report.entity';
import { InvoiceLog, InvoiceStatus } from '../entities/invoice-log.entity';
import { ServiceConfig } from '../entities/service-config.entity';
import { TogglClientService } from './toggl-client.service';
import { FakturoidClientService } from './fakturoid-client.service';
import { InvoicingService } from './invoicing.service';
import { TogglMonthSummary } from '../dto/toggl-summary.dto';
import { FakturoidInvoiceResponse } from '../dto/fakturoid-invoice.dto';

// --- Helper factories ---

function createClientMapping(
  overrides: Partial<ClientMapping> = {},
): ClientMapping {
  return {
    id: 'mapping-uuid-1',
    name: 'Acme Corp',
    togglClientId: '100',
    togglWorkspaceId: '999',
    fakturoidSubjectId: '500',
    hourlyRate: '1500.00',
    currency: 'CZK',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeReports: [],
    invoiceLogs: [],
    ...overrides,
  } as ClientMapping;
}

function createSecondClientMapping(): ClientMapping {
  return createClientMapping({
    id: 'mapping-uuid-2',
    name: 'Beta Inc',
    togglClientId: '200',
    fakturoidSubjectId: '501',
    hourlyRate: '2000.00',
  });
}

function createTogglSummaries(): TogglMonthSummary[] {
  return [
    {
      clientId: 100,
      projects: [
        {
          projectId: 201,
          projectName: 'Project Alpha',
          totalSeconds: 7200,
          totalHours: 2,
        },
        {
          projectId: 202,
          projectName: 'Project Beta',
          totalSeconds: 5400,
          totalHours: 1.5,
        },
      ],
    },
    {
      clientId: 200,
      projects: [
        {
          projectId: 301,
          projectName: 'Project Gamma',
          totalSeconds: 3600,
          totalHours: 1,
        },
      ],
    },
  ];
}

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
    fakturoidInvoiceId: null,
    fakturoidNumber: null,
    totalHours: '3.50',
    totalAmount: '5250.00',
    status: InvoiceStatus.PENDING,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    clientMapping: null as unknown as ClientMapping,
    ...overrides,
  } as InvoiceLog;
}

function createFakturoidResponse(
  overrides: Partial<FakturoidInvoiceResponse> = {},
): FakturoidInvoiceResponse {
  return {
    id: 12345,
    number: '2026-0001',
    total: '5250.00',
    status: 'open',
    subject_id: 500,
    html_url: 'https://app.fakturoid.cz/invoices/12345',
    ...overrides,
  };
}

function createSlugConfig(): ServiceConfig {
  return {
    id: 'config-uuid-slug',
    serviceName: 'fakturoid',
    configKey: 'slug',
    plainValue: 'test-account',
    encryptedValue: null,
    iv: null,
    authTag: null,
    isSecret: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ServiceConfig;
}

// --- Test suite ---

describe('InvoicingService', () => {
  let service: InvoicingService;
  let clientMappingRepo: jest.Mocked<Repository<ClientMapping>>;
  let timeReportRepo: jest.Mocked<Repository<TimeReport>>;
  let invoiceLogRepo: jest.Mocked<Repository<InvoiceLog>>;
  let serviceConfigRepo: jest.Mocked<Repository<ServiceConfig>>;
  let togglClient: jest.Mocked<TogglClientService>;
  let fakturoidClient: jest.Mocked<FakturoidClientService>;

  beforeEach(async () => {
    clientMappingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<ClientMapping>>;

    timeReportRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<TimeReport>>;

    invoiceLogRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<InvoiceLog>>;

    serviceConfigRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<ServiceConfig>>;

    togglClient = {
      getMonthSummary: jest.fn(),
    } as unknown as jest.Mocked<TogglClientService>;

    fakturoidClient = {
      createInvoice: jest.fn(),
      authenticate: jest.fn(),
    } as unknown as jest.Mocked<FakturoidClientService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicingService,
        {
          provide: getRepositoryToken(ClientMapping),
          useValue: clientMappingRepo,
        },
        {
          provide: getRepositoryToken(TimeReport),
          useValue: timeReportRepo,
        },
        {
          provide: getRepositoryToken(InvoiceLog),
          useValue: invoiceLogRepo,
        },
        {
          provide: getRepositoryToken(ServiceConfig),
          useValue: serviceConfigRepo,
        },
        {
          provide: TogglClientService,
          useValue: togglClient,
        },
        {
          provide: FakturoidClientService,
          useValue: fakturoidClient,
        },
      ],
    }).compile();

    service = module.get<InvoicingService>(InvoicingService);

    // Default: return slug config
    serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());
  });

  // --- fetchAndSaveTimeReports ---

  describe('fetchAndSaveTimeReports', () => {
    it('should fetch from Toggl and save time reports to DB', async () => {
      const mapping = createClientMapping();
      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue(createTogglSummaries());
      timeReportRepo.findOne.mockResolvedValue(null);
      timeReportRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'new-tr-uuid' }) as TimeReport,
      );
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      const result = await service.fetchAndSaveTimeReports(2026, 2);

      expect(togglClient.getMonthSummary).toHaveBeenCalledWith(2026, 2);
      expect(result).toHaveLength(2); // 2 projects for clientId=100
      expect(timeReportRepo.create).toHaveBeenCalledTimes(2);
      expect(timeReportRepo.save).toHaveBeenCalledTimes(2);

      // Verify first project data
      const firstCreateCall = timeReportRepo.create.mock
        .calls[0][0] as Partial<TimeReport>;
      expect(firstCreateCall.clientMappingId).toBe('mapping-uuid-1');
      expect(firstCreateCall.togglProjectId).toBe('201');
      expect(firstCreateCall.projectName).toBe('Project Alpha');
      expect(firstCreateCall.totalSeconds).toBe(7200);
      expect(firstCreateCall.totalHours).toBe('2');
      expect(firstCreateCall.amount).toBe('3000');
    });

    it('should upsert existing time reports (update, not duplicate)', async () => {
      const mapping = createClientMapping();
      const existingReport = createTimeReport({
        id: 'existing-tr-uuid',
        totalHours: '1.50',
        amount: '2250.00',
      });

      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue([
        {
          clientId: 100,
          projects: [
            {
              projectId: 201,
              projectName: 'Project Alpha Updated',
              totalSeconds: 7200,
              totalHours: 2,
            },
          ],
        },
      ]);
      timeReportRepo.findOne.mockResolvedValue(existingReport);
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      const result = await service.fetchAndSaveTimeReports(2026, 2);

      expect(result).toHaveLength(1);
      expect(timeReportRepo.create).not.toHaveBeenCalled();
      expect(timeReportRepo.save).toHaveBeenCalledTimes(1);

      // Verify the existing report was updated
      const savedEntity = timeReportRepo.save.mock.calls[0][0] as TimeReport;
      expect(savedEntity.id).toBe('existing-tr-uuid');
      expect(savedEntity.projectName).toBe('Project Alpha Updated');
      expect(savedEntity.totalSeconds).toBe(7200);
    });

    it('should handle empty Toggl response gracefully', async () => {
      const mapping = createClientMapping();
      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue([]);

      const result = await service.fetchAndSaveTimeReports(2026, 2);

      expect(result).toHaveLength(0);
      expect(timeReportRepo.save).not.toHaveBeenCalled();
    });

    it('should return empty array when no active client mappings exist', async () => {
      clientMappingRepo.find.mockResolvedValue([]);

      const result = await service.fetchAndSaveTimeReports(2026, 2);

      expect(result).toHaveLength(0);
      expect(togglClient.getMonthSummary).not.toHaveBeenCalled();
    });
  });

  // --- generateMonthlyInvoices ---

  describe('generateMonthlyInvoices', () => {
    it('should create invoice in Fakturoid and save invoice_log with status created (happy path)', async () => {
      const mapping = createClientMapping();
      const timeReports = [
        createTimeReport({ totalHours: '2.00', amount: '3000.00' }),
        createTimeReport({
          id: 'tr-uuid-2',
          togglProjectId: '202',
          projectName: 'Project Beta',
          totalHours: '1.50',
          amount: '2250.00',
        }),
      ];

      // fetchAndSaveTimeReports mocks
      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue(createTogglSummaries());
      timeReportRepo.findOne.mockResolvedValue(null);
      timeReportRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'new-uuid' }) as TimeReport,
      );
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      // generateMonthlyInvoices mocks
      invoiceLogRepo.findOne.mockResolvedValue(null); // no duplicate
      timeReportRepo.find.mockResolvedValue(timeReports);
      invoiceLogRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'log-uuid-new' }) as InvoiceLog,
      );
      invoiceLogRepo.save.mockImplementation(
        async (entity) => entity as InvoiceLog,
      );
      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());
      fakturoidClient.createInvoice.mockResolvedValue(
        createFakturoidResponse(),
      );

      const results = await service.generateMonthlyInvoices(2026, 2);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('created');
      expect(results[0].clientName).toBe('Acme Corp');
      expect(results[0].fakturoidInvoiceId).toBe(12345);
      expect(results[0].fakturoidNumber).toBe('2026-0001');
      expect(results[0].totalHours).toBe(3.5);
      expect(results[0].totalAmount).toBe(5250);

      // Verify Fakturoid was called with correct payload
      expect(fakturoidClient.createInvoice).toHaveBeenCalledWith(
        'test-account',
        expect.objectContaining({
          subject_id: 500,
          currency: 'CZK',
          payment_method: 'bank',
          lines: expect.arrayContaining([
            expect.objectContaining({
              name: 'Project Alpha',
              quantity: 2,
              unit_name: 'hod',
              unit_price: 1500,
            }),
          ]),
        }),
      );
    });

    it('should skip clients with 0 hours (status=skipped_zero_hours)', async () => {
      const mapping = createClientMapping();

      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue([]);
      invoiceLogRepo.findOne.mockResolvedValue(null);
      timeReportRepo.find.mockResolvedValue([]); // no time reports
      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());

      const results = await service.generateMonthlyInvoices(2026, 2);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped_zero_hours');
      expect(results[0].clientName).toBe('Acme Corp');
      expect(fakturoidClient.createInvoice).not.toHaveBeenCalled();
    });

    it('should skip duplicate invoices (existing invoice_log with status created)', async () => {
      const mapping = createClientMapping();
      const existingLog = createInvoiceLog({
        status: InvoiceStatus.CREATED,
        fakturoidInvoiceId: '99999',
      });

      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue([]);
      invoiceLogRepo.findOne.mockResolvedValue(existingLog);
      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());

      const results = await service.generateMonthlyInvoices(2026, 2);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped_duplicate');
      expect(fakturoidClient.createInvoice).not.toHaveBeenCalled();
    });

    it('should isolate errors: one client fails, others still process', async () => {
      const mapping1 = createClientMapping();
      const mapping2 = createSecondClientMapping();

      // First call: fetchAndSaveTimeReports
      clientMappingRepo.find
        .mockResolvedValueOnce([mapping1, mapping2]) // for fetchAndSaveTimeReports
        .mockResolvedValueOnce([mapping1, mapping2]); // for generateMonthlyInvoices loop

      togglClient.getMonthSummary.mockResolvedValue(createTogglSummaries());
      timeReportRepo.findOne.mockResolvedValue(null);
      timeReportRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'new-uuid' }) as TimeReport,
      );

      // Time report save always works
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      // No duplicate for either client
      invoiceLogRepo.findOne.mockResolvedValue(null);

      // Time reports for each client
      timeReportRepo.find
        .mockResolvedValueOnce([
          createTimeReport({ totalHours: '2.00', amount: '3000.00' }),
        ])
        .mockResolvedValueOnce([
          createTimeReport({
            clientMappingId: 'mapping-uuid-2',
            totalHours: '1.00',
            amount: '2000.00',
          }),
        ]);

      // Invoice log creation
      invoiceLogRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'log-new' }) as InvoiceLog,
      );
      invoiceLogRepo.save.mockImplementation(
        async (entity) => entity as InvoiceLog,
      );

      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());

      // First client: Fakturoid fails
      fakturoidClient.createInvoice
        .mockRejectedValueOnce(new Error('Fakturoid API timeout'))
        .mockResolvedValueOnce(
          createFakturoidResponse({ id: 99999, number: '2026-0002' }),
        );

      const results = await service.generateMonthlyInvoices(2026, 2);

      expect(results).toHaveLength(2);

      // First client errored
      expect(results[0].status).toBe('error');
      expect(results[0].clientName).toBe('Acme Corp');
      expect(results[0].errorMessage).toContain('Fakturoid API timeout');

      // Second client succeeded
      expect(results[1].status).toBe('created');
      expect(results[1].clientName).toBe('Beta Inc');
      expect(results[1].fakturoidInvoiceId).toBe(99999);
    });

    it('should create pending invoice_log BEFORE calling Fakturoid API', async () => {
      const mapping = createClientMapping();
      const timeReports = [
        createTimeReport({ totalHours: '2.00', amount: '3000.00' }),
      ];

      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue(createTogglSummaries());
      timeReportRepo.findOne.mockResolvedValue(null);
      timeReportRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'new-uuid' }) as TimeReport,
      );
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      invoiceLogRepo.findOne.mockResolvedValue(null);
      timeReportRepo.find.mockResolvedValue(timeReports);

      const saveCalls: InvoiceLog[] = [];
      invoiceLogRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'log-uuid-pending' }) as InvoiceLog,
      );
      invoiceLogRepo.save.mockImplementation(async (entity) => {
        saveCalls.push({ ...(entity as InvoiceLog) });
        return entity as InvoiceLog;
      });

      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());
      fakturoidClient.createInvoice.mockResolvedValue(
        createFakturoidResponse(),
      );

      await service.generateMonthlyInvoices(2026, 2);

      // First save should be with PENDING status (before Fakturoid call)
      expect(saveCalls.length).toBeGreaterThanOrEqual(2);
      expect(saveCalls[0].status).toBe(InvoiceStatus.PENDING);
      // Second save should be with CREATED status (after Fakturoid call)
      expect(saveCalls[1].status).toBe(InvoiceStatus.CREATED);
    });

    it('should update invoice_log to error status when Fakturoid API fails', async () => {
      const mapping = createClientMapping();
      const timeReports = [
        createTimeReport({ totalHours: '2.00', amount: '3000.00' }),
      ];

      clientMappingRepo.find.mockResolvedValue([mapping]);
      togglClient.getMonthSummary.mockResolvedValue(createTogglSummaries());
      timeReportRepo.findOne.mockResolvedValue(null);
      timeReportRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'new-uuid' }) as TimeReport,
      );
      timeReportRepo.save.mockImplementation(
        async (entity) => entity as TimeReport,
      );

      invoiceLogRepo.findOne.mockResolvedValue(null);
      timeReportRepo.find.mockResolvedValue(timeReports);

      const saveCalls: InvoiceLog[] = [];
      invoiceLogRepo.create.mockImplementation(
        (data) => ({ ...data, id: 'log-uuid-err' }) as InvoiceLog,
      );
      invoiceLogRepo.save.mockImplementation(async (entity) => {
        saveCalls.push({ ...(entity as InvoiceLog) });
        return entity as InvoiceLog;
      });

      serviceConfigRepo.findOne.mockResolvedValue(createSlugConfig());
      fakturoidClient.createInvoice.mockRejectedValue(
        new Error('Fakturoid 500 Internal Server Error'),
      );

      const results = await service.generateMonthlyInvoices(2026, 2);

      expect(results[0].status).toBe('error');
      expect(results[0].errorMessage).toContain('500 Internal Server Error');

      // Verify invoice_log was updated to error
      const lastSave = saveCalls[saveCalls.length - 1];
      expect(lastSave.status).toBe(InvoiceStatus.ERROR);
      expect(lastSave.errorMessage).toContain('500 Internal Server Error');
    });
  });

  // --- getMonthPreview ---

  describe('getMonthPreview', () => {
    it('should return preview with time report data and existing invoice status', async () => {
      const mapping = createClientMapping();
      const timeReports = [
        createTimeReport({
          projectName: 'Project Alpha',
          totalHours: '2.00',
          amount: '3000.00',
        }),
        createTimeReport({
          id: 'tr-uuid-2',
          togglProjectId: '202',
          projectName: 'Project Beta',
          totalHours: '1.50',
          amount: '2250.00',
        }),
      ];

      clientMappingRepo.find.mockResolvedValue([mapping]);
      timeReportRepo.find.mockResolvedValue(timeReports);
      invoiceLogRepo.findOne.mockResolvedValue(null); // no existing invoice

      const preview = await service.getMonthPreview(2026, 2);

      expect(preview.year).toBe(2026);
      expect(preview.month).toBe(2);
      expect(preview.clients).toHaveLength(1);

      const client = preview.clients[0];
      expect(client.clientName).toBe('Acme Corp');
      expect(client.togglClientId).toBe(100);
      expect(client.projects).toHaveLength(2);
      expect(client.totalHours).toBe(3.5);
      expect(client.totalAmount).toBe(5250);
      expect(client.hasExistingInvoice).toBe(false);

      expect(preview.grandTotal).toEqual({ hours: 3.5, amount: 5250 });
    });

    it('should flag clients that already have an existing invoice', async () => {
      const mapping = createClientMapping();
      const existingLog = createInvoiceLog({
        status: InvoiceStatus.CREATED,
      });

      clientMappingRepo.find.mockResolvedValue([mapping]);
      timeReportRepo.find.mockResolvedValue([
        createTimeReport({ totalHours: '2.00', amount: '3000.00' }),
      ]);
      invoiceLogRepo.findOne.mockResolvedValue(existingLog);

      const preview = await service.getMonthPreview(2026, 2);

      expect(preview.clients[0].hasExistingInvoice).toBe(true);
    });

    it('should return empty clients array when no active mappings exist', async () => {
      clientMappingRepo.find.mockResolvedValue([]);

      const preview = await service.getMonthPreview(2026, 2);

      expect(preview.year).toBe(2026);
      expect(preview.month).toBe(2);
      expect(preview.clients).toHaveLength(0);
      expect(preview.grandTotal).toEqual({ hours: 0, amount: 0 });
    });
  });
});
