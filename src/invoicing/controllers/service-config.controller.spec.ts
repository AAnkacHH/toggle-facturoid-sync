/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceConfigController } from './service-config.controller';
import {
  MaskedServiceConfig,
  ServiceConfigService,
} from '../services/service-config.service';

function createMaskedConfig(
  overrides: Partial<MaskedServiceConfig> = {},
): MaskedServiceConfig {
  return {
    id: 1,
    serviceName: 'toggl',
    configKey: 'api_token',
    isSecret: true,
    value: '******',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ServiceConfigController', () => {
  let controller: ServiceConfigController;
  let service: jest.Mocked<ServiceConfigService>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByService: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<ServiceConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceConfigController],
      providers: [
        {
          provide: ServiceConfigService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ServiceConfigController>(ServiceConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a secret config and return masked value', async () => {
      const masked = createMaskedConfig();
      service.create.mockResolvedValue(masked);

      const result = await controller.create({
        serviceName: 'toggl',
        configKey: 'api_token',
        value: 'real-secret-token',
        isSecret: true,
      });

      expect(result).toEqual(masked);
      expect(result.value).toBe('******');
      expect(result.isSecret).toBe(true);
      expect(service.create).toHaveBeenCalledWith({
        serviceName: 'toggl',
        configKey: 'api_token',
        value: 'real-secret-token',
        isSecret: true,
      });
    });

    it('should create a plain config and return actual value', async () => {
      const masked = createMaskedConfig({
        configKey: 'slug',
        isSecret: false,
        value: 'my-account',
      });
      service.create.mockResolvedValue(masked);

      const result = await controller.create({
        serviceName: 'toggl',
        configKey: 'slug',
        value: 'my-account',
        isSecret: false,
      });

      expect(result.value).toBe('my-account');
      expect(result.isSecret).toBe(false);
    });

    it('should throw ConflictException for duplicate serviceName+configKey', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'Config with serviceName="toggl" and configKey="api_token" already exists',
        ),
      );

      await expect(
        controller.create({
          serviceName: 'toggl',
          configKey: 'api_token',
          value: 'some-value',
          isSecret: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all configs with masked secrets', async () => {
      const configs = [
        createMaskedConfig(),
        createMaskedConfig({
          id: 2,
          configKey: 'slug',
          isSecret: false,
          value: 'my-account',
        }),
      ];
      service.findAll.mockResolvedValue(configs);

      const result = await controller.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('******');
      expect(result[1].value).toBe('my-account');
    });
  });

  describe('findOne', () => {
    it('should return a single masked config', async () => {
      const masked = createMaskedConfig();
      service.findOne.mockResolvedValue(masked);

      const result = await controller.findOne(1);

      expect(result).toEqual(masked);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException for missing ID', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('ServiceConfig with id="nonexistent" not found'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByService', () => {
    it('should return configs filtered by service name', async () => {
      const configs = [createMaskedConfig()];
      service.findByService.mockResolvedValue(configs);

      const result = await controller.findByService('toggl');

      expect(result).toHaveLength(1);
      expect(service.findByService).toHaveBeenCalledWith('toggl');
    });
  });

  describe('update', () => {
    it('should update and return masked config', async () => {
      const masked = createMaskedConfig({ configKey: 'updated_key' });
      service.update.mockResolvedValue(masked);

      const result = await controller.update(1, {
        configKey: 'updated_key',
      });

      expect(result.configKey).toBe('updated_key');
      expect(service.update).toHaveBeenCalledWith(1, {
        configKey: 'updated_key',
      });
    });
  });

  describe('remove', () => {
    it('should remove a config', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException for missing ID', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('ServiceConfig with id="nonexistent" not found'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
