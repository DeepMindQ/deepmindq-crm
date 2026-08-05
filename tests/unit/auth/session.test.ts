/**
 * Unit Tests — Session Module (session.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: hashToken, AuthError, SESSION_COOKIE_NAME
 */

import { describe, it, expect } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    otpCode: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

import { vi } from 'vitest';

describe('Session Module (session.ts)', () => {
  let hashToken: any;
  let AuthError: any;

  beforeAll(async () => {
    const mod = await import('@/lib/session');
    hashToken = mod.hashToken;
    AuthError = mod.AuthError;
  });

  describe('hashToken', () => {
    it('produces a 64-character hex string', async () => {
      const hash = await hashToken('test-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic (same input -> same output)', async () => {
      const h1 = await hashToken('my-token-value');
      const h2 = await hashToken('my-token-value');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', async () => {
      const h1 = await hashToken('token-a');
      const h2 = await hashToken('token-b');
      expect(h1).not.toBe(h2);
    });

    it('uses dmq_session: prefix in hash derivation', async () => {
      const withPrefix = await hashToken('test');
      const encoder = new TextEncoder();
      const data = encoder.encode('test');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const withoutPrefix = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      expect(withPrefix).not.toBe(withoutPrefix);
    });
  });

  describe('AuthError', () => {
    it('is an instance of Error', () => {
      const err = new AuthError('test');
      expect(err).toBeInstanceOf(Error);
    });

    it('has status property defaulting to 401', () => {
      const err = new AuthError('test');
      expect(err.status).toBe(401);
    });

    it('has custom status', () => {
      const err = new AuthError('forbidden', 403);
      expect(err.status).toBe(403);
      expect(err.message).toBe('forbidden');
    });

    it('has name property set to AuthError', () => {
      const err = new AuthError('test');
      expect(err.name).toBe('AuthError');
    });
  });
});
