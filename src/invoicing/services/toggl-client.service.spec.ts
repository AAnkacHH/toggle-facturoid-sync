/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { ServiceConfig } from '../entities/service-config.entity';
import { EncryptionService } from './encryption.service';
import { TogglClientService } from './toggl-client.service';
import { TogglSummaryResponse } from '../dto/toggl-summary.dto';

// Partial mock: only mock `post`, keep `isAxiosError` and other exports real
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      post: jest.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
    __esModule: true,
  };
});

const mockedPost = axios.post as jest.MockedFunction<typeof axios.post>;

const FAKE_API_TOKEN = 'test-toggl-api-token-12345';
const FAKE_WORKSPACE_ID = '1234567';

function createServiceConfigs(): Partial<ServiceConfig>[] {
  return [
    {
      id: 'uuid-1',
      serviceName: 'toggl',
      configKey: 'api_token',
      isSecret: true,
      encryptedValue: Buffer.from('encrypted-token'),
      iv: Buffer.from('test-iv-1234'),
      authTag: Buffer.from('test-auth-tag!'),
      plainValue: null,
    },
    {
      id: 'uuid-2',
      serviceName: 'toggl',
      configKey: 'workspace_id',
      isSecret: false,
      encryptedValue: null,
      iv: null,
      authTag: null,
      plainValue: FAKE_WORKSPACE_ID,
    },
  ];
}

function createTogglResponse(): TogglSummaryResponse {
  return {
    groups: [
      {
        id: 100,
        sub_groups: [
          { id: 201, title: 'Project Alpha', seconds: 7200 },
          { id: 202, title: 'Project Beta', seconds: 5400 },
        ],
      },
      {
        id: 200,
        sub_groups: [{ id: 301, title: 'Project Gamma', seconds: 3661 }],
      },
      {
        id: null, // unassigned entries - should be filtered out
        sub_groups: [{ id: 401, title: 'No Client', seconds: 1800 }],
      },
    ],
  };
}

function createAxiosError(
  status: number,
  headers?: Record<string, string>,
): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    undefined,
    {
      status,
      data: {},
      statusText: `${status}`,
      headers: headers ?? {},
      config: { headers: new AxiosHeaders() },
    },
  );
}

describe('TogglClientService', () => {
  let service: TogglClientService;
  let repoMock: jest.Mocked<Repository<ServiceConfig>>;
  let encryptionMock: jest.Mocked<EncryptionService>;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ServiceConfig>>;

    encryptionMock = {
      decrypt: jest.fn(),
    } as unknown as jest.Mocked<EncryptionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TogglClientService,
        {
          provide: getRepositoryToken(ServiceConfig),
          useValue: repoMock,
        },
        {
          provide: EncryptionService,
          useValue: encryptionMock,
        },
      ],
    }).compile();

    service = module.get<TogglClientService>(TogglClientService);

    // Default mock behavior: return valid credentials
    repoMock.find.mockResolvedValue(createServiceConfigs() as ServiceConfig[]);
    encryptionMock.decrypt.mockReturnValue(FAKE_API_TOKEN);

    // Reset axios post mock
    mockedPost.mockReset();

    // Spy on setTimeout / sleep to make tests fast
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((
      fn: () => void,
    ) => {
      fn();
      return 0;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return correctly parsed data with hours calculated from seconds', async () => {
    mockedPost.mockResolvedValueOnce({
      data: createTogglResponse(),
    });

    const result = await service.getMonthSummary(2026, 2);

    expect(result).toHaveLength(2);

    // First client group
    expect(result[0].clientId).toBe(100);
    expect(result[0].projects).toHaveLength(2);
    expect(result[0].projects[0].projectId).toBe(201);
    expect(result[0].projects[0].projectName).toBe('Project Alpha');
    expect(result[0].projects[0].totalSeconds).toBe(7200);
    expect(result[0].projects[0].totalHours).toBe(2);
    expect(result[0].projects[1].projectId).toBe(202);
    expect(result[0].projects[1].projectName).toBe('Project Beta');
    expect(result[0].projects[1].totalSeconds).toBe(5400);
    expect(result[0].projects[1].totalHours).toBe(1.5);

    // Second client group
    expect(result[1].clientId).toBe(200);
    expect(result[1].projects).toHaveLength(1);
    expect(result[1].projects[0].totalSeconds).toBe(3661);
    expect(result[1].projects[0].totalHours).toBe(1.02); // 3661/3600 = 1.0169... rounded to 1.02
  });

  it('should filter out groups with null client IDs', async () => {
    mockedPost.mockResolvedValueOnce({
      data: createTogglResponse(),
    });

    const result = await service.getMonthSummary(2026, 2);

    // The response has 3 groups, but the null-client group should be filtered
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.clientId !== null)).toBe(true);
    expect(result.map((r) => r.clientId)).toEqual([100, 200]);
  });

  it('should throw 401 on Toggl API authentication error', async () => {
    mockedPost.mockRejectedValueOnce(createAxiosError(401));

    try {
      await service.getMonthSummary(2026, 2);
      fail('Expected HttpException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
      expect((error as HttpException).message).toContain(
        'authentication failed',
      );
    }
  });

  it('should retry on 429 rate limit and succeed on subsequent attempt', async () => {
    mockedPost
      .mockRejectedValueOnce(createAxiosError(429))
      .mockResolvedValueOnce({ data: createTogglResponse() });

    const result = await service.getMonthSummary(2026, 2);

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('should throw after exceeding maximum retries on 429', async () => {
    mockedPost
      .mockRejectedValueOnce(createAxiosError(429))
      .mockRejectedValueOnce(createAxiosError(429))
      .mockRejectedValueOnce(createAxiosError(429))
      .mockRejectedValueOnce(createAxiosError(429));

    try {
      await service.getMonthSummary(2026, 2);
      fail('Expected HttpException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('should use Retry-After header when present on 429 response', async () => {
    mockedPost
      .mockRejectedValueOnce(createAxiosError(429, { 'retry-after': '5' }))
      .mockResolvedValueOnce({ data: createTogglResponse() });

    const result = await service.getMonthSummary(2026, 2);

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('should throw appropriate exception when credentials are missing', async () => {
    repoMock.find.mockResolvedValue([]);

    try {
      await service.getMonthSummary(2026, 2);
      fail('Expected HttpException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
      expect((error as HttpException).message).toContain(
        'Toggl credentials not found',
      );
    }
  });

  it('should calculate correct date range for February 2026', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2026, 2);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const callArgs = mockedPost.mock.calls[0];
    const requestBody = callArgs[1] as Record<string, unknown>;

    expect(requestBody.start_date).toBe('2026-02-01');
    expect(requestBody.end_date).toBe('2026-02-28');
  });

  it('should calculate correct date range for a 31-day month', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2026, 1);

    const callArgs = mockedPost.mock.calls[0];
    const requestBody = callArgs[1] as Record<string, unknown>;

    expect(requestBody.start_date).toBe('2026-01-01');
    expect(requestBody.end_date).toBe('2026-01-31');
  });

  it('should calculate correct date range for leap year February', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2024, 2);

    const callArgs = mockedPost.mock.calls[0];
    const requestBody = callArgs[1] as Record<string, unknown>;

    expect(requestBody.start_date).toBe('2024-02-01');
    expect(requestBody.end_date).toBe('2024-02-29');
  });

  it('should construct correct Basic Auth header', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2026, 2);

    const callArgs = mockedPost.mock.calls[0];
    const requestHeaders = callArgs[2] as { headers: Record<string, string> };

    const expectedAuth = `Basic ${Buffer.from(`${FAKE_API_TOKEN}:api_token`).toString('base64')}`;
    expect(requestHeaders.headers.Authorization).toBe(expectedAuth);
    expect(requestHeaders.headers['User-Agent']).toBe(
      'toggl-facturoid-sync/1.0',
    );
  });

  it('should send correct request body with grouping parameters', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2026, 3);

    const callArgs = mockedPost.mock.calls[0];
    const url = callArgs[0];
    const requestBody = callArgs[1] as Record<string, unknown>;

    expect(url).toBe(
      `https://api.track.toggl.com/reports/api/v3/workspace/${FAKE_WORKSPACE_ID}/summary/time_entries`,
    );
    expect(requestBody.grouping).toBe('clients');
    expect(requestBody.sub_grouping).toBe('projects');
    expect(requestBody.include_time_entry_ids).toBe(false);
  });

  it('should throw on 5xx server errors', async () => {
    mockedPost.mockRejectedValueOnce(createAxiosError(503));

    try {
      await service.getMonthSummary(2026, 2);
      fail('Expected HttpException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    }
  });

  it('should decrypt api_token using EncryptionService', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { groups: [] },
    });

    await service.getMonthSummary(2026, 2);

    expect(encryptionMock.decrypt).toHaveBeenCalledWith(
      Buffer.from('encrypted-token'),
      Buffer.from('test-iv-1234'),
      Buffer.from('test-auth-tag!'),
    );
  });

  it('should throw when api_token encrypted fields are missing', async () => {
    repoMock.find.mockResolvedValue([
      {
        id: 'uuid-1',
        serviceName: 'toggl',
        configKey: 'api_token',
        isSecret: true,
        encryptedValue: null,
        iv: null,
        authTag: null,
        plainValue: null,
      },
      {
        id: 'uuid-2',
        serviceName: 'toggl',
        configKey: 'workspace_id',
        isSecret: false,
        encryptedValue: null,
        iv: null,
        authTag: null,
        plainValue: FAKE_WORKSPACE_ID,
      },
    ] as ServiceConfig[]);

    try {
      await service.getMonthSummary(2026, 2);
      fail('Expected HttpException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
      expect((error as HttpException).message).toContain(
        'not properly encrypted',
      );
    }
  });
});
