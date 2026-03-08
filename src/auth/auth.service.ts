import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { ServiceConfig } from '../invoicing/entities/service-config.entity';

const SYSTEM_SERVICE_NAME = 'system';
const API_SECRET_CONFIG_KEY = 'api_secret_hash';
const SEPARATOR = '$';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(ServiceConfig)
    private readonly repo: Repository<ServiceConfig>,
  ) {}

  /**
   * One-time setup: generates a random API secret, stores its salted hash
   * in service_config, and returns the plaintext secret to the caller.
   * This is the ONLY time the secret is shown.
   */
  async setup(): Promise<string> {
    const existing = await this.repo.findOne({
      where: {
        serviceName: SYSTEM_SERVICE_NAME,
        configKey: API_SECRET_CONFIG_KEY,
      },
    });

    if (existing) {
      throw new ConflictException(
        'API secret has already been configured. Setup can only be run once.',
      );
    }

    const secret = randomBytes(32).toString('hex'); // 64 hex chars
    const salt = randomBytes(16).toString('hex'); // 32 hex chars
    const hash = createHmac('sha256', salt).update(secret).digest('hex');

    const entity = this.repo.create({
      serviceName: SYSTEM_SERVICE_NAME,
      configKey: API_SECRET_CONFIG_KEY,
      isSecret: false,
      plainValue: `${salt}${SEPARATOR}${hash}`,
      encryptedValue: null,
      iv: null,
      authTag: null,
    });

    await this.repo.save(entity);

    return secret;
  }

  /**
   * Validates a provided secret against the stored salted hash.
   */
  async validateSecret(providedSecret: string): Promise<boolean> {
    const config = await this.repo.findOne({
      where: {
        serviceName: SYSTEM_SERVICE_NAME,
        configKey: API_SECRET_CONFIG_KEY,
      },
    });

    if (!config) {
      throw new UnauthorizedException(
        'API not configured. Run POST /api/auth/setup first.',
      );
    }

    const stored = config.plainValue ?? '';
    const sepIndex = stored.indexOf(SEPARATOR);
    if (sepIndex === -1) {
      return false;
    }

    const salt = stored.substring(0, sepIndex);
    const storedHash = stored.substring(sepIndex + 1);

    const computedHash = createHmac('sha256', salt)
      .update(providedSecret)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const storedBuf = Buffer.from(storedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');

    if (storedBuf.length !== computedBuf.length) {
      return false;
    }

    return timingSafeEqual(storedBuf, computedBuf);
  }

  /**
   * Checks whether the initial setup has been completed.
   */
  async isSetupComplete(): Promise<boolean> {
    const config = await this.repo.findOne({
      where: {
        serviceName: SYSTEM_SERVICE_NAME,
        configKey: API_SECRET_CONFIG_KEY,
      },
    });

    return config !== null;
  }
}
