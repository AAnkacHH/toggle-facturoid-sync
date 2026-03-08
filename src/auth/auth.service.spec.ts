import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ServiceConfig } from '../invoicing/entities/service-config.entity';

describe('AuthService', () => {
  let service: AuthService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(ServiceConfig),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('setup', () => {
    it('should generate a secret and store hashed value', async () => {
      repo.findOne.mockResolvedValue(null);

      const secret = await service.setup();

      expect(secret).toBeDefined();
      expect(secret).toHaveLength(64); // 32 bytes hex
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'system',
          configKey: 'api_secret_hash',
          isSecret: false,
          encryptedValue: null,
          iv: null,
          authTag: null,
        }),
      );
      expect(repo.save).toHaveBeenCalled();

      // plainValue should be salt$hash format
      const savedEntity = repo.create.mock.results[0].value;
      expect(savedEntity.plainValue).toContain('$');
      const parts = savedEntity.plainValue.split('$');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // 16 bytes hex salt
      expect(parts[1]).toHaveLength(64); // sha256 hex hash
    });

    it('should throw ConflictException if secret already configured', async () => {
      repo.findOne.mockResolvedValue({ id: '1', plainValue: 'salt$hash' });

      await expect(service.setup()).rejects.toThrow(ConflictException);
      await expect(service.setup()).rejects.toThrow(
        'API secret has already been configured',
      );
    });
  });

  describe('validateSecret', () => {
    it('should return true for a valid secret', async () => {
      // First do a setup to get the stored hash
      repo.findOne.mockResolvedValueOnce(null);
      const secret = await service.setup();

      // Now extract the stored plainValue from the save call
      const savedEntity = repo.create.mock.results[0].value;

      // Mock findOne to return the stored entity
      repo.findOne.mockResolvedValue({
        plainValue: savedEntity.plainValue,
      });

      const result = await service.validateSecret(secret);
      expect(result).toBe(true);
    });

    it('should return false for an invalid secret', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const secret = await service.setup();

      const savedEntity = repo.create.mock.results[0].value;
      repo.findOne.mockResolvedValue({
        plainValue: savedEntity.plainValue,
      });

      // Use wrong secret (but ignore the generated one)
      void secret;
      const result = await service.validateSecret('wrong-secret');
      expect(result).toBe(false);
    });

    it('should throw UnauthorizedException if not configured', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.validateSecret('any')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('isSetupComplete', () => {
    it('should return true when secret exists', async () => {
      repo.findOne.mockResolvedValue({ id: '1' });
      const result = await service.isSetupComplete();
      expect(result).toBe(true);
    });

    it('should return false when no secret exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.isSetupComplete();
      expect(result).toBe(false);
    });
  });
});
