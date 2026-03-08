/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientMappingController } from './client-mapping.controller';
import { ClientMapping } from '../entities/client-mapping.entity';

function createMapping(overrides: Partial<ClientMapping> = {}): ClientMapping {
  return {
    id: 'map-uuid-1',
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
  let repo: jest.Mocked<Repository<ClientMapping>>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<ClientMapping>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientMappingController],
      providers: [
        {
          provide: getRepositoryToken(ClientMapping),
          useValue: repo,
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
      repo.findOne.mockResolvedValue(null); // no duplicate
      repo.create.mockReturnValue(mapping);
      repo.save.mockResolvedValue(mapping);

      const result = await controller.create({
        name: 'Acme Corp',
        togglClientId: 100,
        togglWorkspaceId: 999,
        fakturoidSubjectId: 500,
        hourlyRate: 1500,
      });

      expect(result).toEqual(mapping);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate togglClientId', async () => {
      repo.findOne.mockResolvedValue(createMapping()); // duplicate found

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
      repo.find.mockResolvedValue(mappings);

      const result = await controller.findAll();

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalled();
    });

    it('should filter by active=true', async () => {
      const activeMappings = [createMapping({ isActive: true })];
      repo.find.mockResolvedValue(activeMappings);

      const result = await controller.findAll('true');

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should filter by active=false', async () => {
      const inactiveMappings = [createMapping({ isActive: false })];
      repo.find.mockResolvedValue(inactiveMappings);

      const result = await controller.findAll('false');

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: false },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single mapping', async () => {
      const mapping = createMapping();
      repo.findOne.mockResolvedValue(mapping);

      const result = await controller.findOne('map-uuid-1');

      expect(result).toEqual(mapping);
    });

    it('should throw NotFoundException for missing ID', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a mapping', async () => {
      const mapping = createMapping();
      const updatedMapping = createMapping({ name: 'Updated Corp' });
      repo.findOne.mockResolvedValue(mapping);
      repo.save.mockResolvedValue(updatedMapping);

      const result = await controller.update('map-uuid-1', {
        name: 'Updated Corp',
      });

      expect(result.name).toBe('Updated Corp');
    });

    it('should throw NotFoundException for missing ID', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        controller.update('nonexistent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to duplicate togglClientId', async () => {
      const mapping = createMapping();
      const duplicate = createMapping({
        id: 'map-uuid-2',
        togglClientId: '200',
      });

      // First call: find the mapping to update
      // Second call: check for duplicate togglClientId
      repo.findOne
        .mockResolvedValueOnce(mapping)
        .mockResolvedValueOnce(duplicate);

      await expect(
        controller.update('map-uuid-1', { togglClientId: 200 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a mapping', async () => {
      const mapping = createMapping();
      repo.findOne.mockResolvedValue(mapping);
      repo.remove.mockResolvedValue(mapping);

      await controller.remove('map-uuid-1');

      expect(repo.remove).toHaveBeenCalledWith(mapping);
    });

    it('should throw NotFoundException for missing ID', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
