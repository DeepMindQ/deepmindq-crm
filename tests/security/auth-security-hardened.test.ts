/**
 * Auth Security Hardened Tests
 *
 * Comprehensive tests for session token validation, RBAC enforcement,
 * CSRF token validation, and rate limiting on auth endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/server ───────────────────────────────────────
const mockJson = vi.fn();
vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => {
      mockJson(...args);
      return new Response(JSON.stringify(args[0]), {
        status: (args[1] as Record<string, number>)?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
}));

// ── Mock session module ───────────────────────────────────
const mockGetCurrentSession = vi.fn();
vi.mock('@/lib/session', () => ({
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
}));

// ── Mock DB ───────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// ── Types ─────────────────────────────────────────────────
interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  hasPassword: boolean;
  isActive: boolean;
}

interface Session {
  user: SessionUser;
  expiresAt: Date;
  token: string;
}

// ── Test data ─────────────────────────────────────────────
const ADMIN_USER: SessionUser = {
  id: 'admin-001',
  email: 'admin@deepmindq.com',
  name: 'Admin User',
  role: 'admin',
  hasPassword: true,
  isActive: true,
};

const REGULAR_USER: SessionUser = {
  id: 'user-001',
  email: 'user@deepmindq.com',
  name: 'Regular User',
  role: 'user',
  hasPassword: true,
  isActive: true,
};

const VALID_SESSION: Session = {
  user: ADMIN_USER,
  expiresAt: new Date(Date.now() + 3600000),
  token: 'valid-session-token-abc123',
};

// ── Session Token Validation ──────────────────────────────
function validateSessionToken(token: string | null, sessions: Map<string, Session>): Session | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  if (!session.user.isActive) return null;
  return session;
}

// ── CSRF Token Validation ──────────────────────────────────
function validateCsrfToken(headerToken: string | null, cookieToken: string | null, csrfStore: Map<string, { token: string; expiresAt: Date }>): boolean {
  if (!headerToken || !cookieToken) return false;
  if (headerToken !== cookieToken) return false;
  const stored = csrfStore.get(headerToken);
  if (!stored) return false;
  if (new Date(stored.expiresAt) < new Date()) return false;
  return true;
}

// ── Rate Limiter (in-memory) ───────────────────────────────
class RateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map();
  constructor(
    private maxAttempts: number,
    private windowMs: number,
  ) {}

  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || now > entry.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.maxAttempts) {
      return { allowed: false, retryAfterMs: entry.resetAt - now };
    }
    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(): void {
    this.attempts.clear();
  }
}

describe('Auth Security — Hardened', () => {
  let sessions: Map<string, Session>;
  let csrfStore: Map<string, { token: string; expiresAt: Date }>;
  let otpLimiter: RateLimiter;
  let loginLimiter: RateLimiter;
  let registerLimiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    sessions = new Map([
      [VALID_SESSION.token, VALID_SESSION],
    ]);
    csrfStore = new Map([
      ['csrf-valid-1', { token: 'csrf-valid-1', expiresAt: new Date(Date.now() + 3600000) }],
      ['csrf-expired', { token: 'csrf-expired', expiresAt: new Date(Date.now() - 1000) }],
    ]);
    otpLimiter = new RateLimiter(5, 60000);
    loginLimiter = new RateLimiter(10, 900000);
    registerLimiter = new RateLimiter(3, 3600000);
  });

  // ── Session Token Validation ────────────────────────────
  describe('Session Token Validation', () => {
    it('accepts a valid, non-expired session token', () => {
      const result = validateSessionToken('valid-session-token-abc123', sessions);
      expect(result).not.toBeNull();
      expect(result!.user.email).toBe('admin@deepmindq.com');
    });

    it('rejects null token', () => {
      const result = validateSessionToken(null, sessions);
      expect(result).toBeNull();
    });

    it('rejects empty string token', () => {
      const result = validateSessionToken('', sessions);
      expect(result).toBeNull();
    });

    it('rejects tampered token', () => {
      const result = validateSessionToken('valid-session-token-abc123-tampered', sessions);
      expect(result).toBeNull();
    });

    it('rejects completely unknown token', () => {
      const result = validateSessionToken('totally-fake-token', sessions);
      expect(result).toBeNull();
    });

    it('rejects expired session', () => {
      const expiredSession: Session = {
        ...VALID_SESSION,
        expiresAt: new Date(Date.now() - 1000),
      };
      sessions.set('expired-token', expiredSession);
      const result = validateSessionToken('expired-token', sessions);
      expect(result).toBeNull();
    });

    it('rejects malformed token (special characters)', () => {
      const result = validateSessionToken('<script>alert(1)</script>', sessions);
      expect(result).toBeNull();
    });

    it('rejects inactive user session', () => {
      const inactiveSession: Session = {
        ...VALID_SESSION,
        user: { ...VALID_SESSION.user, isActive: false },
      };
      sessions.set('inactive-token', inactiveSession);
      const result = validateSessionToken('inactive-token', sessions);
      expect(result).toBeNull();
    });
  });

  // ── RBAC Enforcement ───────────────────────────────────
  describe('RBAC Enforcement', () => {
    function requireRole(session: Session | null, requiredRole: string): { allowed: boolean; status: number; error?: string } {
      if (!session) return { allowed: false, status: 401, error: 'Authentication required' };
      if (session.user.role !== requiredRole) {
        return { allowed: false, status: 403, error: `Requires ${requiredRole} role` };
      }
      return { allowed: true, status: 200 };
    }

    it('allows admin to access admin-only routes', () => {
      const result = requireRole(VALID_SESSION, 'admin');
      expect(result.allowed).toBe(true);
    });

    it('rejects regular user from admin routes with 403', () => {
      const userSession: Session = {
        ...VALID_SESSION,
        user: REGULAR_USER,
        token: 'user-session',
      };
      const result = requireRole(userSession, 'admin');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toContain('admin');
    });

    it('rejects unauthenticated request with 401', () => {
      const result = requireRole(null, 'admin');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(401);
    });

    it('viewer role cannot access admin routes', () => {
      const viewerSession: Session = {
        ...VALID_SESSION,
        user: { ...REGULAR_USER, id: 'viewer-001', role: 'viewer' },
        token: 'viewer-session',
      };
      const result = requireRole(viewerSession, 'admin');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
    });
  });

  // ── CSRF Token Validation ───────────────────────────────
  describe('CSRF Token Validation', () => {
    it('accepts matching, non-expired CSRF token', () => {
      const result = validateCsrfToken('csrf-valid-1', 'csrf-valid-1', csrfStore);
      expect(result).toBe(true);
    });

    it('rejects missing header token', () => {
      const result = validateCsrfToken(null, 'csrf-valid-1', csrfStore);
      expect(result).toBe(false);
    });

    it('rejects missing cookie token', () => {
      const result = validateCsrfToken('csrf-valid-1', null, csrfStore);
      expect(result).toBe(false);
    });

    it('rejects mismatched tokens', () => {
      const result = validateCsrfToken('csrf-valid-1', 'csrf-wrong', csrfStore);
      expect(result).toBe(false);
    });

    it('rejects expired CSRF token', () => {
      const result = validateCsrfToken('csrf-expired', 'csrf-expired', csrfStore);
      expect(result).toBe(false);
    });

    it('rejects unknown CSRF token', () => {
      const result = validateCsrfToken('csrf-unknown', 'csrf-unknown', csrfStore);
      expect(result).toBe(false);
    });

    it('rejects empty string tokens', () => {
      const result = validateCsrfToken('', '', csrfStore);
      expect(result).toBe(false);
    });
  });

  // ── Rate Limiting ───────────────────────────────────────
  describe('Rate Limiting on Auth Endpoints', () => {
    it('allows requests under the limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = otpLimiter.check('user@test.com');
        expect(result.allowed).toBe(true);
      }
    });

    it('blocks OTP requests after 5 attempts per minute', () => {
      for (let i = 0; i < 5; i++) {
        otpLimiter.check('user@test.com');
      }
      const result = otpLimiter.check('user@test.com');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('blocks login attempts after 10 attempts per 15 min', () => {
      for (let i = 0; i < 10; i++) {
        loginLimiter.check('attacker@example.com');
      }
      const result = loginLimiter.check('attacker@example.com');
      expect(result.allowed).toBe(false);
    });

    it('blocks registration after 3 attempts per hour', () => {
      for (let i = 0; i < 3; i++) {
        registerLimiter.check('spam@example.com');
      }
      const result = registerLimiter.check('spam@example.com');
      expect(result.allowed).toBe(false);
    });

    it('isolates rate limits per user key', () => {
      for (let i = 0; i < 5; i++) {
        otpLimiter.check('user-a@test.com');
      }
      // Different user should still be allowed
      const result = otpLimiter.check('user-b@test.com');
      expect(result.allowed).toBe(true);
    });
  });
});
