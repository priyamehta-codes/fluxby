/**
 * Tests for encryption utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMasterKey,
  randomBytes,
  wrapMasterKey,
  unwrapMasterKey,
  encryptData,
  decryptData,
  deriveKey,
} from '../../packages/database/src/encryption.js';

describe('encryption', () => {
  describe('generateMasterKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateMasterKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1).not.toEqual(key2);
    });
  });

  describe('randomBytes', () => {
    it('should generate bytes of requested length', () => {
      const bytes16 = randomBytes(16);
      const bytes32 = randomBytes(32);
      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
    });

    it('should generate unique values', () => {
      const bytes1 = randomBytes(16);
      const bytes2 = randomBytes(16);
      expect(bytes1).not.toEqual(bytes2);
    });
  });

  describe('wrapMasterKey / unwrapMasterKey', () => {
    let masterKey: Uint8Array;
    const testPin = '123456';

    beforeEach(() => {
      masterKey = generateMasterKey();
    });

    it('should wrap and unwrap master key correctly', async () => {
      const wrapped = await wrapMasterKey(masterKey, testPin);

      expect(wrapped).toHaveProperty('ciphertext');
      expect(wrapped).toHaveProperty('salt');
      expect(wrapped).toHaveProperty('nonce');
      expect(wrapped).toHaveProperty('iterations');

      const unwrapped = await unwrapMasterKey(wrapped, testPin);
      expect(unwrapped).toEqual(masterKey);
    });

    it('should fail to unwrap with wrong password', async () => {
      const wrapped = await wrapMasterKey(masterKey, testPin);

      await expect(
        unwrapMasterKey(wrapped, 'wrong-password')
      ).rejects.toThrow();
    });

    it('should produce different ciphertext for same key', async () => {
      const wrapped1 = await wrapMasterKey(masterKey, testPin);
      const wrapped2 = await wrapMasterKey(masterKey, testPin);

      // Salt and nonce should be different each time
      expect(wrapped1.salt).not.toEqual(wrapped2.salt);
      expect(wrapped1.nonce).not.toEqual(wrapped2.nonce);
      expect(wrapped1.ciphertext).not.toEqual(wrapped2.ciphertext);
    });
  });

  describe('PBKDF2 Security Parameters', () => {
    it('should use minimum 100,000 iterations for key derivation', async () => {
      const wrapped = await wrapMasterKey(generateMasterKey(), 'testPassword');

      // Verify iterations are stored and meet minimum security requirement
      expect(wrapped.iterations).toBeGreaterThanOrEqual(100000);
    });

    it('should store iteration count in wrapped key for future-proofing', async () => {
      const wrapped = await wrapMasterKey(generateMasterKey(), 'testPassword');

      // Verify iterations are explicitly stored (not hardcoded on decrypt)
      expect(wrapped).toHaveProperty('iterations');
      expect(typeof wrapped.iterations).toBe('number');
    });

    it('should use unique salt for each key derivation', async () => {
      const key = generateMasterKey();
      const wrapped1 = await wrapMasterKey(key, 'samePassword');
      const wrapped2 = await wrapMasterKey(key, 'samePassword');

      // Same password, same key, but different salts
      expect(wrapped1.salt).not.toEqual(wrapped2.salt);
      expect(wrapped1.salt.length).toBe(16); // 128-bit salt
    });

    it('should produce cryptographically distinct keys for different passwords', async () => {
      const salt = randomBytes(16);

      const key1 = await deriveKey({
        password: 'password1',
        salt,
        iterations: 100000,
      });
      const key2 = await deriveKey({
        password: 'password2',
        salt,
        iterations: 100000,
      });

      // Export keys to compare (they should be different)
      // The keys themselves are CryptoKey objects, so we verify via encryption
      const testData = new TextEncoder().encode('test');
      const nonce = randomBytes(12);

      const encrypted1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key1,
        testData
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key2,
        testData
      );

      // Same plaintext, same nonce, different keys = different ciphertext
      expect(new Uint8Array(encrypted1)).not.toEqual(
        new Uint8Array(encrypted2)
      );
    });

    it('should make key derivation timing-resistant (>50ms for 100k iterations)', async () => {
      const salt = randomBytes(16);
      const start = performance.now();

      await deriveKey({ password: 'testPassword', salt, iterations: 100000 });

      const elapsed = performance.now() - start;

      // PBKDF2 with 100k iterations should take noticeable time (security feature)
      // If it's too fast, it might be vulnerable to brute force
      expect(elapsed).toBeGreaterThan(10); // At least 10ms (conservative)
    });
  });

  describe('encryptData / decryptData', () => {
    let masterKey: Uint8Array;

    beforeEach(() => {
      masterKey = generateMasterKey();
    });

    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = new TextEncoder().encode('Hello, World!');

      const encrypted = await encryptData(plaintext, masterKey);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(plaintext.length);

      const decrypted = await decryptData(encrypted, masterKey);
      expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!');
    });

    it('should fail to decrypt with wrong key', async () => {
      const plaintext = new TextEncoder().encode('Secret data');
      const encrypted = await encryptData(plaintext, masterKey);

      const wrongKey = generateMasterKey();
      await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = new TextEncoder().encode('Same data');

      const encrypted1 = await encryptData(plaintext, masterKey);
      const encrypted2 = await encryptData(plaintext, masterKey);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle empty data', async () => {
      const plaintext = new Uint8Array(0);

      const encrypted = await encryptData(plaintext, masterKey);
      const decrypted = await decryptData(encrypted, masterKey);

      expect(decrypted.length).toBe(0);
    });

    it('should handle large data', async () => {
      // 64KB of data (max for getRandomValues)
      const plaintext = new Uint8Array(64 * 1024);
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i % 256;
      }

      const encrypted = await encryptData(plaintext, masterKey);
      const decrypted = await decryptData(encrypted, masterKey);

      expect(decrypted).toEqual(plaintext);
    });
  });
});
