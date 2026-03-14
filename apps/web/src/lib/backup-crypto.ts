/**
 * Backup Encryption Utilities
 *
 * Provides AES-256-GCM encryption and SHA-256 checksum verification
 * for encrypted Fluxby backup files.
 *
 * Encrypted backup format (.fluxby-encrypted):
 * {
 *   magic: "FLUXBY_ENCRYPTED_BACKUP_V1",
 *   salt: Uint8Array (16 bytes) - for key derivation
 *   nonce: Uint8Array (12 bytes) - for AES-GCM
 *   ciphertext: Uint8Array - encrypted JSON data
 *   checksum: string - SHA-256 of plaintext JSON
 * }
 */

const MAGIC_HEADER = 'FLUXBY_ENCRYPTED_BACKUP_V1';
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedBackup {
  magic: string;
  salt: number[]; // Serialized Uint8Array
  nonce: number[]; // Serialized Uint8Array
  ciphertext: number[]; // Serialized Uint8Array
  checksum: string; // SHA-256 of plaintext JSON
}

export interface PlainBackup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  checksum?: string;
  exportedAt: string;
  version: number;
}

/**
 * Compute SHA-256 checksum of string data
 */
export async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt backup data with password
 * Uses AES-256-GCM for authenticated encryption
 */
export async function encryptBackup(
  data: PlainBackup,
  password: string
): Promise<EncryptedBackup> {
  // Generate random salt and nonce
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

  // Derive encryption key from password
  const key = await deriveKeyFromPassword(password, salt);

  // Serialize and compute checksum of plaintext
  const jsonStr = JSON.stringify(data, null, 2);
  const checksum = await computeChecksum(jsonStr);

  // Encrypt the JSON data
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(jsonStr);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource },
    key,
    plaintextBuffer
  );

  return {
    magic: MAGIC_HEADER,
    salt: Array.from(salt),
    nonce: Array.from(nonce),
    ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
    checksum,
  };
}

/**
 * Decrypt backup data with password
 * Returns the decrypted data or throws error if password is wrong
 */
export async function decryptBackup(
  encryptedBackup: EncryptedBackup,
  password: string
): Promise<PlainBackup> {
  // Verify magic header
  if (encryptedBackup.magic !== MAGIC_HEADER) {
    throw new Error('Invalid encrypted backup format');
  }

  // Convert arrays back to Uint8Arrays
  const salt = new Uint8Array(encryptedBackup.salt);
  const nonce = new Uint8Array(encryptedBackup.nonce);
  const ciphertext = new Uint8Array(encryptedBackup.ciphertext);

  // Derive key from password
  const key = await deriveKeyFromPassword(password, salt);

  // Decrypt
  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Decryption failed - incorrect password');
  }

  // Decode JSON
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(plaintextBuffer);
  const data = JSON.parse(jsonStr) as PlainBackup;

  // Verify checksum
  const computedChecksum = await computeChecksum(jsonStr);
  if (computedChecksum !== encryptedBackup.checksum) {
    throw new Error('Checksum mismatch - backup may be corrupted');
  }

  return data;
}

/**
 * Check if a file is an encrypted Fluxby backup
 */
export function isEncryptedBackup(data: unknown): data is EncryptedBackup {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.magic === MAGIC_HEADER &&
    Array.isArray(obj.salt) &&
    Array.isArray(obj.nonce) &&
    Array.isArray(obj.ciphertext) &&
    typeof obj.checksum === 'string'
  );
}

/**
 * Verify checksum of plain backup data
 * Returns true if checksum matches or no checksum exists (old backups)
 */
export async function verifyBackupChecksum(
  data: PlainBackup
): Promise<{ valid: boolean; hasChecksum: boolean }> {
  if (!data.checksum) {
    return { valid: true, hasChecksum: false };
  }

  // Remove checksum from data before computing
  const { checksum, ...dataWithoutChecksum } = data;
  const jsonStr = JSON.stringify(dataWithoutChecksum, null, 2);
  const computedChecksum = await computeChecksum(jsonStr);

  return {
    valid: computedChecksum === checksum,
    hasChecksum: true,
  };
}

/**
 * Add checksum to backup data
 */
export async function addChecksumToBackup(
  data: PlainBackup
): Promise<PlainBackup> {
  // Remove any existing checksum
  const { checksum: _existing, ...dataWithoutChecksum } = data;
  const jsonStr = JSON.stringify(dataWithoutChecksum, null, 2);
  const newChecksum = await computeChecksum(jsonStr);

  return {
    ...dataWithoutChecksum,
    checksum: newChecksum,
  };
}

/**
 * File extension helpers
 */
export const ENCRYPTED_EXTENSION = '.fluxby-encrypted';
export const PLAIN_EXTENSION = '.json';

export function getBackupFilename(date: Date, encrypted: boolean): string {
  const dateStr = date.toISOString().split('T')[0];
  return `fluxby-export-${dateStr}${encrypted ? ENCRYPTED_EXTENSION : PLAIN_EXTENSION}`;
}
