import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ServiceConfig } from '../entities/service-config.entity';
import { EncryptionService } from './encryption.service';
import {
  FakturoidInvoicePayload,
  FakturoidInvoiceResponse,
  FakturoidSubject,
  FakturoidTokenResponse,
} from '../dto/fakturoid-invoice.dto';

const FAKTUROID_BASE_URL = 'https://app.fakturoid.cz/api/v3';
const TOKEN_REFRESH_BUFFER_SECONDS = 300; // refresh 5 minutes before expiry
const MAX_RETRIES = 3;

interface HttpErrorResponse {
  isAxiosError?: boolean;
  response?: {
    status: number;
    data?: unknown;
    headers?: Record<string, string>;
  };
  message?: string;
}

function isHttpError(error: unknown): error is HttpErrorResponse {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as Record<string, unknown>;
  return err.isAxiosError === true || err.response != null;
}

interface FakturoidCredentials {
  clientId: string;
  clientSecret: string;
  slug: string;
  userAgentEmail: string;
}

@Injectable()
export class FakturoidClientService {
  private readonly logger = new Logger(FakturoidClientService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private cachedCredentials: FakturoidCredentials | null = null;

  constructor(
    @InjectRepository(ServiceConfig)
    private readonly serviceConfigRepo: Repository<ServiceConfig>,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async getCredentials(): Promise<FakturoidCredentials> {
    if (this.cachedCredentials) {
      return this.cachedCredentials;
    }

    const configs = await this.serviceConfigRepo.find({
      where: { serviceName: 'fakturoid' },
    });

    if (configs.length === 0) {
      throw new InternalServerErrorException(
        'Fakturoid credentials not found in service_config table',
      );
    }

    const configMap = new Map<string, ServiceConfig>();
    for (const config of configs) {
      configMap.set(config.configKey, config);
    }

    const clientIdConfig = configMap.get('client_id');
    const clientSecretConfig = configMap.get('client_secret');
    const slugConfig = configMap.get('slug');
    const emailConfig = configMap.get('user_agent_email');

    if (!clientIdConfig || !clientSecretConfig || !slugConfig || !emailConfig) {
      const missing: string[] = [];
      if (!clientIdConfig) missing.push('client_id');
      if (!clientSecretConfig) missing.push('client_secret');
      if (!slugConfig) missing.push('slug');
      if (!emailConfig) missing.push('user_agent_email');
      throw new InternalServerErrorException(
        `Missing Fakturoid config keys: ${missing.join(', ')}`,
      );
    }

    // Decrypt secret values
    if (
      !clientIdConfig.encryptedValue ||
      !clientIdConfig.iv ||
      !clientIdConfig.authTag
    ) {
      throw new InternalServerErrorException(
        'Fakturoid client_id encryption data is incomplete',
      );
    }
    const clientId = this.encryptionService.decrypt(
      clientIdConfig.encryptedValue,
      clientIdConfig.iv,
      clientIdConfig.authTag,
    );

    if (
      !clientSecretConfig.encryptedValue ||
      !clientSecretConfig.iv ||
      !clientSecretConfig.authTag
    ) {
      throw new InternalServerErrorException(
        'Fakturoid client_secret encryption data is incomplete',
      );
    }
    const clientSecret = this.encryptionService.decrypt(
      clientSecretConfig.encryptedValue,
      clientSecretConfig.iv,
      clientSecretConfig.authTag,
    );

    // Read plain values
    if (!slugConfig.plainValue) {
      throw new InternalServerErrorException(
        'Fakturoid slug is not set in service_config',
      );
    }
    if (!emailConfig.plainValue) {
      throw new InternalServerErrorException(
        'Fakturoid user_agent_email is not set in service_config',
      );
    }

    this.cachedCredentials = {
      clientId,
      clientSecret,
      slug: slugConfig.plainValue,
      userAgentEmail: emailConfig.plainValue,
    };

    return this.cachedCredentials;
  }

  async authenticate(credentials?: FakturoidCredentials): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferMs = TOKEN_REFRESH_BUFFER_SECONDS * 1000;
      if (now.getTime() + bufferMs < this.tokenExpiresAt.getTime()) {
        return this.accessToken;
      }
    }

    const creds = credentials ?? (await this.getCredentials());
    const { clientId, clientSecret } = creds;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    try {
      const response = await axios.post<FakturoidTokenResponse>(
        `${FAKTUROID_BASE_URL}/oauth/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000,
      );

      this.logger.log('Fakturoid OAuth token obtained successfully');
      return this.accessToken;
    } catch (error: unknown) {
      this.accessToken = null;
      this.tokenExpiresAt = null;
      this.cachedCredentials = null;

      if (isHttpError(error)) {
        throw new UnauthorizedException(
          `Fakturoid authentication failed: ${error.response?.status ?? 'unknown'} - ${
            error.message ?? ''
          }`,
        );
      }
      throw new InternalServerErrorException(
        'Fakturoid authentication failed unexpectedly',
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    retryCount = 0,
  ): Promise<T> {
    const credentials = await this.getCredentials();
    const token = await this.authenticate(credentials);

    const url = `${FAKTUROID_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'User-Agent': `TogglFakturoidSync (${credentials.userAgentEmail})`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.request<T>({
        method,
        url,
        headers,
        data,
      });

      return response.data;
    } catch (error: unknown) {
      if (!isHttpError(error)) {
        throw new InternalServerErrorException(
          'Unexpected error during Fakturoid API request',
        );
      }

      const status = error.response?.status;

      // 401: clear token and retry once (only on first attempt)
      if (status === 401 && retryCount === 0) {
        this.logger.warn('Fakturoid returned 401, clearing token and retrying');
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.cachedCredentials = null;
        return this.request<T>(method, path, data, retryCount + 1);
      }

      // 403: likely missing User-Agent
      if (status === 403) {
        this.logger.error(
          `Fakturoid API 403: ${JSON.stringify(error.response?.data)}`,
        );
        throw new ForbiddenException(
          'Fakturoid API returned 403 Forbidden. Check User-Agent and credentials configuration.',
        );
      }

      // 422: validation errors
      if (status === 422) {
        this.logger.error(
          `Fakturoid validation errors: ${JSON.stringify(error.response?.data)}`,
        );
        throw new BadRequestException(
          'Fakturoid rejected the invoice payload. Check server logs for validation details.',
        );
      }

      // 429: rate limit exceeded
      if (status === 429) {
        if (retryCount >= MAX_RETRIES) {
          throw new HttpException(
            'Fakturoid API rate limit exceeded after maximum retries.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        const retryAfter = error.response?.headers?.['retry-after'];
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;

        this.logger.warn(
          `Fakturoid rate limit hit (429). Waiting ${waitMs}ms before retry (attempt ${retryCount + 1}/${MAX_RETRIES}).`,
        );

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.request<T>(method, path, data, retryCount + 1);
      }

      this.logger.error(
        `Fakturoid API error ${String(status)}: ${JSON.stringify(error.response?.data)}`,
      );
      throw new InternalServerErrorException(
        'Fakturoid API request failed. Check server logs for details.',
      );
    }
  }

  async createInvoice(
    slug: string,
    payload: FakturoidInvoicePayload,
  ): Promise<FakturoidInvoiceResponse> {
    this.logger.log(
      `Creating invoice for subject_id=${payload.subject_id} in account "${slug}"`,
    );

    return this.request<FakturoidInvoiceResponse>(
      'POST',
      `/accounts/${slug}/invoices.json`,
      payload,
    );
  }

  async getSubjects(slug: string): Promise<FakturoidSubject[]> {
    this.logger.log(`Fetching subjects for account "${slug}"`);

    const allSubjects: FakturoidSubject[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const subjects = await this.request<FakturoidSubject[]>(
        'GET',
        `/accounts/${slug}/subjects.json?page=${page}`,
      );

      if (subjects.length === 0) {
        hasMore = false;
      } else {
        allSubjects.push(...subjects);
        page++;
      }
    }

    return allSubjects;
  }

  async getInvoice(
    slug: string,
    invoiceId: number,
  ): Promise<FakturoidInvoiceResponse> {
    this.logger.log(`Fetching invoice ${invoiceId} from account "${slug}"`);

    return this.request<FakturoidInvoiceResponse>(
      'GET',
      `/accounts/${slug}/invoices/${invoiceId}.json`,
    );
  }

  /**
   * Clears cached token and credentials. Useful for testing or manual token invalidation.
   */
  clearCachedToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.cachedCredentials = null;
  }
}
