/**
 * Tests for backup encryption utilities
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  computeChecksum,
  encryptBackup,
  decryptBackup,
  isEncryptedBackup,
  verifyBackupChecksum,
  addChecksumToBackup,
  getBackupFilename,
  ENCRYPTED_EXTENSION,
  PLAIN_EXTENSION,
  type PlainBackup,
  type EncryptedBackup,
} from '@/lib/backup-crypto';

// Mock crypto.subtle for Node.js test environment
beforeAll(() => {
  if (typeof globalThis.crypto === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { webcrypto } = require('crypto');
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
    });
  }
});

describe('backup-crypto', () => {
  describe('computeChecksum', () => {
    it('should compute SHA-256 checksum of string data', async () => {
      const checksum = await computeChecksum('hello world');
      expect(checksum).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
    });

    it('should produce different checksums for different data', async () => {
      const checksum1 = await computeChecksum('data1');
      const checksum2 = await computeChecksum('data2');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should produce consistent checksums for same data', async () => {
      const data = JSON.stringify({ foo: 'bar', num: 123 });
      const checksum1 = await computeChecksum(data);
      const checksum2 = await computeChecksum(data);
      expect(checksum1).toBe(checksum2);
    });
  });

  describe('encryptBackup and decryptBackup', () => {
    const sampleBackup: PlainBackup = {
      accounts: [{ id: '1', name: 'Test Account' }],
      transactions: [],
      categories: [],
      exportedAt: '2026-03-14T10:00:00Z',
      version: 2,
    };

    it('should encrypt and decrypt backup with correct password', async () => {
      const password = 'testpassword123';
      const encrypted = await encryptBackup(sampleBackup, password);
      const decrypted = await decryptBackup(encrypted, password);

      expect(decrypted.accounts).toEqual(sampleBackup.accounts);
      expect(decrypted.transactions).toEqual(sampleBackup.transactions);
      expect(decrypted.exportedAt).toBe(sampleBackup.exportedAt);
      expect(decrypted.version).toBe(sampleBackup.version);
    });

    it('should fail decryption with wrong password', async () => {
      const password = 'correctpassword';
      const wrongPassword = 'wrongpassword';

      const encrypted = await encryptBackup(sampleBackup, password);

      await expect(decryptBackup(encrypted, wrongPassword)).rejects.toThrow(
        'Decryption failed - incorrect password'
      );
    });

    it('should include magic header in encrypted backup', async () => {
      const encrypted = await encryptBackup(sampleBackup, 'password');
      expect(encrypted.magic).toBe('FLUXBY_ENCRYPTED_BACKUP_V1');
    });

    it('should include checksum in encrypted backup', async () => {
      const encrypted = await encryptBackup(sampleBackup, 'password');
      expect(encrypted.checksum).toBeDefined();
      expect(typeof encrypted.checksum).toBe('string');
      expect(encrypted.checksum.length).toBe(64); // SHA-256 hex
    });

    it('should verify checksum on decryption', async () => {
      const password = 'testpass';
      const encrypted = await encryptBackup(sampleBackup, password);

      // Tamper with checksum
      const tampered = { ...encrypted, checksum: 'invalidchecksum' };

      await expect(decryptBackup(tampered, password)).rejects.toThrow(
        'Checksum mismatch'
      );
    });

    it('should reject invalid magic header', async () => {
      const invalidBackup = {
        magic: 'INVALID_HEADER',
        salt: [1, 2, 3],
        nonce: [1, 2, 3],
        ciphertext: [1, 2, 3],
        checksum: 'abc',
      };

      await expect(decryptBackup(invalidBackup, 'password')).rejects.toThrow(
        'Invalid encrypted backup format'
      );
    });

    it('should produce different ciphertext for same data with different passwords', async () => {
      const encrypted1 = await encryptBackup(sampleBackup, 'password1');
      const encrypted2 = await encryptBackup(sampleBackup, 'password2');

      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });

    it('should produce different ciphertext on each encryption (random nonce)', async () => {
      const password = 'samepassword';
      const encrypted1 = await encryptBackup(sampleBackup, password);
      const encrypted2 = await encryptBackup(sampleBackup, password);

      // Nonces should be different
      expect(encrypted1.nonce).not.toEqual(encrypted2.nonce);
      // Salts should be different
      expect(encrypted1.salt).not.toEqual(encrypted2.salt);
    });
  });

  describe('isEncryptedBackup', () => {
    it('should return true for valid encrypted backup structure', () => {
      const encrypted: EncryptedBackup = {
        magic: 'FLUXBY_ENCRYPTED_BACKUP_V1',
        salt: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        nonce: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        ciphertext: [1, 2, 3, 4, 5],
        checksum: 'abc123',
      };
      expect(isEncryptedBackup(encrypted)).toBe(true);
    });

    it('should return false for plain backup', () => {
      const plain = {
        accounts: [],
        transactions: [],
        exportedAt: '2026-03-14',
        version: 2,
      };
      expect(isEncryptedBackup(plain)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isEncryptedBackup(null)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isEncryptedBackup('not an object')).toBe(false);
    });

    it('should return false for wrong magic header', () => {
      const wrongMagic = {
        magic: 'WRONG_HEADER',
        salt: [],
        nonce: [],
        ciphertext: [],
        checksum: 'abc',
      };
      expect(isEncryptedBackup(wrongMagic)).toBe(false);
    });
  });

  describe('verifyBackupChecksum', () => {
    it('should return valid=true and hasChecksum=false for backup without checksum', async () => {
      const backup: PlainBackup = {
        accounts: [],
        exportedAt: '2026-03-14',
        version: 2,
      };
      const result = await verifyBackupChecksum(backup);
      expect(result.valid).toBe(true);
      expect(result.hasChecksum).toBe(false);
    });

    it('should return valid=true for backup with correct checksum', async () => {
      const backup: PlainBackup = {
        accounts: [],
        exportedAt: '2026-03-14',
        version: 2,
      };
      const withChecksum = await addChecksumToBackup(backup);
      const result = await verifyBackupChecksum(withChecksum);
      expect(result.valid).toBe(true);
      expect(result.hasChecksum).toBe(true);
    });

    it('should return valid=false for backup with incorrect checksum', async () => {
      const backup: PlainBackup = {
        accounts: [],
        exportedAt: '2026-03-14',
        version: 2,
        checksum: 'invalidchecksum',
      };
      const result = await verifyBackupChecksum(backup);
      expect(result.valid).toBe(false);
      expect(result.hasChecksum).toBe(true);
    });
  });

  describe('addChecksumToBackup', () => {
    it('should add checksum to backup data', async () => {
      const backup: PlainBackup = {
        accounts: [{ id: '1' }],
        exportedAt: '2026-03-14',
        version: 2,
      };
      const result = await addChecksumToBackup(backup);
      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(result.checksum?.length).toBe(64);
    });

    it('should replace existing checksum', async () => {
      const backup: PlainBackup = {
        accounts: [],
        exportedAt: '2026-03-14',
        version: 2,
        checksum: 'oldchecksum',
      };
      const result = await addChecksumToBackup(backup);
      expect(result.checksum).not.toBe('oldchecksum');
    });

    it('should produce verifiable checksum', async () => {
      const backup: PlainBackup = {
        accounts: [{ id: '1', name: 'Test' }],
        transactions: [{ id: 't1', amount: 100 }],
        exportedAt: '2026-03-14T12:00:00Z',
        version: 2,
      };
      const withChecksum = await addChecksumToBackup(backup);
      const verification = await verifyBackupChecksum(withChecksum);
      expect(verification.valid).toBe(true);
    });
  });

  describe('getBackupFilename', () => {
    it('should return .json for plain backup', () => {
      const date = new Date('2026-03-14');
      const filename = getBackupFilename(date, false);
      expect(filename).toBe('fluxby-export-2026-03-14.json');
      expect(filename.endsWith(PLAIN_EXTENSION)).toBe(true);
    });

    it('should return .fluxby-encrypted for encrypted backup', () => {
      const date = new Date('2026-03-14');
      const filename = getBackupFilename(date, true);
      expect(filename).toBe('fluxby-export-2026-03-14.fluxby-encrypted');
      expect(filename.endsWith(ENCRYPTED_EXTENSION)).toBe(true);
    });

    it('should format date correctly', () => {
      const date = new Date('2025-01-05');
      const filename = getBackupFilename(date, false);
      expect(filename).toContain('2025-01-05');
    });
  });

  describe('end-to-end encryption cycle', () => {
    it('should handle complex backup data', async () => {
      const complexBackup: PlainBackup = {
        accounts: [
          { id: '1', name: 'Checking', balance: 1000.5 },
          { id: '2', name: 'Savings', balance: 5000.0 },
        ],
        transactions: [
          { id: 't1', amount: -50, description: 'Coffee ☕' },
          { id: 't2', amount: 100, description: 'Special chars: <>&"' },
        ],
        categories: [{ id: 'c1', name: 'Food', emoji: '🍕' }],
        categoryRules: [],
        budgets: [{ id: 'b1', amount: 500, categoryId: 'c1' }],
        exportedAt: '2026-03-14T10:00:00.000Z',
        version: 2,
      };

      const password = 'complex-password-123!@#';
      const encrypted = await encryptBackup(complexBackup, password);
      const decrypted = await decryptBackup(encrypted, password);

      expect(decrypted.accounts).toEqual(complexBackup.accounts);
      expect(decrypted.transactions).toEqual(complexBackup.transactions);
      expect(decrypted.categories).toEqual(complexBackup.categories);
      expect(decrypted.budgets).toEqual(complexBackup.budgets);
    });

    it('should handle empty backup', async () => {
      const emptyBackup: PlainBackup = {
        accounts: [],
        transactions: [],
        categories: [],
        exportedAt: '2026-03-14',
        version: 2,
      };

      const password = 'pass';
      const encrypted = await encryptBackup(emptyBackup, password);
      const decrypted = await decryptBackup(encrypted, password);

      expect(decrypted.accounts).toEqual([]);
      expect(decrypted.transactions).toEqual([]);
    });

    it('should handle unicode passwords', async () => {
      const backup: PlainBackup = {
        accounts: [],
        exportedAt: '2026-03-14',
        version: 2,
      };

      const unicodePassword = '密码🔐🎉';
      const encrypted = await encryptBackup(backup, unicodePassword);
      const decrypted = await decryptBackup(encrypted, unicodePassword);

      expect(decrypted.exportedAt).toBe(backup.exportedAt);
    });
  });
});
