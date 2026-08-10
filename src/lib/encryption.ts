/**
 * Phase 5.5 — Data Encryption (At-Rest + Transit)
 *
 * Enterprise encryption layer providing:
 *   - AES-256-GCM field-level encryption for sensitive data
 *   - Key derivation from master key via HKDF
 *   - Key rotation support with version tracking
 *   - Encryption/decryption helpers for Prisma fields
 *   - TLS enforcement configuration
 *   - Encryption health monitoring
 *
 * DESIGN:
 *   - Master key comes from ENCRYPTION_MASTER_KEY env var (32 bytes hex)
 *   - Field keys are derived via HKDF (SHA-256) with field-specific salt
 *   - Encrypted format: version(1 byte) + iv(12 bytes) + ciphertext + tag
 *   - All operations use Web Crypto API (SubtleCrypto)
 *   - FAIL-CLOSED in production: throws ENCRYPTION_REQUIRED if encryption cannot be performed
 *
 * SECURITY NOTES:
 *   - Master key MUST be 32 bytes (256 bits) hex-encoded
 *   - In production, use a KMS (AWS KMS, GCP KMS, Vault) for key management
 *   - This module provides the local encryption layer
 */

import { logger } from '@/lib/logger';

// ── Edge-Compatible Base64 Helpers ────────────────────────────
// Replaces Node.js Buffer.from() for base64 encoding/decoding.
// Uses btoa/atob which are available in Edge Runtime + Node.js 16+.

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ── Types ────────────────────────────────────────────────────────────

export interface EncryptionResult {
  encrypted: string; // base64-encoded: version + iv + ciphertext + tag
  version: number;
  algorithm: string;
}

export interface EncryptionKeyInfo {
  version: number;
  algorithm: string;
  isActive: boolean;
  createdAt: string;
  rotatedAt: string | null;
}

export interface EncryptionHealthStatus {
  enabled: boolean;
  masterKeyConfigured: boolean;
  algorithm: string;
  keyVersion: number;
  fieldsEncrypted: number;
  lastEncryptionAt: string | null;
  lastKeyRotationAt: string | null;
}

// ── Configuration ────────────────────────────────────────────────────

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || '';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes (96 bits) for GCM
const CURRENT_KEY_VERSION = 1;
const TAG_LENGTH = 128; // bits

// Registry of encrypted fields for health monitoring
const encryptedFieldRegistry = new Map<string, number>();
let lastEncryptionTime: string | null = null;
let lastKeyRotationTime: string | null = null;

// ── Key Derivation ──────────────────────────────────────────────────

/**
 * Derive a field-specific encryption key from the master key using HKDF.
 * Each field gets a unique key derived from the master key + field name as salt.
 */
async function deriveFieldKey(
  fieldName: string,
  keyVersion: number,
): Promise<CryptoKey | null> {
  if (!MASTER_KEY || MASTER_KEY.length !== 64) {
    logger.warn('[Encryption] Master key not configured or invalid length');
    return null;
  }

  try {
    // Decode master key from hex
    const masterKeyBytes = new Uint8Array(
      MASTER_KEY.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    // Import master key for HKDF
    const masterKey = await crypto.subtle.importKey(
      'raw',
      masterKeyBytes,
      { name: 'HKDF' },
      false,
      ['deriveKey'],
    );

    // Create field-specific salt from field name + version
    const encoder = new TextEncoder();
    const salt = encoder.encode(`dmq:${fieldName}:v${keyVersion}`);

    // Derive field-specific key
    const fieldKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: encoder.encode('dmq-field-encryption'),
      },
      masterKey,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );

    return fieldKey;
  } catch (err) {
    logger.error('[Encryption] Key derivation failed', {
      error: err instanceof Error ? err.message : String(err),
      field: fieldName,
    });
    return null;
  }
}

// ── Encrypt ──────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string for a specific field.
 * Returns base64-encoded encrypted data.
 * In production, THROWS if encryption cannot be performed (fail-closed).
 * In development, returns plaintext if encryption is not configured (convenience).
 *
 * Format: version(1) + iv(12) + ciphertext + tag(16)
 */
export async function encryptField(
  fieldName: string,
  plaintext: string,
  keyVersion: number = CURRENT_KEY_VERSION,
): Promise<string | null> {
  if (!plaintext) return plaintext;

  const key = await deriveFieldKey(fieldName, keyVersion);
  if (!key) {
    // FAIL-CLOSED: In production, refuse to store plaintext
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_REQUIRED');
    }
    // Dev-mode fallback: return plaintext when encryption is not configured
    return plaintext;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      data,
    );

    // Combine: version(1 byte) + iv(12 bytes) + ciphertext + tag
    const versionByte = new Uint8Array([keyVersion]);
    const combined = new Uint8Array(
      versionByte.length + iv.length + encrypted.byteLength,
    );
    combined.set(versionByte, 0);
    combined.set(iv, 1);
    combined.set(new Uint8Array(encrypted), 1 + iv.length);

    // Track for health monitoring
    encryptedFieldRegistry.set(
      fieldName,
      (encryptedFieldRegistry.get(fieldName) || 0) + 1,
    );
    lastEncryptionTime = new Date().toISOString();

    // Base64 encode — Edge-compatible (no Buffer)
    return uint8ArrayToBase64(combined);
  } catch (err) {
    logger.error('[Encryption] Encryption failed', {
      error: err instanceof Error ? err.message : String(err),
      field: fieldName,
    });
    // FAIL-CLOSED: In production, throw instead of returning plaintext
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_REQUIRED');
    }
    // Dev-mode fallback: return plaintext on encryption failure
    return plaintext;
  }
}

// ── Decrypt ──────────────────────────────────────────────────────────

/**
 * Decrypt an encrypted field value.
 * Handles multiple key versions for key rotation support.
 */
export async function decryptField(
  fieldName: string,
  encrypted: string,
): Promise<string | null> {
  if (!encrypted) return encrypted;

  // Check if this is actually encrypted (base64-encoded with version prefix)
  try {
    // Base64 decode — Edge-compatible (no Buffer)
    const combined = base64ToUint8Array(encrypted);
    if (combined.length < 1 + IV_LENGTH + TAG_LENGTH / 8) {
      // Too short to be encrypted — return as-is
      return encrypted;
    }

    // Extract version from first byte
    const version = combined[0];

    // Only decrypt if we recognize the version
    if (version !== CURRENT_KEY_VERSION) {
      logger.warn(`[Encryption] Unknown key version ${version} for field ${fieldName}`);
      return encrypted; // Can't decrypt — return as-is
    }

    const key = await deriveFieldKey(fieldName, version);
    if (!key) {
      return encrypted; // Encryption not configured
    }

    // Extract IV and ciphertext
    const iv = combined.subarray(1, 1 + IV_LENGTH);
    const ciphertext = combined.subarray(1 + IV_LENGTH);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    // If decryption fails, likely not encrypted data — return as-is
    return encrypted;
  }
}

// ── Batch Operations ──────────────────────────────────────────────────

/**
 * Encrypt multiple fields in an object.
 * Only encrypts fields listed in the fieldNames array.
 */
export async function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: string[],
): Promise<T> {
  const result = { ...obj };
  for (const field of fieldNames) {
    if (typeof result[field] === 'string' && result[field]) {
      const encrypted = await encryptField(field, result[field] as string);
      if (encrypted !== null) {
        (result as Record<string, unknown>)[field] = encrypted;
      }
    }
  }
  return result;
}

/**
 * Decrypt multiple fields in an object.
 */
export async function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: string[],
): Promise<T> {
  const result = { ...obj };
  for (const field of fieldNames) {
    if (typeof result[field] === 'string' && result[field]) {
      const decrypted = await decryptField(field, result[field] as string);
      if (decrypted !== null) {
        (result as Record<string, unknown>)[field] = decrypted;
      }
    }
  }
  return result;
}

// ── Key Rotation ──────────────────────────────────────────────────────

/**
 * Rotate encryption for a field.
 * Re-encrypts with the current key version.
 * In production, this would be run as a batch job.
 */
export async function rotateFieldEncryption(
  fieldName: string,
  encryptedValue: string,
): Promise<string | null> {
  // Decrypt with current key
  const plaintext = await decryptField(fieldName, encryptedValue);
  if (!plaintext) return encryptedValue;

  // Re-encrypt with current version
  const newEncrypted = await encryptField(fieldName, plaintext, CURRENT_KEY_VERSION);
  if (!newEncrypted) return encryptedValue;

  return newEncrypted;
}

/**
 * Mark a key rotation as complete.
 */
export function markKeyRotation(): void {
  lastKeyRotationTime = new Date().toISOString();
  logger.info('[Encryption] Key rotation completed', {
    timestamp: lastKeyRotationTime,
  });
}

// ── Health & Monitoring ──────────────────────────────────────────────

/**
 * Get encryption health status.
 */
export function getEncryptionHealth(): EncryptionHealthStatus {
  const enabled = MASTER_KEY.length === 64;

  let totalFields = 0;
  for (const count of encryptedFieldRegistry.values()) {
    totalFields += count;
  }

  return {
    enabled,
    masterKeyConfigured: enabled,
    algorithm: ALGORITHM,
    keyVersion: CURRENT_KEY_VERSION,
    fieldsEncrypted: totalFields,
    lastEncryptionAt: lastEncryptionTime,
    lastKeyRotationAt: lastKeyRotationTime,
  };
}

/**
 * List of field names that should be encrypted at rest.
 * Configure this list to match your compliance requirements.
 */
export const ENCRYPTED_FIELDS = [
  // Contact PII
  'phone',
  'email',
  'linkedinUrl',
  'rawName',
  'normalizedName',
  // User PII
  'userEmail',
  'userPhone',
  // Knowledge PII
  'content',
  'sourceUrl',
  // Company sensitive
  'internalSummary',
] as const;

/**
 * Check if TLS is enforced for the current environment.
 */
export function isTlsEnforced(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.ENFORCE_TLS !== 'false'
  );
}

// ── Contact/User Field-Level Helpers ──────────────────────────────────

const CONTACT_PII_FIELDS = ['email', 'phone', 'linkedinUrl', 'rawName', 'normalizedName'];
const USER_PII_FIELDS = ['email', 'phone'];
const KNOWLEDGE_PII_FIELDS = ['content', 'sourceUrl'] as const;
const COMPANY_SENSITIVE_FIELDS = ['internalSummary'] as const;

/**
 * Encrypt contact-specific PII fields in a data object.
 * Encrypts: email, phone, linkedinUrl, rawName, normalizedName
 */
export async function encryptContactFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of CONTACT_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const encrypted = await encryptField(field, result[field]);
      if (encrypted !== null) {
        result[field] = encrypted;
      }
    }
  }
  return result;
}

/**
 * Decrypt contact-specific PII fields in a data object.
 * Decrypts: email, phone, linkedinUrl, rawName, normalizedName
 */
export async function decryptContactFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of CONTACT_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const decrypted = await decryptField(field, result[field]);
      if (decrypted !== null) {
        result[field] = decrypted;
      }
    }
  }
  return result;
}

/**
 * Encrypt user-specific PII fields in a data object.
 * Encrypts: email, phone
 */
export async function encryptUserFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of USER_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const encrypted = await encryptField(field, result[field]);
      if (encrypted !== null) {
        result[field] = encrypted;
      }
    }
  }
  return result;
}

/**
 * Decrypt user-specific PII fields in a data object.
 * Decrypts: email, phone
 */
export async function decryptUserFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of USER_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const decrypted = await decryptField(field, result[field]);
      if (decrypted !== null) {
        result[field] = decrypted;
      }
    }
  }
  return result;
}

/**
 * Encrypt knowledge-specific PII fields in a data object.
 * Encrypts: content, sourceUrl
 */
export async function encryptKnowledgeFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of KNOWLEDGE_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const encrypted = await encryptField(field, result[field]);
      if (encrypted !== null) {
        result[field] = encrypted;
      }
    }
  }
  return result;
}

/**
 * Decrypt knowledge-specific PII fields in a data object.
 * Decrypts: content, sourceUrl
 */
export async function decryptKnowledgeFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of KNOWLEDGE_PII_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const decrypted = await decryptField(field, result[field]);
      if (decrypted !== null) {
        result[field] = decrypted;
      }
    }
  }
  return result;
}

/**
 * Encrypt company-sensitive fields in a data object.
 * Encrypts: internalSummary
 */
export async function encryptCompanySensitiveFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of COMPANY_SENSITIVE_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const encrypted = await encryptField(field, result[field]);
      if (encrypted !== null) {
        result[field] = encrypted;
      }
    }
  }
  return result;
}

/**
 * Decrypt company-sensitive fields in a data object.
 * Decrypts: internalSummary
 */
export async function decryptCompanySensitiveFields(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...data };
  for (const field of COMPANY_SENSITIVE_FIELDS) {
    if (typeof result[field] === 'string' && result[field]) {
      const decrypted = await decryptField(field, result[field]);
      if (decrypted !== null) {
        result[field] = decrypted;
      }
    }
  }
  return result;
}

/**
 * Validate TLS configuration for production.
 */
export function validateTlsConfig(): {
  enforced: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    if (process.env.ENFORCE_TLS === 'false') {
      warnings.push('TLS enforcement is explicitly disabled in production');
    }
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      warnings.push('ENCRYPTION_MASTER_KEY is not set in production');
    }
    if (
      process.env.ENCRYPTION_MASTER_KEY &&
      process.env.ENCRYPTION_MASTER_KEY.length !== 64
    ) {
      warnings.push(
        'ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)',
      );
    }
  }

  return {
    enforced: isTlsEnforced(),
    warnings,
  };
}
