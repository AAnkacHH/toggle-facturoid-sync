import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

// Valid 64-hex-char test key (32 bytes)
const TEST_KEY = 'a'.repeat(64);
// A different valid key for wrong-key test
const WRONG_KEY = 'b'.repeat(64);

function createConfigService(key: string | undefined): ConfigService {
  return {
    get: jest.fn((envKey: string) => {
      if (envKey === 'ENCRYPTION_KEY') return key;
      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: createConfigService(TEST_KEY),
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should encrypt and decrypt a string (round-trip)', () => {
    const plaintext = 'my-secret-api-token-12345';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted.encryptedValue).toBeInstanceOf(Buffer);
    expect(encrypted.iv).toBeInstanceOf(Buffer);
    expect(encrypted.authTag).toBeInstanceOf(Buffer);
    expect(encrypted.iv.length).toBe(12);

    const decrypted = service.decrypt(
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for different plaintexts', () => {
    const encrypted1 = service.encrypt('secret-one');
    const encrypted2 = service.encrypt('secret-two');

    expect(encrypted1.encryptedValue.equals(encrypted2.encryptedValue)).toBe(
      false,
    );
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-secret';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    // IVs should differ
    expect(encrypted1.iv.equals(encrypted2.iv)).toBe(false);
    // Ciphertexts should differ due to different IVs
    expect(encrypted1.encryptedValue.equals(encrypted2.encryptedValue)).toBe(
      false,
    );

    // But both should decrypt to the same plaintext
    expect(
      service.decrypt(
        encrypted1.encryptedValue,
        encrypted1.iv,
        encrypted1.authTag,
      ),
    ).toBe(plaintext);
    expect(
      service.decrypt(
        encrypted2.encryptedValue,
        encrypted2.iv,
        encrypted2.authTag,
      ),
    ).toBe(plaintext);
  });

  it('should fail to decrypt with a wrong key', () => {
    const encrypted = service.encrypt('my-secret');

    // Create a service with a different key
    const wrongKeyService = new EncryptionService(
      createConfigService(WRONG_KEY),
    );

    expect(() =>
      wrongKeyService.decrypt(
        encrypted.encryptedValue,
        encrypted.iv,
        encrypted.authTag,
      ),
    ).toThrow('Decryption failed');
  });

  it('should fail to decrypt with tampered ciphertext', () => {
    const encrypted = service.encrypt('my-secret');

    // Tamper with the encrypted value
    const tampered = Buffer.from(encrypted.encryptedValue);
    tampered[0] = tampered[0] ^ 0xff;

    expect(() =>
      service.decrypt(tampered, encrypted.iv, encrypted.authTag),
    ).toThrow('Decryption failed');
  });

  it('should throw an error when ENCRYPTION_KEY is missing', () => {
    expect(() => new EncryptionService(createConfigService(undefined))).toThrow(
      'ENCRYPTION_KEY environment variable is required',
    );
  });

  it('should throw an error when ENCRYPTION_KEY has invalid length', () => {
    expect(
      () => new EncryptionService(createConfigService('abcd1234')),
    ).toThrow('ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  });

  it('should throw an error when ENCRYPTION_KEY has non-hex characters', () => {
    const invalidKey = 'g'.repeat(64);
    expect(
      () => new EncryptionService(createConfigService(invalidKey)),
    ).toThrow('ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  });

  it('should handle empty string encryption/decryption', () => {
    const encrypted = service.encrypt('');
    const decrypted = service.decrypt(
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe('');
  });

  it('should handle unicode string encryption/decryption', () => {
    const plaintext = 'Ahoj svetle! Fakturoid API klic 12345';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
    );
    expect(decrypted).toBe(plaintext);
  });
});
