import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_HEX_LENGTH = 64;

export interface EncryptedData {
  encryptedValue: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');

    if (!keyHex) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required. ' +
          'It must be a 64-character hex string (32 bytes).',
      );
    }

    if (keyHex.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(keyHex)) {
      throw new Error(
        'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). ' +
          `Received ${keyHex.length} characters.`,
      );
    }

    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): EncryptedData {
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, this.key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return {
        encryptedValue: encrypted,
        iv,
        authTag,
      };
    } catch {
      throw new InternalServerErrorException('Encryption failed');
    }
  }

  decrypt(encryptedValue: Buffer, iv: Buffer, authTag: Buffer): string {
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedValue),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Decryption failed. The data may be corrupted or the encryption key may be incorrect.',
      );
    }
  }
}
