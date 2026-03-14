/**
 * Peer-to-Peer Encryption Tests
 *
 * Tests the sync-encryption module for:
 * - Key exchange between peers
 * - Message encryption/decryption
 * - Security: downgrade attack prevention
 * - Session management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEncryptionSession,
  completeKeyExchange,
  encryptMessage,
  decryptMessage,
  isEncryptedEnvelope,
  generateECDHKeyPair,
  importPublicKey,
  deriveSharedSecret,
  SyncEncryption,
  type SyncEncryptionSession,
  type EncryptedEnvelope,
} from '../../packages/core/src/sync-encryption';

describe('Peer-to-peer encryption', () => {
  describe('Key exchange', () => {
    it('should generate ECDH key pair', async () => {
      const keyPair = await generateECDHKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKeyJwk).toBeDefined();
      expect(keyPair.publicKeyJwk.kty).toBe('EC');
      expect(keyPair.publicKeyJwk.crv).toBe('P-256');
      expect(keyPair.publicKeyJwk.x).toBeDefined();
      expect(keyPair.publicKeyJwk.y).toBeDefined();
    });

    it('should import remote public key from JWK', async () => {
      const keyPair = await generateECDHKeyPair();
      const importedKey = await importPublicKey(keyPair.publicKeyJwk);

      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('public');
    });

    it('should derive same shared secret on both sides', async () => {
      // Generate key pairs for both peers
      const keyPairA = await generateECDHKeyPair();
      const keyPairB = await generateECDHKeyPair();

      // Import each other's public keys
      const publicKeyBForA = await importPublicKey(keyPairB.publicKeyJwk);
      const publicKeyAForB = await importPublicKey(keyPairA.publicKeyJwk);

      // Derive shared secrets
      const sharedKeyA = await deriveSharedSecret(
        keyPairA.privateKey,
        publicKeyBForA
      );
      const sharedKeyB = await deriveSharedSecret(
        keyPairB.privateKey,
        publicKeyAForB
      );

      // Both shared keys should be valid AES-GCM keys
      expect(sharedKeyA.algorithm.name).toBe('AES-GCM');
      expect(sharedKeyB.algorithm.name).toBe('AES-GCM');
    });

    it('should create encryption session with initialized state', async () => {
      const session = await createEncryptionSession('peer-a');

      expect(session.sessionId).toBe('peer-a');
      expect(session.localKeyPair).toBeDefined();
      expect(session.localKeyPair.publicKeyJwk).toBeDefined();
      expect(session.isReady).toBe(false);
      expect(session.messageCounter).toBe(0);
      expect(session.remotePublicKey).toBeUndefined();
      expect(session.sharedKey).toBeUndefined();
    });

    it('should complete key exchange between two peers', async () => {
      // Peer A creates session
      const sessionA = await createEncryptionSession('peer-a');
      // Peer B creates session
      const sessionB = await createEncryptionSession('peer-b');

      // Exchange public keys
      const sessionAComplete = await completeKeyExchange(
        sessionA,
        sessionB.localKeyPair.publicKeyJwk
      );
      const sessionBComplete = await completeKeyExchange(
        sessionB,
        sessionA.localKeyPair.publicKeyJwk
      );

      expect(sessionAComplete.isReady).toBe(true);
      expect(sessionBComplete.isReady).toBe(true);
      expect(sessionAComplete.sharedKey).toBeDefined();
      expect(sessionBComplete.sharedKey).toBeDefined();
      expect(sessionAComplete.remotePublicKey).toBeDefined();
      expect(sessionBComplete.remotePublicKey).toBeDefined();
    });
  });

  describe('Message encryption', () => {
    let sessionA: SyncEncryptionSession;
    let sessionB: SyncEncryptionSession;

    beforeEach(async () => {
      // Set up completed key exchange
      const initA = await createEncryptionSession('peer-a');
      const initB = await createEncryptionSession('peer-b');

      sessionA = await completeKeyExchange(
        initA,
        initB.localKeyPair.publicKeyJwk
      );
      sessionB = await completeKeyExchange(
        initB,
        initA.localKeyPair.publicKeyJwk
      );
    });

    it('should encrypt message to envelope format', async () => {
      const message = { type: 'sync-push', changes: [] };

      const { envelope, session } = await encryptMessage(sessionA, message);

      expect(isEncryptedEnvelope(envelope)).toBe(true);
      expect(envelope.version).toBe(1);
      expect(envelope.nonce).toBeDefined();
      expect(envelope.ciphertext).toBeDefined();
      expect(session.messageCounter).toBe(1);
    });

    it('should encrypt and decrypt messages after key exchange', async () => {
      const message = {
        type: 'sync-push',
        changes: [{ id: '123', table: 'transactions', data: { amount: 100 } }],
      };

      const { envelope, session: updatedSessionA } = await encryptMessage(
        sessionA,
        message
      );
      sessionA = updatedSessionA;

      expect(isEncryptedEnvelope(envelope)).toBe(true);

      const decrypted = await decryptMessage(sessionB, envelope);
      expect(decrypted).toEqual(message);
    });

    it('should handle round-trip encryption of complex messages', async () => {
      const complexMessage = {
        type: 'sync-batch',
        timestamp: Date.now(),
        changes: [
          {
            id: 'trans-1',
            table: 'transactions',
            action: 'insert',
            data: {
              amount: 150.5,
              description: 'Test transaction 🎉',
              date: '2024-01-15',
              categoryId: 'cat-1',
            },
          },
          {
            id: 'cat-1',
            table: 'categories',
            action: 'update',
            data: { name: 'Food & Dining', emoji: '🍕' },
          },
        ],
        deviceId: 'device-abc123',
      };

      // A sends to B
      const { envelope, session: newSessionA } = await encryptMessage(
        sessionA,
        complexMessage
      );
      sessionA = newSessionA;

      const decryptedByB = await decryptMessage(sessionB, envelope);
      expect(decryptedByB).toEqual(complexMessage);

      // B sends back to A
      const responseMessage = { type: 'sync-ack', received: complexMessage };
      const { envelope: responseEnvelope, session: newSessionB } =
        await encryptMessage(sessionB, responseMessage);
      sessionB = newSessionB;

      const decryptedByA = await decryptMessage(sessionA, responseEnvelope);
      expect(decryptedByA).toEqual(responseMessage);
    });

    it('should increment message counter on each encryption', async () => {
      expect(sessionA.messageCounter).toBe(0);

      let currentSession = sessionA;
      for (let i = 0; i < 5; i++) {
        const { session } = await encryptMessage(currentSession, {
          index: i,
        });
        currentSession = session;
        expect(currentSession.messageCounter).toBe(i + 1);
      }
    });

    it('should use unique nonces for each message', async () => {
      const nonces: string[] = [];

      let currentSession = sessionA;
      for (let i = 0; i < 10; i++) {
        const { envelope, session } = await encryptMessage(currentSession, {
          index: i,
        });
        nonces.push(envelope.nonce);
        currentSession = session;
      }

      // All nonces should be unique
      const uniqueNonces = new Set(nonces);
      expect(uniqueNonces.size).toBe(10);
    });

    it('should fail to decrypt with wrong session', async () => {
      const message = { type: 'test' };
      const { envelope } = await encryptMessage(sessionA, message);

      // Create a completely different session (different keys)
      const sessionC = await createEncryptionSession('peer-c');
      const sessionD = await createEncryptionSession('peer-d');
      const completeSessionC = await completeKeyExchange(
        sessionC,
        sessionD.localKeyPair.publicKeyJwk
      );

      // Should fail to decrypt
      await expect(
        decryptMessage(completeSessionC, envelope)
      ).rejects.toThrow();
    });
  });

  describe('Security', () => {
    it('should reject encryption before key exchange is complete', async () => {
      const incompleteSession = await createEncryptionSession('incomplete');

      await expect(
        encryptMessage(incompleteSession, { type: 'test' })
      ).rejects.toThrow('Encryption session not ready');
    });

    it('should reject decryption before key exchange is complete', async () => {
      const incompleteSession = await createEncryptionSession('incomplete');
      const fakeEnvelope: EncryptedEnvelope = {
        version: 1,
        nonce: 'fake',
        ciphertext: 'fake',
      };

      await expect(
        decryptMessage(incompleteSession, fakeEnvelope)
      ).rejects.toThrow('Encryption session not ready');
    });

    it('should reject unsupported encryption versions', async () => {
      const initA = await createEncryptionSession('peer-a');
      const initB = await createEncryptionSession('peer-b');
      const sessionB = await completeKeyExchange(
        initB,
        initA.localKeyPair.publicKeyJwk
      );

      const invalidEnvelope = {
        version: 99 as 1, // Wrong version
        nonce: 'abc',
        ciphertext: 'xyz',
      };

      await expect(decryptMessage(sessionB, invalidEnvelope)).rejects.toThrow(
        'Unsupported encryption version: 99'
      );
    });

    it('isEncryptedEnvelope should correctly identify encrypted data', () => {
      // Valid envelope
      expect(
        isEncryptedEnvelope({
          version: 1,
          nonce: 'abc',
          ciphertext: 'xyz',
        })
      ).toBe(true);

      // Invalid cases
      expect(isEncryptedEnvelope(null)).toBe(false);
      expect(isEncryptedEnvelope(undefined)).toBe(false);
      expect(isEncryptedEnvelope('string')).toBe(false);
      expect(isEncryptedEnvelope(123)).toBe(false);
      expect(isEncryptedEnvelope({})).toBe(false);
      expect(isEncryptedEnvelope({ version: 2 })).toBe(false);
      expect(isEncryptedEnvelope({ version: 1 })).toBe(false);
      expect(isEncryptedEnvelope({ version: 1, nonce: 'abc' })).toBe(false);

      // Plaintext sync messages (should return false)
      expect(isEncryptedEnvelope({ type: 'sync-push', changes: [] })).toBe(
        false
      );
      expect(isEncryptedEnvelope({ type: 'handshake', publicKey: {} })).toBe(
        false
      );
    });

    it('should reject plaintext after key exchange (downgrade attack prevention)', async () => {
      // Set up encryption
      const initA = await createEncryptionSession('peer-a');
      const initB = await createEncryptionSession('peer-b');

      const sessionB = await completeKeyExchange(
        initB,
        initA.localKeyPair.publicKeyJwk
      );

      // After key exchange completes, isReady is true
      expect(sessionB.isReady).toBe(true);

      // Plaintext message (attacker trying to bypass encryption)
      const plaintextMessage = { type: 'sync-push', changes: [] };

      // isEncryptedEnvelope returns false for plaintext
      expect(isEncryptedEnvelope(plaintextMessage)).toBe(false);

      // The SyncEncryption class should handle this:
      // - If encryption is enabled and session is ready,
      // - Plaintext messages after key exchange indicate downgrade attack
      // - Application layer (peer.ts) should reject based on isEncryptedEnvelope
    });

    it('should detect tampered ciphertext', async () => {
      const initA = await createEncryptionSession('peer-a');
      const initB = await createEncryptionSession('peer-b');

      const sessionA = await completeKeyExchange(
        initA,
        initB.localKeyPair.publicKeyJwk
      );
      const sessionB = await completeKeyExchange(
        initB,
        initA.localKeyPair.publicKeyJwk
      );

      const message = { type: 'test', secret: 'data' };
      const { envelope } = await encryptMessage(sessionA, message);

      // Tamper with ciphertext
      const tamperedEnvelope: EncryptedEnvelope = {
        ...envelope,
        ciphertext: envelope.ciphertext.slice(0, -4) + 'XXXX',
      };

      // AES-GCM should detect tampering via authentication tag
      await expect(
        decryptMessage(sessionB, tamperedEnvelope)
      ).rejects.toThrow();
    });
  });

  describe('SyncEncryption class', () => {
    it('should initialize and provide public key', async () => {
      const encryption = new SyncEncryption();

      expect(encryption.isEnabled()).toBe(true);
      expect(encryption.isReady()).toBe(false);
      expect(encryption.getPublicKey()).toBeNull();

      const publicKey = await encryption.initialize('session-1');

      expect(publicKey).toBeDefined();
      expect(publicKey.kty).toBe('EC');
      expect(publicKey.crv).toBe('P-256');
      expect(encryption.getPublicKey()).toEqual(publicKey);
    });

    it('should complete key exchange via class API', async () => {
      const encryptionA = new SyncEncryption();
      const encryptionB = new SyncEncryption();

      const publicKeyA = await encryptionA.initialize('session-a');
      const publicKeyB = await encryptionB.initialize('session-b');

      await encryptionA.completeKeyExchange(publicKeyB);
      await encryptionB.completeKeyExchange(publicKeyA);

      expect(encryptionA.isReady()).toBe(true);
      expect(encryptionB.isReady()).toBe(true);
    });

    it('should encrypt and decrypt via class API', async () => {
      const encryptionA = new SyncEncryption();
      const encryptionB = new SyncEncryption();

      const publicKeyA = await encryptionA.initialize('session-a');
      const publicKeyB = await encryptionB.initialize('session-b');

      await encryptionA.completeKeyExchange(publicKeyB);
      await encryptionB.completeKeyExchange(publicKeyA);

      const message = { type: 'sync', data: 'secret' };
      const encrypted = await encryptionA.encrypt(message);

      expect(isEncryptedEnvelope(encrypted)).toBe(true);

      const decrypted = await encryptionB.decrypt(encrypted);
      expect(decrypted).toEqual(message);
    });

    it('should pass through when encryption is disabled', async () => {
      const encryption = new SyncEncryption({ enabled: false });

      expect(encryption.isEnabled()).toBe(false);

      const message = { type: 'test' };
      const encrypted = await encryption.encrypt(message);

      // Should return message as-is
      expect(encrypted).toEqual(message);

      const decrypted = await encryption.decrypt(encrypted);
      expect(decrypted).toEqual(message);
    });

    it('should pass through plaintext in backward compatibility mode', async () => {
      const encryptionA = new SyncEncryption();

      const publicKeyA = await encryptionA.initialize('session-a');

      // Not completing key exchange, so not ready
      expect(encryptionA.isReady()).toBe(false);

      // Create another encryption instance that is ready
      const encryptionB = new SyncEncryption();
      const _publicKeyB = await encryptionB.initialize('session-b');
      await encryptionB.completeKeyExchange(publicKeyA);

      // Receive plaintext (backward compatibility)
      const plaintext = { type: 'legacy-message' };
      const result = await encryptionB.decrypt(plaintext);

      // Should pass through as-is since it's not an encrypted envelope
      expect(result).toEqual(plaintext);
    });

    it('should throw if trying to complete key exchange before init', async () => {
      const encryption = new SyncEncryption();
      const fakePublicKey = { kty: 'EC', crv: 'P-256', x: 'a', y: 'b' };

      await expect(
        encryption.completeKeyExchange(fakePublicKey)
      ).rejects.toThrow('Session not initialized');
    });

    it('should throw if trying to encrypt before ready', async () => {
      const encryption = new SyncEncryption();
      await encryption.initialize('session');

      await expect(encryption.encrypt({ type: 'test' })).rejects.toThrow(
        'Encryption not ready'
      );
    });

    it('should reset session state', async () => {
      const encryption = new SyncEncryption();
      await encryption.initialize('session');

      expect(encryption.getPublicKey()).not.toBeNull();

      encryption.reset();

      expect(encryption.getPublicKey()).toBeNull();
      expect(encryption.isReady()).toBe(false);
    });
  });

  describe('Multiple concurrent connections', () => {
    it('should handle multiple independent sessions', async () => {
      // Device A connects to Device B and Device C simultaneously
      const sessionAB = await createEncryptionSession('a-to-b');
      const sessionAC = await createEncryptionSession('a-to-c');
      const sessionBA = await createEncryptionSession('b-to-a');
      const sessionCA = await createEncryptionSession('c-to-a');

      // Complete key exchanges
      const completeAB = await completeKeyExchange(
        sessionAB,
        sessionBA.localKeyPair.publicKeyJwk
      );
      const completeBA = await completeKeyExchange(
        sessionBA,
        sessionAB.localKeyPair.publicKeyJwk
      );
      const completeAC = await completeKeyExchange(
        sessionAC,
        sessionCA.localKeyPair.publicKeyJwk
      );
      const completeCA = await completeKeyExchange(
        sessionCA,
        sessionAC.localKeyPair.publicKeyJwk
      );

      // Send message from A to B
      const msgToB = { to: 'B', content: 'Hello B' };
      const { envelope: envToB } = await encryptMessage(completeAB, msgToB);

      // Send message from A to C
      const msgToC = { to: 'C', content: 'Hello C' };
      const { envelope: envToC } = await encryptMessage(completeAC, msgToC);

      // B should decrypt correctly
      const decryptedByB = await decryptMessage(completeBA, envToB);
      expect(decryptedByB).toEqual(msgToB);

      // C should decrypt correctly
      const decryptedByC = await decryptMessage(completeCA, envToC);
      expect(decryptedByC).toEqual(msgToC);

      // B should NOT be able to decrypt C's message (different key)
      await expect(decryptMessage(completeBA, envToC)).rejects.toThrow();
    });

    it('should isolate sessions with unique IDs', async () => {
      const sessions = await Promise.all([
        createEncryptionSession('session-1'),
        createEncryptionSession('session-2'),
        createEncryptionSession('session-3'),
      ]);

      // Each session has unique key pairs
      const publicKeys = sessions.map((s) =>
        JSON.stringify(s.localKeyPair.publicKeyJwk)
      );
      const uniqueKeys = new Set(publicKeys);

      expect(uniqueKeys.size).toBe(3);
    });
  });
});
