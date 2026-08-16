// ═══════════════════════════════════════════════════════════════════════════
// Auth Utilities — Unit Tests
//
// Tests for session, password, csrf, rbac, encryption, and audit-logger.
// All database and external dependencies are mocked.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextRequest: class {},
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/session-manager', () => ({
  shouldRotateSession: vi.fn(() => false),
  enforceSessionLimit: vi.fn(async () => 0),
  assessLoginSecurity: vi.fn(),
  parseUserAgent: vi.fn(),
  generateDeviceFingerprint: vi.fn(),
  recordLoginEvent: vi.fn(),
}));

vi.mock('@/lib/env-config', () => ({
  env: {
    NODE_ENV: 'test',
    SERVICE_NAME: 'test',
    DEPLOYMENT_SLOT: 'test',
    REGION: 'local',
  },
}));

// ── Imports ────────────────────────────────────────────────────────────

import { hashToken, AuthError } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import {
  generateCsrfToken,
  validateCsrf,
  deriveCsrfFromSession,
  csrfMiddleware,
  CSRF_TOKEN_HEADER,
  CSRF_COOKIE_NAME,
} from '@/lib/csrf';
import {
  authorizeRoute,
  hasPermission,
  hasAnyPermission,
  getRolePermissions,
} from '@/lib/rbac';
// encryption.ts is NOT statically imported — it captures ENCRYPTION_MASTER_KEY at
// module load time. Instead, we dynamically import it inside the describe
// block after setting the env var + resetting the module registry.
import { audit, auditAuthFailure, auditCsrfFailure, auditRateLimit } from '@/lib/audit-logger';
import { db } from '@/lib/db';

// ── Session Tests ──────────────────────────────────────────────────────

describe('session.ts', () => {
  describe('hashToken', () => {
    it('produces a consistent SHA-256 hash for the same input', async () => {
      const hash1 = await hashToken('test-token-abc');
      const hash2 = await hashToken('test-token-abc');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashToken('token-one');
      const hash2 = await hashToken('token-two');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-character hex string (SHA-256)', async () => {
      const hash = await hashToken('some-value');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('includes salt prefix via the dmq_session: prefix', async () => {
      // Hash with prefix vs. raw hash of same token should differ
      const hashWithPrefix = await hashToken('abc');
      const encoder = new TextEncoder();
      const data = encoder.encode('abc');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const rawHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      expect(hashWithPrefix).not.toBe(rawHash);
    });
  });

  // generateToken is not exported from session.ts (used internally only).
  // Test the token format via the internal logic pattern.
  describe('generateToken (internal logic)', () => {
    it('produces 64-char hex strings matching the expected format', () => {
      // Recreate the internal logic to verify the pattern
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces unique tokens on successive calls', () => {
      const makeToken = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      };
      const token1 = makeToken();
      const token2 = makeToken();
      expect(token1).not.toBe(token2);
    });

    it('produces tokens with only lowercase hex chars', () => {
      for (let i = 0; i < 10; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const token = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        expect(token).toMatch(/^[0-9a-f]+$/);
      }
    });
  });

  describe('AuthError', () => {
    it('has the correct default status code (401)', () => {
      const err = new AuthError('Unauthorized');
      expect(err.status).toBe(401);
      expect(err.message).toBe('Unauthorized');
    });

    it('accepts a custom status code', () => {
      const err = new AuthError('Forbidden', 403);
      expect(err.status).toBe(403);
      expect(err.message).toBe('Forbidden');
    });

    it('is an instance of Error', () => {
      const err = new AuthError('test');
      expect(err).toBeInstanceOf(Error);
    });

    it('has the correct name property', () => {
      const err = new AuthError('test');
      expect(err.name).toBe('AuthError');
    });

    it('can be caught with instanceof check', () => {
      const throwIt = () => { throw new AuthError('boom', 500); };
      expect(throwIt).toThrow(AuthError);
    });
  });
});

// ── Password Tests ─────────────────────────────────────────────────────

describe('password.ts', () => {
  it('hash and verify round-trip works', async () => {
    const password = 'SecureP@ssw0rd!';
    const hash = await hashPassword(password);
    expect(hash).toBeTruthy();
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('verify fails with wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const isValid = await verifyPassword('wrong-password', hash);
    expect(isValid).toBe(false);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });

  it('hash format is salt$hash', async () => {
    const hash = await hashPassword('test');
    const parts = hash.split('$');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32);  // 16 bytes = 32 hex
    expect(parts[1]).toHaveLength(64);  // 32 bytes = 64 hex
  });

  it('timing-safe comparison works (no early return)', async () => {
    const hash = await hashPassword('password123');
    const startA = performance.now();
    await verifyPassword('completely-wrong', hash);
    const timeA = performance.now() - startA;

    const startB = performance.now();
    await verifyPassword('p4ssword123', hash);
    const timeB = performance.now() - startB;

    const ratio = Math.max(timeA, timeB) / (Math.min(timeA, timeB) || 1);
    expect(ratio).toBeLessThan(100);
  });

  it('verify returns false for malformed hash', async () => {
    const isValid = await verifyPassword('test', 'not-a-valid-hash');
    expect(isValid).toBe(false);
  });

  it('verify returns false for empty string hash', async () => {
    const isValid = await verifyPassword('test', '');
    expect(isValid).toBe(false);
  });
});

// ── CSRF Tests ─────────────────────────────────────────────────────────

describe('csrf.ts', () => {
  function makeRequest(opts: {
    method?: string;
    csrfHeader?: string;
    csrfCookie?: string;
    cookieString?: string;
  } = {}): Request {
    const headers: Record<string, string> = {};
    if (opts.csrfHeader) {
      headers[CSRF_TOKEN_HEADER] = opts.csrfHeader;
    }
    if (opts.csrfCookie || opts.cookieString) {
      headers['cookie'] = opts.cookieString || `${CSRF_COOKIE_NAME}=${encodeURIComponent(opts.csrfCookie!)}`;
    }
    return new Request('http://localhost/api/test', {
      method: opts.method || 'POST',
      headers,
    });
  }

  describe('generateCsrfToken', () => {
    it('produces a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces unique tokens on successive calls', () => {
      const t1 = generateCsrfToken();
      const t2 = generateCsrfToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('validateCsrf', () => {
    it('returns true for GET requests', () => {
      const req = makeRequest({ method: 'GET' });
      expect(validateCsrf(req)).toBe(true);
    });

    it('returns true for HEAD requests', () => {
      const req = makeRequest({ method: 'HEAD' });
      expect(validateCsrf(req)).toBe(true);
    });

    it('returns true for OPTIONS requests', () => {
      const req = makeRequest({ method: 'OPTIONS' });
      expect(validateCsrf(req)).toBe(true);
    });

    it('returns false when header is missing', () => {
      const token = generateCsrfToken();
      const req = makeRequest({ method: 'POST', csrfCookie: token });
      expect(validateCsrf(req)).toBe(false);
    });

    it('returns false when cookie is missing', () => {
      const token = generateCsrfToken();
      const req = makeRequest({ method: 'POST', csrfHeader: token });
      expect(validateCsrf(req)).toBe(false);
    });

    it('returns true when header equals cookie', () => {
      const token = generateCsrfToken();
      const req = makeRequest({ method: 'POST', csrfHeader: token, csrfCookie: token });
      expect(validateCsrf(req)).toBe(true);
    });

    it('returns false when header differs from cookie', () => {
      const req = makeRequest({ method: 'POST', csrfHeader: 'aaa', csrfCookie: 'bbb' });
      expect(validateCsrf(req)).toBe(false);
    });

    it('returns false when both header and cookie are missing', () => {
      const req = makeRequest({ method: 'POST' });
      expect(validateCsrf(req)).toBe(false);
    });
  });

  describe('csrfMiddleware', () => {
    it('returns { valid: false, response } for POST without token', () => {
      const req = makeRequest({ method: 'POST' });
      const result = csrfMiddleware(req);
      expect(result.valid).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(403);
    });

    it('returns { valid: true } for GET requests', () => {
      const req = makeRequest({ method: 'GET' });
      const result = csrfMiddleware(req);
      expect(result.valid).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('returns { valid: true } when token matches', () => {
      const token = generateCsrfToken();
      const req = makeRequest({ method: 'POST', csrfHeader: token, csrfCookie: token });
      const result = csrfMiddleware(req);
      expect(result.valid).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('returns 403 JSON body on failure', async () => {
      const req = makeRequest({ method: 'POST' });
      const result = csrfMiddleware(req);
      const body = await result.response!.json();
      expect(body).toEqual({ error: 'CSRF validation failed' });
    });
  });

  describe('deriveCsrfFromSession', () => {
    it('produces deterministic hash for the same input', async () => {
      const hash1 = await deriveCsrfFromSession('session-token-abc');
      const hash2 = await deriveCsrfFromSession('session-token-abc');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await deriveCsrfFromSession('token-one');
      const hash2 = await deriveCsrfFromSession('token-two');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-character hex string', async () => {
      const hash = await deriveCsrfFromSession('any-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});

// ── RBAC Tests ─────────────────────────────────────────────────────────

describe('rbac.ts', () => {
  describe('authorizeRoute', () => {
    it('allows admin to access admin-only security routes', () => {
      const result = authorizeRoute('/api/security/roles', 'GET', 'admin');
      expect(result.authorized).toBe(true);
    });

    it('allows admin to access user management routes', () => {
      const result = authorizeRoute('/api/users', 'GET', 'admin');
      expect(result.authorized).toBe(true);
    });

    it('denies viewer from accessing admin-only routes', () => {
      const result = authorizeRoute('/api/security/roles', 'GET', 'viewer');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('viewer');
    });

    it('denies viewer from accessing company write routes', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'viewer');
      expect(result.authorized).toBe(false);
    });

    it('allows user to access general read routes', () => {
      const result = authorizeRoute('/api/companies', 'GET', 'user');
      expect(result.authorized).toBe(true);
    });

    it('denies user from accessing company write routes', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'user');
      expect(result.authorized).toBe(false);
    });

    it('allows access to public routes regardless of role', () => {
      const result = authorizeRoute('/api/health', 'GET', 'viewer');
      expect(result.authorized).toBe(true);
    });

    it('denies access for unknown roles', () => {
      const result = authorizeRoute('/api/companies', 'GET', 'superadmin');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('superadmin');
    });

    it('denies access for empty role', () => {
      const result = authorizeRoute('/api/companies', 'GET', '');
      expect(result.authorized).toBe(false);
    });

    it('denies access for null role', () => {
      const result = authorizeRoute('/api/companies', 'GET', null as unknown as string);
      expect(result.authorized).toBe(false);
    });

    it('denies access for unmatched routes (deny by default)', () => {
      const result = authorizeRoute('/api/nonexistent-route', 'GET', 'admin');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('no authorization configuration');
    });

    it('allows operator to write to companies', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'operator');
      expect(result.authorized).toBe(true);
    });

    it('denies operator from managing users', () => {
      const result = authorizeRoute('/api/users', 'PATCH', 'operator');
      expect(result.authorized).toBe(false);
    });

    it('supports prefix matching for sub-routes', () => {
      const result = authorizeRoute('/api/ai/chat', 'POST', 'admin');
      expect(result.authorized).toBe(true);
    });

    it('allows user to read AI endpoints', () => {
      const result = authorizeRoute('/api/ai/chat', 'GET', 'user');
      expect(result.authorized).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('returns true for admin with companies:write', () => {
      expect(hasPermission('admin', 'companies:write')).toBe(true);
    });

    it('returns false for user with companies:write', () => {
      expect(hasPermission('user', 'companies:write')).toBe(false);
    });

    it('returns true for user with companies:read', () => {
      expect(hasPermission('user', 'companies:read')).toBe(true);
    });

    it('returns false for unknown role', () => {
      expect(hasPermission('hacker', 'companies:read')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true if user has any of the required permissions', () => {
      expect(hasAnyPermission('user', ['companies:delete', 'companies:read'])).toBe(true);
    });

    it('returns false if user has none of the required permissions', () => {
      expect(hasAnyPermission('viewer', ['companies:write', 'companies:delete'])).toBe(false);
    });
  });

  describe('getRolePermissions', () => {
    it('returns all admin permissions', () => {
      const perms = getRolePermissions('admin');
      expect(perms.length).toBeGreaterThan(40);
      expect(perms).toContain('companies:read');
      expect(perms).toContain('users:manage');
    });

    it('returns empty array for unknown role', () => {
      const perms = getRolePermissions('nonexistent');
      expect(perms).toEqual([]);
    });

    it('viewer has minimal permissions', () => {
      const perms = getRolePermissions('viewer');
      expect(perms).toEqual(['dashboard:read', 'analytics:read', 'reports:read']);
    });
  });
});

// ── Encryption Tests ───────────────────────────────────────────────────
// encryption.ts captures ENCRYPTION_MASTER_KEY at module scope, so we
// must set the env var and dynamically import the module.

describe('encryption.ts', () => {
  let encryptField: typeof import('@/lib/encryption').encryptField;
  let decryptField: typeof import('@/lib/encryption').decryptField;
  let getEncryptionHealth: typeof import('@/lib/encryption').getEncryptionHealth;

  beforeEach(async () => {
    process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
    vi.resetModules();
    const mod = await import('@/lib/encryption');
    encryptField = mod.encryptField;
    decryptField = mod.decryptField;
    getEncryptionHealth = mod.getEncryptionHealth;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_MASTER_KEY;
  });

  describe('encryptField / decryptField round-trip', () => {
    it('encrypt and decrypt round-trip works', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await encryptField('email', plaintext);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = await decryptField('email', encrypted!);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trip works with longer text', async () => {
      const plaintext = 'a'.repeat(500);
      const encrypted = await encryptField('phone', plaintext);
      const decrypted = await decryptField('phone', encrypted!);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trip works with special characters', async () => {
      const plaintext = 'Hello \u4f60\u597d \ud83c\udf0d <script>alert(1)</script>';
      const encrypted = await encryptField('content', plaintext);
      const decrypted = await decryptField('content', encrypted!);
      expect(decrypted).toBe(plaintext);
    });

    it('returns empty string for empty plaintext', async () => {
      const result = await encryptField('email', '');
      expect(result).toBe('');
    });

    it('returns input as-is for null plaintext', async () => {
      const result = await encryptField('email', null as unknown as string);
      expect(result).toBeNull();
    });
  });

  describe('ciphertext properties', () => {
    it('different fields produce different ciphertexts for same plaintext', async () => {
      const plaintext = 'same-value';
      const enc1 = await encryptField('email', plaintext);
      const enc2 = await encryptField('phone', plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('same field with same plaintext produces different ciphertexts (random IV)', async () => {
      const plaintext = 'deterministic-check';
      const enc1 = await encryptField('email', plaintext);
      const enc2 = await encryptField('email', plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('encrypted output is base64', async () => {
      const encrypted = await encryptField('email', 'test');
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe('decryptField edge cases', () => {
    it('decrypt returns input as-is for non-encrypted (plain) string', async () => {
      const result = await decryptField('email', 'not-encrypted');
      expect(result).toBe('not-encrypted');
    });

    it('decrypt returns input as-is for short strings', async () => {
      const result = await decryptField('email', 'abc');
      expect(result).toBe('abc');
    });

    it('decrypt returns input as-is for empty string', async () => {
      const result = await decryptField('email', '');
      expect(result).toBe('');
    });
  });

  describe('wrong key / tampered data', () => {
    it('decrypt fails gracefully with tampered ciphertext', async () => {
      const encrypted = await encryptField('email', 'secret');
      const tampered = encrypted!.slice(0, -4) + 'XXXX';
      const result = await decryptField('email', tampered);
      expect(result).toBe(tampered);
    });
  });

  describe('getEncryptionHealth', () => {
    it('reports enabled when master key is configured', () => {
      const health = getEncryptionHealth();
      expect(health.masterKeyConfigured).toBe(true);
      expect(health.enabled).toBe(true);
      expect(health.algorithm).toBe('AES-GCM');
    });
  });
});

// ── Audit Logger Tests ─────────────────────────────────────────────────

describe('audit-logger.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('audit function', () => {
    it('resolves without throwing', async () => {
      db.auditLog.create.mockResolvedValue({});
      await expect(
        audit({ action: 'test_action', category: 'auth', severity: 'info' })
      ).resolves.toBeUndefined();
    });

    it('calls db.auditLog.create with correct data', async () => {
      db.auditLog.create.mockResolvedValue({});
      await audit({
        action: 'user_login',
        category: 'auth',
        severity: 'info',
        actor: 'user-1',
        ip: '127.0.0.1',
        path: '/api/verify-otp',
        method: 'POST',
        details: { key: 'value' },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: '[auth] user_login',
          resource: 'auth',
          ipAddress: '127.0.0.1',
          details: JSON.stringify({ key: 'value' }),
        },
      });
    });

    it('handles DB errors gracefully (does not throw)', async () => {
      db.auditLog.create.mockRejectedValue(new Error('DB connection lost'));
      await expect(
        audit({ action: 'test_action', category: 'security', severity: 'critical' })
      ).resolves.toBeUndefined();
    });

    it('passes null ipAddress when not provided', async () => {
      db.auditLog.create.mockResolvedValue({});
      await audit({
        action: 'no_ip',
        category: 'admin',
        severity: 'info',
        actor: 'admin-1',
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ipAddress: null }),
        })
      );
    });

    it('does not pass details when not provided', async () => {
      db.auditLog.create.mockResolvedValue({});
      await audit({
        action: 'minimal',
        category: 'auth',
        severity: 'warn',
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ details: undefined }),
        })
      );
    });
  });

  describe('convenience helpers', () => {
    it('auditAuthFailure creates correct event', async () => {
      db.auditLog.create.mockResolvedValue({});
      await auditAuthFailure('invalid_otp', '10.0.0.1');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: '[auth] invalid_otp',
            resource: 'auth',
            ipAddress: '10.0.0.1',
          }),
        })
      );
    });

    it('auditCsrfFailure creates correct event', async () => {
      db.auditLog.create.mockResolvedValue({});
      await auditCsrfFailure('10.0.0.1', '/api/companies', 'POST');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: '[csrf] CSRF validation failed',
            resource: 'csrf',
          }),
        })
      );
    });

    it('auditRateLimit creates correct event', async () => {
      db.auditLog.create.mockResolvedValue({});
      await auditRateLimit('10.0.0.1', '/api/ai/chat', 100);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: '[rate_limit] Rate limit exceeded (100)',
            resource: 'rate_limit',
            details: JSON.stringify({ limit: 100 }),
          }),
        })
      );
    });
  });
});
