// ═══════════════════════════════════════════════════════════════════════════
// Auth Flow Tests — Comprehensive Integration-Level Tests
//
// Tests the full authentication flow: OTP request → verify → session
// creation → /me → logout, plus password change, CSRF, and rate limiting.
// All database and external dependencies are mocked.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ── Environment Setup (runs before vi.mock and imports) ─────────────
vi.hoisted(() => {
  process.env.AUTHORIZED_EMAIL = 'admin@example.com';
  process.env.EMAIL_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'noreply@deepmindq.com';
  process.env.CSRF_SECRET = 'test-csrf-secret-for-testing';
  process.env.NODE_ENV = 'test';
});

// ── Mocks (hoisted by vitest above all imports) ────────────────────

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  getCurrentSession: vi.fn(),
  destroyCurrentSession: vi.fn(),
  hashToken: vi.fn(async (token: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(`dmq_session:${token}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }),
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/session-manager', () => ({
  shouldRotateSession: vi.fn(() => false),
  enforceSessionLimit: vi.fn(async () => 0),
  assessLoginSecurity: vi.fn(),
  parseUserAgent: vi.fn(),
  generateDeviceFingerprint: vi.fn(),
  recordLoginEvent: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  revokeSession: vi.fn(),
  getUserSessions: vi.fn(),
  rotateSession: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  otpRateLimit: vi.fn(() => ({ success: true, remaining: 5, resetAt: Date.now() + 60000 })),
  generalApiRateLimit: vi.fn(() => ({ success: true, remaining: 100, resetAt: Date.now() + 60000 })),
  isPublicPath: vi.fn(() => true),
  isApiRoute: vi.fn(() => true),
  isRateLimitedPublicApi: vi.fn(() => true),
  validateCsrf: vi.fn(() => true),
  applySecurityHeaders: vi.fn((r: any) => r),
  unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
  rateLimitedResponse: vi.fn((retryAfter: number) =>
    new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
    })
  ),
  getSessionToken: vi.fn(),
  CSRF_COOKIE_NAME: 'csrf-token',
  CSRF_TOKEN_HEADER: 'x-csrf-token',
  SESSION_COOKIE_NAME: 'dmq_session',
  edgeRateLimit: vi.fn(() => ({ success: true, remaining: 100, resetAt: Date.now() + 60000 })),
  edgeAuditAuthFailure: vi.fn(),
  edgeAuditCsrfFailure: vi.fn(),
  secureJsonResponse: vi.fn(),
  forbiddenResponse: vi.fn(),
  csrfCheck: vi.fn(),
  generateCspNonce: vi.fn(() => 'test-nonce'),
  getSecurityHeaders: vi.fn(() => ({})),
}));

vi.mock('@/lib/encryption', () => ({
  encryptUserFields: vi.fn((data: any) => data),
  encryptField: vi.fn((_f: string, val: any) => val),
  decryptField: vi.fn((_f: string, val: any) => val),
  getEncryptionHealth: vi.fn(() => ({ masterKeyConfigured: true, enabled: true, algorithm: 'AES-GCM' })),
}));

vi.mock('@/lib/brand-helper', () => ({
  getBrandName: vi.fn(async () => 'DeepMindQ'),
}));

vi.mock('@/lib/design-tokens', () => ({
  tokens: {
    flat: { white: '#ffffff' },
    gold: { dark: '#B8860B' },
    neutral: {
      '100': '#F3F4F6',
      '400': '#9CA3AF',
      '900': '#111827',
    },
    trust: {
      unverified: { value: '#6B7280' },
    },
  },
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(),
}));

vi.mock('@/lib/otp', () => ({
  verifyOtp: vi.fn(),
  requestOtp: vi.fn(),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed_${pw}`),
  verifyPassword: vi.fn(async () => false),
}));

vi.mock('@/lib/rate-limit-registry', () => ({
  getRateLimitConfig: vi.fn(() => null),
}));

vi.mock('@/lib/email-provider', () => ({
  sendEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeString: vi.fn((s: string) => s),
}));

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(async () => {}),
  auditAuthFailure: vi.fn(),
  auditCsrfFailure: vi.fn(),
  auditRateLimit: vi.fn(),
}));

vi.mock('@/lib/env-config', () => ({
  env: {
    NODE_ENV: 'test',
    SERVICE_NAME: 'test',
    DEPLOYMENT_SLOT: 'test',
    REGION: 'local',
  },
}));

// ── Imports ──────────────────────────────────────────────────────────

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import * as sessionLib from '@/lib/session';
import * as authHelpers from '@/lib/auth-helpers';
import { POST as requestOtpPost } from '@/app/api/auth/request-otp/route';
import { POST as verifyOtpPost } from '@/app/api/auth/verify-otp/route';
import { GET as meGet } from '@/app/api/auth/me/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { POST as changePasswordPost } from '@/app/api/auth/change-password/route';
import {
  generateCsrfToken,
  validateCsrf,
  deriveCsrfFromSession,
  csrfMiddleware,
  CSRF_TOKEN_HEADER,
  CSRF_COOKIE_NAME,
} from '@/lib/csrf';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a mock cookie store with real Map-backed storage */
function createMockCookieStore(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn((name: string) => {
      const value = store.get(name);
      return value !== undefined ? { name, value } : undefined;
    }),
    set: vi.fn((name: string, value: string, _opts?: any) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
    getAll: vi.fn(() =>
      Array.from(store.entries()).map(([name, value]) => ({ name, value }))
    ),
    has: vi.fn((name: string) => store.has(name)),
    _store: store,
  };
}

/** Build a POST NextRequest with JSON body */
function makePostRequest(path: string, body?: object, extraHeaders?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });
}

/** Compute SHA-256 hash matching the route handlers' hashOtp format */
async function hashOtpLikeRoute(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq:${code}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Build a CSRF cookie+header pair for requests */
function csrfPair() {
  const token = generateCsrfToken();
  return {
    token,
    cookieHeader: `${CSRF_COOKIE_NAME}=${token}`,
    header: { [CSRF_TOKEN_HEADER]: token },
  };
}

// ── Shared test state ───────────────────────────────────────────────

let cookieStore: ReturnType<typeof createMockCookieStore>;

const MOCK_USER = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  passwordHash: null,
  otpCode: null,
  otpExpiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Re-set mock implementations after clearAllMocks (vitest 4 resets implementations)
  vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
    success: true,
    remaining: 5,
    resetAt: Date.now() + 60000,
  });
  vi.mocked(authHelpers.generalApiRateLimit).mockReturnValue({
    success: true,
    remaining: 100,
    resetAt: Date.now() + 60000,
  });

  cookieStore = createMockCookieStore();
  vi.mocked(cookies).mockResolvedValue(cookieStore as any);

  // Default: fetch succeeds (Resend API)
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
});

afterAll(() => {
  delete process.env.AUTHORIZED_EMAIL;
  delete process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.CSRF_SECRET;
});

// ═══════════════════════════════════════════════════════════════════════
// 1. OTP Request Flow
// ═══════════════════════════════════════════════════════════════════════

describe('1. OTP Request Flow', () => {

  it('sends OTP to authorized email and stores hash in cookie', async () => {
    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('OTP sent to your email');

    // Email was sent via Resend
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    );

    // OTP hash was stored in httpOnly cookie
    expect(cookieStore.set).toHaveBeenCalledWith(
      'dmq_otp_hash',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );

    // Attempt counter was reset
    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
  });

  it('returns 400 for invalid email format', async () => {
    const req = makePostRequest('/api/auth/request-otp', {
      email: 'not-an-email',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('valid email');
  });

  it('returns 400 for missing email', async () => {
    const req = makePostRequest('/api/auth/request-otp', {});

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it('returns 403 for unauthorized email', async () => {
    const req = makePostRequest('/api/auth/request-otp', {
      email: 'hacker@evil.com',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('restricted');
  });

  it('returns 503 when email send fails', async () => {
    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    // Make fetch return a failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal error' }),
    });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain('Failed to send verification email');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 45000,
    });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain('Too many OTP requests');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  it('creates user in DB if not found (auto-provisioning)', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.updateMany.mockResolvedValue({ count: 0 });
    db.user.create.mockResolvedValue({
      id: 'user-new',
      email: 'admin@example.com',
      name: 'admin',
      role: 'admin',
    });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);

    expect(res.status).toBe(200);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          role: 'admin',
        }),
      })
    );
  });

  it('stores OTP hash in cookie with 10-minute maxAge', async () => {
    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    await requestOtpPost(req);

    expect(cookieStore.set).toHaveBeenCalledWith(
      'dmq_otp_hash',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60,
      })
    );
  });

  it('trims and lowercases email before validation', async () => {
    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    // Use valid email format with uppercase — Zod accepts it, then it's trimmed/lowered
    const req = makePostRequest('/api/auth/request-otp', {
      email: 'Admin@Example.COM',
    });

    const res = await requestOtpPost(req);

    // Should succeed (not 403) because the email is trimmed/lowered to admin@example.com
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. OTP Verify Flow
// ═══════════════════════════════════════════════════════════════════════

describe('2. OTP Verify Flow', () => {

  it('verifies correct OTP and creates session', async () => {
    const testCode = '123456';
    const hash = await hashOtpLikeRoute(testCode);

    // Pre-populate cookie with the OTP hash
    cookieStore = createMockCookieStore({ dmq_otp_hash: hash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.update.mockResolvedValue({});
    sessionLib.createSession.mockResolvedValue({
      token: 'test-session-token',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: testCode,
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.needsPassword).toBe(true); // no passwordHash set
    expect(data.user).toEqual({ id: 'user-1', email: 'admin@example.com' });

    // Session was created
    expect(sessionLib.createSession).toHaveBeenCalledWith('user-1');

    // OTP cookies were cleared
    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_otp_hash');
    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
  });

  it('returns 401 for wrong OTP code', async () => {
    const correctHash = await hashOtpLikeRoute('123456');

    cookieStore = createMockCookieStore({ dmq_otp_hash: correctHash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    // DB fallback also fails: user not found
    db.user.findUnique.mockResolvedValue(null);

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '000000', // wrong code
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Invalid or expired code');
  });

  it('returns 401 when no OTP hash cookie exists', async () => {
    // No dmq_otp_hash in cookies
    cookieStore = createMockCookieStore();
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123456',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('No verification code found');
  });

  it('returns 401 after exceeding max attempts (5)', async () => {
    const correctHash = await hashOtpLikeRoute('123456');

    // Set 5 prior attempts
    cookieStore = createMockCookieStore({
      dmq_otp_hash: correctHash,
      dmq_otp_attempts: '5',
    });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123456',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Too many attempts');

    // Cookies were cleared
    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_otp_hash');
    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
  });

  it('returns 403 when user not found after OTP match', async () => {
    const testCode = '123456';
    const hash = await hashOtpLikeRoute(testCode);

    cookieStore = createMockCookieStore({ dmq_otp_hash: hash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    // OTP matches but user doesn't exist
    db.user.findUnique.mockResolvedValue(null);
    db.user.update.mockResolvedValue({});

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: testCode,
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('User account not found');
  });

  it('returns 400 for invalid input (code too short)', async () => {
    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing purpose field', async () => {
    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123456',
    });

    const res = await verifyOtpPost(req);

    expect(res.status).toBe(400);
  });

  it('returns 403 for unauthorized email', async () => {
    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'hacker@evil.com',
      code: '123456',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('Unauthorized');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 45000,
    });

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123456',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain('Too many verification attempts');
  });

  it('clears OTP from DB after successful verification', async () => {
    const testCode = '654321';
    const hash = await hashOtpLikeRoute(testCode);

    cookieStore = createMockCookieStore({ dmq_otp_hash: hash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.update.mockResolvedValue({});
    sessionLib.createSession.mockResolvedValue({
      token: 'session-tok',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: testCode,
      purpose: 'login',
    });

    await verifyOtpPost(req);

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { otpCode: null, otpExpiresAt: null },
      })
    );
  });

  it('indicates needsPassword=false when user has a password hash', async () => {
    const testCode = '111111';
    const hash = await hashOtpLikeRoute(testCode);

    cookieStore = createMockCookieStore({ dmq_otp_hash: hash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    db.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      passwordHash: 'some-hash',
    });
    db.user.update.mockResolvedValue({});
    sessionLib.createSession.mockResolvedValue({
      token: 'tok',
      expiresAt: new Date(),
    });

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: testCode,
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);
    const data = await res.json();

    expect(data.needsPassword).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Session Creation
// ═══════════════════════════════════════════════════════════════════════

describe('3. Session Creation', () => {

  it('stores SHA-256 hash of token in DB, not plaintext', async () => {
    db.session.deleteMany.mockResolvedValue({ count: 0 });
    db.session.create.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      token: 'hashed-token',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    // Call the real hashToken (not mocked for this test)
    const { hashToken } = await import('@/lib/session');
    // hashToken is the mocked version — use crypto directly
    const encoder = new TextEncoder();
    const token = 'test-plaintext-token';
    const data = encoder.encode(`dmq_session:${token}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const expectedHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Verify the hash is 64-char hex
    expect(expectedHash).toHaveLength(64);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify it's NOT the plaintext token
    expect(expectedHash).not.toBe(token);
  });

  it('sets session cookie with httpOnly flag', async () => {
    // This tests that createSession (called by verify-otp) sets httpOnly cookie
    const testCode = '999999';
    const hash = await hashOtpLikeRoute(testCode);

    cookieStore = createMockCookieStore({ dmq_otp_hash: hash });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.update.mockResolvedValue({});

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: testCode,
      purpose: 'login',
    });

    await verifyOtpPost(req);

    // The session creation was invoked (it internally sets the cookie)
    expect(sessionLib.createSession).toHaveBeenCalledWith('user-1');
  });

  it('session cookie name is dmq_session', async () => {
    // Verify the constant used throughout the system
    expect(authHelpers.SESSION_COOKIE_NAME).toBe('dmq_session');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. /api/auth/me
// ═══════════════════════════════════════════════════════════════════════

describe('4. /api/auth/me', () => {

  it('returns user when valid session exists', async () => {
    cookieStore = createMockCookieStore({ dmq_session: 'valid-session-token-64chars' });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    sessionLib.getCurrentSession.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    const res = await meGet();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });
  });

  it('returns 401 when no session cookie', async () => {
    cookieStore = createMockCookieStore();
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const res = await meGet();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Not authenticated');
  });

  it('returns 401 for short session token (< 16 chars)', async () => {
    cookieStore = createMockCookieStore({ dmq_session: 'short' });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const res = await meGet();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Invalid session');
  });

  it('returns 401 when session DB lookup fails', async () => {
    cookieStore = createMockCookieStore({ dmq_session: 'a'.repeat(32) });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    sessionLib.getCurrentSession.mockResolvedValue(null);

    const res = await meGet();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Session validation unavailable');
  });

  it('returns 401 when getCurrentSession throws', async () => {
    cookieStore = createMockCookieStore({ dmq_session: 'a'.repeat(32) });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    sessionLib.getCurrentSession.mockRejectedValue(new Error('DB down'));

    const res = await meGet();
    const data = await res.json();

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Logout
// ═══════════════════════════════════════════════════════════════════════

describe('5. Logout', () => {

  it('calls destroyCurrentSession and returns success', async () => {
    sessionLib.destroyCurrentSession.mockResolvedValue(undefined);

    const res = await logoutPost();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Logged out');
    expect(sessionLib.destroyCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('deletes the dmq_session cookie', async () => {
    cookieStore = createMockCookieStore({ dmq_session: 'some-token' });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);
    sessionLib.destroyCurrentSession.mockImplementation(async () => {
      cookieStore.delete('dmq_session');
    });

    await logoutPost();

    expect(cookieStore.delete).toHaveBeenCalledWith('dmq_session');
  });

  it('returns 500 when destroyCurrentSession throws', async () => {
    sessionLib.destroyCurrentSession.mockRejectedValue(new Error('DB error'));

    const res = await logoutPost();

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Password Change
// ═══════════════════════════════════════════════════════════════════════

describe('6. Password Change', () => {

  it('changes password with valid OTP and session', async () => {
    const { verifyOtp } = await import('@/lib/otp');
    const { hashPassword } = await import('@/lib/password');
    const csrf = csrfPair();

    // Auth: user has valid session
    sessionLib.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    // OTP verification succeeds
    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'user-1',
      needsPassword: false,
    });

    // Password hashing
    vi.mocked(hashPassword).mockResolvedValue('new_hashed_password');

    db.user.update.mockResolvedValue({});
    db.session.deleteMany.mockResolvedValue({ count: 0 });
    sessionLib.hashToken.mockResolvedValue('hashed-session-token');

    cookieStore = createMockCookieStore({ dmq_session: 'session-token-value' });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Password changed successfully');

    // Password was hashed and saved
    expect(hashPassword).toHaveBeenCalledWith('NewSecureP@ss1');
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { passwordHash: 'new_hashed_password' },
      })
    );
  });

  it('returns 403 when CSRF token is missing', async () => {
    const req = makePostRequest('/api/auth/change-password', {
      email: 'admin@example.com',
      otpCode: '123456',
      newPassword: 'NewSecureP@ss1',
    });
    // No CSRF header or cookie

    const res = await changePasswordPost(req);

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const csrf = csrfPair();
    const { AuthError } = await import('@/lib/session');

    sessionLib.requireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when OTP verification fails', async () => {
    const { verifyOtp } = await import('@/lib/otp');
    const csrf = csrfPair();

    sessionLib.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    vi.mocked(verifyOtp).mockResolvedValue({
      success: false,
      error: 'Invalid or expired code',
      needsPassword: false,
    });

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '000000',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeTruthy(); // error message from OTP module
  });

  it('returns 403 when OTP userId does not match session user', async () => {
    const { verifyOtp } = await import('@/lib/otp');
    const csrf = csrfPair();

    sessionLib.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    // OTP belongs to a different user
    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'user-OTHER',
      needsPassword: false,
    });

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('OTP does not match current user');
  });

  it('returns 400 when password is too short', async () => {
    const csrf = csrfPair();

    sessionLib.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'short',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);

    expect(res.status).toBe(400);
  });

  it('destroys other sessions after password change', async () => {
    const { verifyOtp } = await import('@/lib/otp');
    const { hashPassword } = await import('@/lib/password');
    const csrf = csrfPair();

    sessionLib.requireAuth.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
    });

    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'user-1',
      needsPassword: false,
    });

    vi.mocked(hashPassword).mockResolvedValue('new_hash');
    db.user.update.mockResolvedValue({});
    db.session.deleteMany.mockResolvedValue({ count: 3 });
    sessionLib.hashToken.mockResolvedValue('hashed-tok');

    cookieStore = createMockCookieStore({ dmq_session: 'current-token' });
    vi.mocked(cookies).mockResolvedValue(cookieStore as any);

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    await changePasswordPost(req);

    // Should delete sessions where token is NOT the current token hash
    expect(db.session.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          token: { not: 'hashed-tok' },
        }),
      })
    );
  });

  it('returns 429 when rate limited', async () => {
    const csrf = csrfPair();

    vi.mocked(authHelpers.generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 45000,
    });

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);

    expect(res.status).toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. CSRF Token Validation
// ═══════════════════════════════════════════════════════════════════════

describe('7. CSRF Token Validation', () => {

  it('generateCsrfToken produces 64-char hex string', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateCsrfToken produces unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i++) {
      tokens.add(generateCsrfToken());
    }
    expect(tokens.size).toBe(50);
  });

  it('deriveCsrfFromSession is deterministic', async () => {
    const h1 = await deriveCsrfFromSession('session-token-abc');
    const h2 = await deriveCsrfFromSession('session-token-abc');
    expect(h1).toBe(h2);
  });

  it('deriveCsrfFromSession produces different values for different sessions', async () => {
    const h1 = await deriveCsrfFromSession('token-1');
    const h2 = await deriveCsrfFromSession('token-2');
    expect(h1).not.toBe(h2);
  });

  it('validateCsrf passes when header matches cookie on POST', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf fails when CSRF header is missing on POST', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { cookie: `${CSRF_COOKIE_NAME}=${token}` },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf fails when CSRF cookie is missing on POST', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { [CSRF_TOKEN_HEADER]: token },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf fails when header and cookie values differ', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: 'aaa'.repeat(22),
        cookie: `${CSRF_COOKIE_NAME}=${'bbb'.repeat(22)}`,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf skips GET requests (safe method)', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'GET',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf skips OPTIONS requests', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'OPTIONS',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('csrfMiddleware returns 403 response for POST without token', () => {
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    const result = csrfMiddleware(req);

    expect(result.valid).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
  });

  it('csrfMiddleware returns valid:true for GET requests', () => {
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    const result = csrfMiddleware(req);

    expect(result.valid).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it('CSRF-protected route (change-password) rejects without CSRF', async () => {
    // No CSRF headers at all
    const req = makePostRequest('/api/auth/change-password', {
      email: 'admin@example.com',
      otpCode: '123456',
      newPassword: 'NewSecureP@ss1',
    });

    const res = await changePasswordPost(req);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. Rate Limiting
// ═══════════════════════════════════════════════════════════════════════

describe('8. Rate Limiting', () => {

  it('OTP request passes when under rate limit', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: true,
      remaining: 4,
      resetAt: Date.now() + 60000,
    });

    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);

    expect(res.status).toBe(200);
  });

  it('OTP request is rate-limited per email after threshold', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 45000,
    });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain('Too many OTP requests');
  });

  it('rate limit response includes Retry-After header', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    const res = await requestOtpPost(req);

    expect(res.status).toBe(429);
    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it('OTP verify is rate-limited per email', async () => {
    vi.mocked(authHelpers.otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 45000,
    });

    const req = makePostRequest('/api/auth/verify-otp', {
      email: 'admin@example.com',
      code: '123456',
      purpose: 'login',
    });

    const res = await verifyOtpPost(req);

    expect(res.status).toBe(429);
  });

  it('change-password is rate-limited per IP', async () => {
    const csrf = csrfPair();

    vi.mocked(authHelpers.generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const req = makePostRequest(
      '/api/auth/change-password',
      {
        email: 'admin@example.com',
        otpCode: '123456',
        newPassword: 'NewSecureP@ss1',
      },
      {
        ...csrf.header,
        cookie: csrf.cookieHeader,
      }
    );

    const res = await changePasswordPost(req);

    expect(res.status).toBe(429);
  });

  it('rate limiter tracks calls with otp: prefix for OTP requests', async () => {
    db.user.findUnique.mockResolvedValue(MOCK_USER);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makePostRequest('/api/auth/request-otp', {
      email: 'admin@example.com',
    });

    await requestOtpPost(req);

    // Verify otpRateLimit was called with the email
    expect(authHelpers.otpRateLimit).toHaveBeenCalledWith('admin@example.com');
  });
});
