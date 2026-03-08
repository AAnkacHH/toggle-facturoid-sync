/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { FakturoidClientService } from './fakturoid-client.service';
import { EncryptionService } from './encryption.service';
import { ServiceConfig } from '../entities/service-config.entity';
import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

interface AxiosLikeError extends Error {
  isAxiosError: boolean;
  response: {
    status: number;
    data: unknown;
    statusText: string;
    headers: Record<string, string>;
  };
}

/**
 * Helper to create an error object that mimics AxiosError shape.
 * We do NOT use new AxiosError() because jest.mock('axios') replaces
 * the AxiosError class with a mock, losing real constructor behavior.
 */
function createAxiosLikeError(
  status: number,
  data: unknown = {},
  headers: Record<string, string> = {},
): AxiosLikeError {
  const error = new Error(
    `Request failed with status code ${status}`,
  ) as AxiosLikeError;
  error.isAxiosError = true;
  error.response = { status, data, statusText: `${status}`, headers };
  return error;
}

// Helpers to build ServiceConfig rows
function buildSecretConfig(
  key: string,
  encryptedValue = Buffer.from('enc'),
  iv = Buffer.from('iv'),
  authTag = Buffer.from('tag'),
): Partial<ServiceConfig> {
  return {
    serviceName: 'fakturoid',
    configKey: key,
    isSecret: true,
    encryptedValue,
    iv,
    authTag,
    plainValue: null,
  };
}

function buildPlainConfig(
  key: string,
  plainValue: string,
): Partial<ServiceConfig> {
  return {
    serviceName: 'fakturoid',
    configKey: key,
    isSecret: false,
    encryptedValue: null,
    iv: null,
    authTag: null,
    plainValue,
  };
}

const FAKE_CONFIGS: Partial<ServiceConfig>[] = [
  buildSecretConfig('client_id'),
  buildSecretConfig('client_secret'),
  buildPlainConfig('slug', 'test-slug'),
  buildPlainConfig('user_agent_email', 'test@example.com'),
];

function mockTokenResponse(token = 'test-token') {
  return {
    data: {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 7200,
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  };
}

/**
 * Helper to access private tokenExpiresAt for testing token refresh.
 * Using Object.defineProperty to set the value without type assertions.
 */
function setTokenExpiresAt(svc: FakturoidClientService, date: Date): void {
  Object.defineProperty(svc, 'tokenExpiresAt', {
    value: date,
    writable: true,
    configurable: true,
  });
}

describe('FakturoidClientService', () => {
  let service: FakturoidClientService;
  let repoMock: jest.Mocked<Pick<Repository<ServiceConfig>, 'find'>>;
  let encryptionMock: jest.Mocked<Pick<EncryptionService, 'decrypt'>>;

  beforeEach(async () => {
    // Reset all axios mocks before each test
    mockedAxios.post.mockReset();
    mockedAxios.request.mockReset();

    repoMock = {
      find: jest.fn().mockResolvedValue(FAKE_CONFIGS),
    };

    encryptionMock = {
      decrypt: jest.fn().mockImplementation(() => {
        // Return client_id on odd calls, client_secret on even calls
        if (encryptionMock.decrypt.mock.calls.length % 2 === 1) {
          return 'fake-client-id';
        }
        return 'fake-client-secret';
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FakturoidClientService,
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

    service = module.get<FakturoidClientService>(FakturoidClientService);
  });

  afterEach(() => {
    service.clearCachedToken();
  });

  describe('authenticate()', () => {
    it('should obtain a token via Client Credentials grant', async () => {
      mockedAxios.post.mockResolvedValueOnce(
        mockTokenResponse('test-access-token'),
      );

      const token = await service.authenticate();

      expect(token).toBe('test-access-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://app.fakturoid.cz/api/v3/oauth/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: expect.stringMatching(/^Basic /) as unknown,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      // Verify the Basic auth header contains base64(clientId:clientSecret)
      const callArgs = mockedAxios.post.mock.calls[0];
      const options = callArgs[2] as
        | { headers: { Authorization: string } }
        | undefined;
      const authHeader = options?.headers.Authorization ?? '';
      const decoded = Buffer.from(
        authHeader.replace('Basic ', ''),
        'base64',
      ).toString();
      expect(decoded).toBe('fake-client-id:fake-client-secret');
    });

    it('should return cached token on subsequent calls without HTTP request', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('cached-token'));

      const token1 = await service.authenticate();
      const token2 = await service.authenticate();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      // Only one HTTP call should have been made
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should refresh token when it is about to expire', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('first-token'));

      await service.authenticate();
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Manually set token to be expired (force refresh)
      setTokenExpiresAt(service, new Date(Date.now() - 1000));

      mockedAxios.post.mockResolvedValueOnce(
        mockTokenResponse('refreshed-token'),
      );

      const token = await service.authenticate();

      expect(token).toBe('refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should refresh token when within 5-minute buffer window', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('first-token'));

      await service.authenticate();

      // Set tokenExpiresAt to 4 minutes from now (within 5-min buffer)
      setTokenExpiresAt(service, new Date(Date.now() + 4 * 60 * 1000));

      mockedAxios.post.mockResolvedValueOnce(
        mockTokenResponse('buffer-refreshed-token'),
      );

      const token = await service.authenticate();

      expect(token).toBe('buffer-refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('createInvoice()', () => {
    it('should send correct payload and return parsed response', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      const invoiceResponse = {
        id: 123,
        number: '2026-0001',
        total: '15000.0',
        status: 'open',
        subject_id: 42,
        html_url: 'https://app.fakturoid.cz/invoices/123',
      };

      mockedAxios.request.mockResolvedValueOnce({
        data: invoiceResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: { headers: {} },
      });

      const payload = {
        subject_id: 42,
        payment_method: 'bank',
        currency: 'CZK',
        lines: [
          {
            name: 'Web Development',
            quantity: 80,
            unit_name: 'hod',
            unit_price: 1500,
          },
        ],
      };

      const result = await service.createInvoice('test-slug', payload);

      expect(result).toEqual(invoiceResponse);
      expect(mockedAxios.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://app.fakturoid.cz/api/v3/accounts/test-slug/invoices.json',
        headers: {
          Authorization: 'Bearer test-token',
          'User-Agent': 'TogglFakturoidSync (test@example.com)',
          'Content-Type': 'application/json',
        },
        data: payload,
      });
    });
  });

  describe('getSubjects()', () => {
    it('should return parsed subject list and handle pagination', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      const subjects = [
        { id: 1, name: 'Client A', email: 'a@example.com' },
        { id: 2, name: 'Client B', email: null },
      ];

      // First page returns subjects, second page returns empty
      mockedAxios.request
        .mockResolvedValueOnce({
          data: subjects,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} },
        })
        .mockResolvedValueOnce({
          data: [],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} },
        });

      const result = await service.getSubjects('test-slug');

      expect(result).toEqual(subjects);
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);

      // First call for page 1
      expect(mockedAxios.request).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        url: 'https://app.fakturoid.cz/api/v3/accounts/test-slug/subjects.json?page=1',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }) as unknown,
        data: undefined,
      });
    });
  });

  describe('getInvoice()', () => {
    it('should fetch a single invoice by id', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      const invoice = {
        id: 456,
        number: '2026-0002',
        total: '25000.0',
        status: 'sent',
        subject_id: 10,
        html_url: 'https://app.fakturoid.cz/invoices/456',
      };

      mockedAxios.request.mockResolvedValueOnce({
        data: invoice,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      });

      const result = await service.getInvoice('test-slug', 456);

      expect(result).toEqual(invoice);
      expect(mockedAxios.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://app.fakturoid.cz/api/v3/accounts/test-slug/invoices/456.json',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }) as unknown,
        data: undefined,
      });
    });
  });

  describe('error handling', () => {
    it('should retry on 401 by clearing token and re-authenticating', async () => {
      // First authenticate call
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('old-token'));

      // First request fails with 401
      mockedAxios.request.mockRejectedValueOnce(
        createAxiosLikeError(401, 'Unauthorized'),
      );

      // Re-authenticate after 401
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('new-token'));

      // Retry succeeds
      const invoice = {
        id: 789,
        number: '2026-0003',
        total: '10000.0',
        status: 'open',
        subject_id: 5,
        html_url: 'https://app.fakturoid.cz/invoices/789',
      };
      mockedAxios.request.mockResolvedValueOnce({
        data: invoice,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      });

      const result = await service.getInvoice('test-slug', 789);

      expect(result).toEqual(invoice);
      // authenticate called twice (initial + retry)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      // request called twice (first fail + retry)
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException on 403 without leaking response data', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      mockedAxios.request.mockRejectedValueOnce(
        createAxiosLikeError(403, { error: 'Missing User-Agent' }),
      );

      try {
        await service.getInvoice('test-slug', 1);
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        // Verify the error message does not contain the raw response data
        expect((error as ForbiddenException).message).not.toContain(
          'Missing User-Agent',
        );
        expect((error as ForbiddenException).message).toContain(
          'Check User-Agent and credentials configuration',
        );
      }
    });

    it('should throw BadRequestException on 422 without leaking validation details', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      mockedAxios.request.mockRejectedValueOnce(
        createAxiosLikeError(422, { errors: ['subject_id is required'] }),
      );

      await expect(
        service.createInvoice('test-slug', {
          subject_id: 0,
          payment_method: 'bank',
          currency: 'CZK',
          lines: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw HttpException with 429 status after MAX_RETRIES exceeded', async () => {
      mockedAxios.post.mockResolvedValue(mockTokenResponse('test-token'));

      // All requests return 429
      mockedAxios.request.mockRejectedValue(
        createAxiosLikeError(
          429,
          { error: 'rate limited' },
          { 'retry-after': '0' },
        ),
      );

      await expect(service.getInvoice('test-slug', 1)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.getInvoice('test-slug', 1);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        expect((error as HttpException).message).toContain(
          'rate limit exceeded after maximum retries',
        );
      }
    }, 30000);

    it('should throw generic InternalServerErrorException without leaking error details', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));

      mockedAxios.request.mockRejectedValueOnce(
        createAxiosLikeError(500, { internal: 'secret-db-error' }),
      );

      await expect(service.getInvoice('test-slug', 1)).rejects.toThrow(
        InternalServerErrorException,
      );

      // Re-setup for second assertion
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));
      mockedAxios.request.mockRejectedValueOnce(
        createAxiosLikeError(500, { internal: 'secret-db-error' }),
      );

      await expect(service.getInvoice('test-slug', 1)).rejects.toThrow(
        'Fakturoid API request failed. Check server logs for details.',
      );
    });

    it('should throw when credentials are missing from DB', async () => {
      repoMock.find.mockResolvedValue([]);

      await expect(service.authenticate()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.authenticate()).rejects.toThrow(
        'Fakturoid credentials not found',
      );
    });

    it('should throw when specific config keys are missing', async () => {
      // Only provide slug, omit client_id, client_secret, user_agent_email
      repoMock.find.mockResolvedValue([
        buildPlainConfig('slug', 'test-slug') as ServiceConfig,
      ]);

      await expect(service.authenticate()).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.authenticate()).rejects.toThrow(
        'Missing Fakturoid config keys',
      );
    });
  });

  describe('clearCachedToken()', () => {
    it('should clear the cached token and force re-authentication', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('first-token'));

      const firstToken = await service.authenticate();
      expect(firstToken).toBe('first-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      // Clear token
      service.clearCachedToken();

      // Second authentication should make a new HTTP call
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('second-token'));

      const token = await service.authenticate();
      expect(token).toBe('second-token');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should also clear cached credentials, forcing a new DB query', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('first-token'));

      // First authenticate triggers getCredentials() -> DB query
      await service.authenticate();
      expect(repoMock.find).toHaveBeenCalledTimes(1);

      // Second authenticate uses cached credentials (no new DB query)
      service.clearCachedToken();
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('second-token'));

      // clearCachedToken clears credentials too, so authenticate will query DB again
      await service.authenticate();
      expect(repoMock.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('credential caching', () => {
    it('should cache credentials and not query DB on subsequent calls', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse('test-token'));
      mockedAxios.request.mockResolvedValueOnce({
        data: {
          id: 1,
          number: '2026-0001',
          total: '100',
          status: 'open',
          subject_id: 1,
          html_url: '',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      });

      await service.getInvoice('test-slug', 1);

      // request() calls getCredentials() which hits DB once (then caches)
      // authenticate() also receives credentials from request(), no extra DB call
      expect(repoMock.find).toHaveBeenCalledTimes(1);

      // Second request should use cached credentials
      mockedAxios.request.mockResolvedValueOnce({
        data: {
          id: 2,
          number: '2026-0002',
          total: '200',
          status: 'open',
          subject_id: 2,
          html_url: '',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      });

      await service.getInvoice('test-slug', 2);

      // Still only 1 DB call total thanks to caching
      expect(repoMock.find).toHaveBeenCalledTimes(1);
    });
  });
});
