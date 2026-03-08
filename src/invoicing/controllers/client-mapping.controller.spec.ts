/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientMappingController } from './client-mapping.controller';
import { ClientMappingService } from '../services/client-mapping.service';
import { ClientMapping } from '../entities/client-mapping.entity';

function createMapping(overrides: Partial<ClientMapping> = {}): ClientMapping {
  return {
    id: 1,
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

describe('ClientMappingController', () => {
  let controller: ClientMappingController;
  let service: jest.Mocked<ClientMappingService>;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<ClientMappingService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientMappingController],
      providers: [
        {
          provide: ClientMappingService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ClientMappingController>(ClientMappingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a client mapping', async () => {
      const mapping = createMapping();
      service.create.mockResolvedValue(mapping);

      const result = await controller.create({
        name: 'Acme Corp',
        togglClientId: 100,
        togglWorkspaceId: 999,
        fakturoidSubjectId: 500,
        hourlyRate: 1500,
      });

      expect(result).toEqual(mapping);
      expect(service.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate togglClientId', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'ClientMapping with togglClientId=100 already exists',
        ),
      );

      await expect(
        controller.create({
          name: 'Another Corp',
          togglClientId: 100,
          togglWorkspaceId: 999,
          fakturoidSubjectId: 501,
          hourlyRate: 2000,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all mappings', async () => {
      const mappings = [createMapping()];
      service.findAll.mockResolvedValue(mappings);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should filter by active=true', async () => {
      const activeMappings = [createMapping({ isActive: true })];
      service.findAll.mockResolvedValue(activeMappings);

      const result = await controller.findAll('true');

      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith('true');
    });

    it('should filter by active=false', async () => {
      const inactiveMappings = [createMapping({ isActive: false })];
      service.findAll.mockResolvedValue(inactiveMappings);

      const result = await controller.findAll('false');

      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith('false');
    });
  });

  describe('findOne', () => {
    it('should return a single mapping', async () => {
      const mapping = createMapping();
      service.findOne.mockResolvedValue(mapping);

      const result = await controller.findOne(1);

      expect(result).toEqual(mapping);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException for missing ID', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('ClientMapping with id="nonexistent" not found'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a mapping', async () => {
      const updatedMapping = createMapping({ name: 'Updated Corp' });
      service.update.mockResolvedValue(updatedMapping);

      const result = await controller.update(1, {
        name: 'Updated Corp',
      });

      expect(result.name).toBe('Updated Corp');
      expect(service.update).toHaveBeenCalledWith(1, {
        name: 'Updated Corp',
      });
    });

    it('should throw NotFoundException for missing ID', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('ClientMapping with id="nonexistent" not found'),
      );

      await expect(controller.update(999, { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when updating to duplicate togglClientId', async () => {
      service.update.mockRejectedValue(
        new ConflictException(
          'ClientMapping with togglClientId=200 already exists',
        ),
      );

      await expect(
        controller.update(1, { togglClientId: 200 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a mapping', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException for missing ID', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('ClientMapping with id="nonexistent" not found'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
