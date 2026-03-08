import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceConfig } from '../entities/service-config.entity';
import { EncryptionService } from './encryption.service';
import { CreateServiceConfigDto } from '../dto/create-service-config.dto';
import { UpdateServiceConfigDto } from '../dto/update-service-config.dto';

export interface MaskedServiceConfig {
  id: string;
  serviceName: string;
  configKey: string;
  isSecret: boolean;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ServiceConfigService {
  constructor(
    @InjectRepository(ServiceConfig)
    private readonly repo: Repository<ServiceConfig>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateServiceConfigDto): Promise<MaskedServiceConfig> {
    // Check for duplicate (serviceName, configKey)
    const existing = await this.repo.findOne({
      where: { serviceName: dto.serviceName, configKey: dto.configKey },
    });

    if (existing) {
      throw new ConflictException(
        `Config with serviceName="${dto.serviceName}" and configKey="${dto.configKey}" already exists`,
      );
    }

    const entity = this.repo.create({
      serviceName: dto.serviceName,
      configKey: dto.configKey,
      isSecret: dto.isSecret,
    });

    if (dto.isSecret) {
      const encrypted = this.encryptionService.encrypt(dto.value);
      entity.encryptedValue = encrypted.encryptedValue;
      entity.iv = encrypted.iv;
      entity.authTag = encrypted.authTag;
      entity.plainValue = null;
    } else {
      entity.plainValue = dto.value;
      entity.encryptedValue = null;
      entity.iv = null;
      entity.authTag = null;
    }

    const saved = await this.repo.save(entity);
    return this.mask(saved);
  }

  async findAll(): Promise<MaskedServiceConfig[]> {
    const configs = await this.repo.find();
    return configs.map((c) => this.mask(c));
  }

  async findOne(id: string): Promise<MaskedServiceConfig> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`ServiceConfig with id="${id}" not found`);
    }
    return this.mask(config);
  }

  async findByService(serviceName: string): Promise<MaskedServiceConfig[]> {
    const configs = await this.repo.find({ where: { serviceName } });
    return configs.map((c) => this.mask(c));
  }

  async update(
    id: string,
    dto: UpdateServiceConfigDto,
  ): Promise<MaskedServiceConfig> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`ServiceConfig with id="${id}" not found`);
    }

    // If serviceName or configKey is being updated, check for duplicate
    const newServiceName = dto.serviceName ?? config.serviceName;
    const newConfigKey = dto.configKey ?? config.configKey;

    if (dto.serviceName !== undefined || dto.configKey !== undefined) {
      const duplicate = await this.repo.findOne({
        where: { serviceName: newServiceName, configKey: newConfigKey },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Config with serviceName="${newServiceName}" and configKey="${newConfigKey}" already exists`,
        );
      }
    }

    if (dto.serviceName !== undefined) {
      config.serviceName = dto.serviceName;
    }
    if (dto.configKey !== undefined) {
      config.configKey = dto.configKey;
    }
    if (dto.isSecret !== undefined) {
      config.isSecret = dto.isSecret;
    }

    // If value is provided, re-encrypt or store as plain
    if (dto.value !== undefined) {
      const isSecret = dto.isSecret ?? config.isSecret;
      if (isSecret) {
        const encrypted = this.encryptionService.encrypt(dto.value);
        config.encryptedValue = encrypted.encryptedValue;
        config.iv = encrypted.iv;
        config.authTag = encrypted.authTag;
        config.plainValue = null;
      } else {
        config.plainValue = dto.value;
        config.encryptedValue = null;
        config.iv = null;
        config.authTag = null;
      }
    }

    const saved = await this.repo.save(config);
    return this.mask(saved);
  }

  async remove(id: string): Promise<void> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`ServiceConfig with id="${id}" not found`);
    }
    await this.repo.remove(config);
  }

  /**
   * Masks sensitive data: never return encryptedValue, iv, or authTag.
   * For secret configs, value is shown as '******'.
   * For plain configs, value is the actual plainValue.
   */
  private mask(config: ServiceConfig): MaskedServiceConfig {
    return {
      id: config.id,
      serviceName: config.serviceName,
      configKey: config.configKey,
      isSecret: config.isSecret,
      value: config.isSecret ? '******' : (config.plainValue ?? ''),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
