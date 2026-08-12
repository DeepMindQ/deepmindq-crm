/**
 * Auth Flow API Tests
 *
 * Tests the full authentication lifecycle: register → verify-otp → login → me → logout.
 * All tests mock the database and session layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/server ───────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      const status = init?.status || 200;
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    },
  },
}));

// ── Mock next/headers (cookies()) ─────────────────────────
const mockCookieStore = {
  get: vi.fn().mockReturnValue(undefined),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

// ── Mock DB ───────────────────────────────────────────────
const mockUserFindUnique = vi.fn();
const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    otpCode: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

// ── Mock session ─────────────────────────────────────────
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue(null),
  createSession: vi.fn().mockResolvedValue({
    id: 'session-123',
    userId: 'user-001',
    expiresAt: new Date(Date.now() + 86400000),
  }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  destroyCurrentSession: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock CSRF ─────────────────────────────────────────────
vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn().mockReturnValue(true),
  generateCsrfToken: vi.fn().mockReturnValue('csrf-token-123'),
}));

// ── Mock rate-limit (legacy) ─────────────────────────────
const rateLimitMap = new Map<string, number>();
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn((key: string, max: number) => {
    const count = rateLimitMap.get(key) || 0;
    if (count >= max) return { allowed: false, retryAfterMs: 60000 };
    rateLimitMap.set(key, count + 1);
    return { allowed: true, retryAfterMs: 0 };
  }),
}));

// ── Mock auth-helpers (generalApiRateLimit used by register) ──
vi.mock('@/lib/auth-helpers', () => ({
  generalApiRateLimit: vi.fn().mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
  edgeRateLimit: vi.fn().mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
}));

// ── Mock password ────────────────────────────────────────
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
}));

// ── Mock otp ─────────────────────────────────────────────
vi.mock('@/lib/otp', () => ({
  requestOtp: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Mock email ────────────────────────────────────────────
vi.mock('@/lib/email', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(true),
}));

// ── Mock logger ──────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock encryption (dev mode returns plaintext) ─────────
vi.mock('@/lib/encryption', () => ({
  encryptUserFields: vi.fn().mockImplementation(async (data: Record<string, unknown>) => data),
}));

const TEST_USER = {
  id: 'user-001',
  email: 'newuser@deepmindq.com',
  name: 'New User',
  phone: '+1234567890',
  company: 'Acme',
  designation: 'VP Sales',
  role: 'user',
  isActive: true,
  hasPassword: true,
  createdAt: new Date().toISOString(),
};

describe('Auth Flow API', () => {
  let mockGeneralApiRateLimit: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    rateLimitMap.clear();
    // Reset generalApiRateLimit mock to return success by default
    const authHelpers = await import('@/lib/auth-helpers');
    mockGeneralApiRateLimit = vi.mocked(authHelpers.generalApiRateLimit);
    mockGeneralApiRateLimit.mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 });
  });

  describe('POST /api/auth/register', () => {
    it('creates a new user and sends OTP', async () => {
      mockUserFindUnique.mockResolvedValue(null); // No existing user
      mockUserCreate.mockResolvedValue(TEST_USER);

      // Set AUTHORIZED_EMAIL env var (required by register route)
      process.env.AUTHORIZED_EMAIL = 'newuser@deepmindq.com';

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@deepmindq.com',
          name: 'New User',
          phone: '+1234567890',
          company: 'Acme',
          designation: 'VP Sales',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!',
        }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBeLessThan(400);
      expect(mockUserCreate).toHaveBeenCalled();

      delete process.env.AUTHORIZED_EMAIL;
    });

    it('rejects duplicate email registration', async () => {
      mockUserFindUnique.mockResolvedValue(TEST_USER); // User exists

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@deepmindq.com',
          name: 'New User',
          password: 'SecurePass123!',
          confirmPassword: 'SecurePass123!',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('rejects invalid OTP code', async () => {
      const { POST } = await import('@/app/api/auth/verify-otp/route');
      const request = new Request('http://localhost/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@test.com', code: '000000' }),
      });

      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects wrong password', async () => {
      mockUserFindUnique.mockResolvedValue({
        ...TEST_USER,
        passwordHash: '$2b$10$hashedvalue',
      });

      const { POST } = await import('@/app/api/auth/login/route');
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@deepmindq.com', password: 'wrongpassword' }),
      });

      const response = await POST(request);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const { getCurrentSession } = await import('@/lib/session');
      vi.mocked(getCurrentSession).mockResolvedValue(null);

      const { GET } = await import('@/app/api/auth/me/route');
      const request = new Request('http://localhost/api/auth/me');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns success for logout', async () => {
      const { POST } = await import('@/app/api/auth/logout/route');
      const request = new Request('http://localhost/api/auth/logout', {
        method: 'POST',
      });
      const response = await POST(request);

      expect(response.status).toBeLessThan(400);
    });
  });

  describe('Rate Limiting', () => {
    it('triggers rate limiting after repeated register attempts', async () => {
      // Mock generalApiRateLimit to return failure (rate limited)
      mockGeneralApiRateLimit.mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
      });

      const { POST } = await import('@/app/api/auth/register/route');
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@test.com', name: 'Attacker', password: 'SecurePass123!', confirmPassword: 'SecurePass123!' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(429);
    });
  });
});
