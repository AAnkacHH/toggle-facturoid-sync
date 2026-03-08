import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import axios from 'axios';
import { ServiceConfig } from '../entities/service-config.entity';
import { EncryptionService } from './encryption.service';
import {
  TogglMonthSummary,
  TogglProjectSummary,
  TogglSummaryResponse,
} from '../dto/toggl-summary.dto';

const BASE_URL = 'https://api.track.toggl.com/reports/api/v3';
const USER_AGENT = 'toggl-facturoid-sync/1.0';
const MAX_RETRIES = 3;

@Injectable()
export class TogglClientService {
  private readonly logger = new Logger(TogglClientService.name);

  constructor(
    @InjectRepository(ServiceConfig)
    private readonly serviceConfigRepo: Repository<ServiceConfig>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Retrieves and decrypts Toggl API credentials from the database.
   */
  private async getCredentials(): Promise<{
    apiToken: string;
    workspaceId: string;
  }> {
    const configs = await this.serviceConfigRepo.find({
      where: {
        serviceName: 'toggl',
        configKey: In(['api_token', 'workspace_id']),
      },
    });

    const apiTokenConfig = configs.find((c) => c.configKey === 'api_token');
    const workspaceIdConfig = configs.find(
      (c) => c.configKey === 'workspace_id',
    );

    if (!apiTokenConfig || !workspaceIdConfig) {
      throw new HttpException(
        'Toggl credentials not found in service_config. Please configure api_token and workspace_id for the toggl service.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (
      !apiTokenConfig.encryptedValue ||
      !apiTokenConfig.iv ||
      !apiTokenConfig.authTag
    ) {
      throw new HttpException(
        'Toggl api_token is not properly encrypted in service_config.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const apiToken = this.encryptionService.decrypt(
      apiTokenConfig.encryptedValue,
      apiTokenConfig.iv,
      apiTokenConfig.authTag,
    );

    const workspaceId = workspaceIdConfig.plainValue;

    if (!workspaceId) {
      throw new HttpException(
        'Toggl workspace_id is missing a plainValue in service_config.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { apiToken, workspaceId };
  }

  /**
   * Builds an HTTP Basic Auth header value from the API token.
   * Toggl expects the API token as username and literal "api_token" as password.
   */
  private buildAuthHeader(apiToken: string): string {
    return `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`;
  }

  /**
   * Fetches time entry summary from Toggl for a specific month,
   * grouped by clients and sub-grouped by projects.
   *
   * Handles 429 rate limiting with exponential backoff (max 3 retries).
   */
  async getMonthSummary(
    year: number,
    month: number,
  ): Promise<TogglMonthSummary[]> {
    const { apiToken, workspaceId } = await this.getCredentials();

    const startDate = this.formatDate(year, month, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = this.formatDate(year, month, lastDay);

    const url = `${BASE_URL}/workspace/${workspaceId}/summary/time_entries`;
    const body = {
      start_date: startDate,
      end_date: endDate,
      grouping: 'clients',
      sub_grouping: 'projects',
      include_time_entry_ids: false,
    };

    const headers = {
      Authorization: this.buildAuthHeader(apiToken),
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    };

    const response = await this.requestWithRetry<TogglSummaryResponse>(
      url,
      body,
      headers,
    );

    return this.parseResponse(response);
  }

  /**
   * Executes a POST request with exponential backoff retry on 429 responses.
   */
  private async requestWithRetry<T>(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<T>(url, body, { headers });
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;

          if (status === 401) {
            throw new HttpException(
              'Toggl API authentication failed. Please verify your api_token in service_config.',
              HttpStatus.UNAUTHORIZED,
            );
          }

          if (status === 429) {
            if (attempt >= MAX_RETRIES) {
              throw new HttpException(
                'Toggl API rate limit exceeded after maximum retries.',
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }

            const retryAfterHeader = String(
              error.response?.headers?.['retry-after'] ?? '',
            );
            const defaultDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            const delay = retryAfterHeader
              ? Number(retryAfterHeader) * 1000
              : defaultDelay;

            this.logger.warn(
              `Toggl API rate limited (429). Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
            );

            await this.sleep(delay);
            continue;
          }

          if (status && status >= 500) {
            throw new HttpException(
              `Toggl API server error: ${status}`,
              HttpStatus.BAD_GATEWAY,
            );
          }
        }

        throw new HttpException(
          'Failed to communicate with Toggl API.',
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    // This should never be reached due to the throw in the loop,
    // but TypeScript needs it for exhaustiveness.
    throw new HttpException(
      'Toggl API request failed after maximum retries.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Parses Toggl API response into application DTOs.
   * Filters out entries with null client IDs and converts seconds to hours.
   */
  private parseResponse(response: TogglSummaryResponse): TogglMonthSummary[] {
    return response.groups
      .filter((group) => group.id !== null)
      .map((group) => {
        const summary = new TogglMonthSummary();
        summary.clientId = group.id as number;
        summary.projects = group.sub_groups.map((subGroup) => {
          const project = new TogglProjectSummary();
          project.projectId = subGroup.id ?? 0;
          project.projectName = subGroup.title;
          project.totalSeconds = subGroup.seconds;
          project.totalHours =
            Math.round((subGroup.seconds / 3600) * 100) / 100;
          return project;
        });
        return summary;
      });
  }

  /**
   * Formats a date as YYYY-MM-DD string.
   */
  private formatDate(year: number, month: number, day: number): string {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  /**
   * Promise-based sleep utility for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
