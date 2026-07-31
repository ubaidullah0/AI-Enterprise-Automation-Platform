/**
 * encryption.service.ts
 *
 * AES-256-GCM symmetric encryption/decryption for OrganizationApiKey storage.
 *
 * Format of ciphertext stored in DB:
 *   <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * The ENCRYPTION_KEY env var must be a 64-character hex string (= 32 bytes).
 * Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Security guarantees:
 * - Each encrypt() call uses a fresh random 12-byte IV.
 * - GCM auth tag (16 bytes) prevents tampering without detection.
 * - ENCRYPTION_KEY is never logged or returned in responses.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12;       // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

// ── Load and validate ENCRYPTION_KEY at module initialisation ────────────────
function loadEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[EncryptionService] ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (raw.length !== 64) {
    throw new Error(
      `[EncryptionService] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${raw.length} characters.`
    );
  }
  return Buffer.from(raw, 'hex');
}

// Validate once at startup — fail fast if misconfigured
const KEY = loadEncryptionKey();

// ── Encryption ───────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a composite string: `<iv>:<authTag>:<ciphertext>` (all hex-encoded).
 * Never throws for valid input; may throw for system-level errors.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

// ── Decryption ───────────────────────────────────────────────────────────────

/**
 * Decrypts a ciphertext string produced by `encrypt()`.
 * Returns the original plaintext.
 * Throws if the ciphertext is malformed or authentication fails (tamper detection).
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('[EncryptionService] Invalid ciphertext format. Expected iv:authTag:data');
  }

  const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// ── Key masking (for display only) ───────────────────────────────────────────

/**
 * Returns the last `n` characters of a key for display.
 * Used to populate the `keyHint` field.
 * Example: maskKey("sk-abc123xyz", 4) => "...1xyz"
 */
export function buildKeyHint(plainKey: string, lastChars = 4): string {
  if (plainKey.length <= lastChars) return '...****';
  return `...${plainKey.slice(-lastChars)}`;
}
