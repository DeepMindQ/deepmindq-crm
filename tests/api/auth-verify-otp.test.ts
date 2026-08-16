/**
 * @vitest-environment node
 *
 * Verify OTP API — Route Tests
 *
 * Tests POST /api/auth/verify-otp — OTP code verification and session creation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.hoisted(() => {
  process.env.AUTHORIZED_EMAIL = 'admin@test.com';
});

const { mockCookieStore, cookieJar } = vi.hoisted(() => {
  const cookieJar = new Map<string, string>();
  const mockCookieStore = {
    get: vi.fn((name: string) => {
      const val = cookieJar.get(name);
      return val ? { value: val } : undefined;
    }),
    set: vi.fn((name: string, value: string) => {
      cookieJar.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      cookieJar.delete(name);
    }),
  };
  return { mockCookieStore, cookieJar };
});

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
}));

const { mockOtpRateLimit, defaultRateLimitResult } = vi.hoisted(() => ({
  mockOtpRateLimit: vi.fn(),
  defaultRateLimitResult: { success: true, remaining: 4, resetAt: Date.now() + 60000 },
}));

vi.mock('@/lib/auth-helpers', () => ({
  otpRateLimit: mockOtpRateLimit,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { otpRateLimit } from '@/lib/auth-helpers';
import { POST } from '@/app/api/auth/verify-otp/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Hash an OTP code the same way the route does internally */
async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq:${code}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'admin',
  passwordHash: 'salt$hash',
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-otp', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    process.env = { ...originalEnv, AUTHORIZED_EMAIL: 'admin@test.com' };
    vi.mocked(otpRateLimit).mockReturnValue({ ...defaultRateLimitResult });
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    vi.mocked(createSession).mockResolvedValue({
      token: 'new-session-token',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest({ email: 'not-email', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for code that is not 6 digits', async () => {
    const req = makeRequest({ email: 'admin@test.com', code: '123', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('6 digits');
  });

  it('returns 400 for invalid purpose', async () => {
    const req = makeRequest({
      email: 'admin@test.com',
      code: '123456',
      purpose: 'invalid_purpose',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when OTP rate limit is exceeded', async () => {
    vi.mocked(otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });
    const req = makeRequest({ email: 'admin@test.com', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Too many');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('returns 503 when AUTHORIZED_EMAIL is not configured', async () => {
    delete process.env.AUTHORIZED_EMAIL;
    const req = makeRequest({ email: 'admin@test.com', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('not configured');
  });

  it('returns 403 when email does not match authorized email', async () => {
    const req = makeRequest({ email: 'other@test.com', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when no OTP hash cookie exists', async () => {
    const req = makeRequest({ email: 'admin@test.com', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('No verification code');
  });

  it('returns 401 when too many attempts have been made', async () => {
    const validHash = await hashOtp('123456');
    cookieJar.set('dmq_otp_hash', validHash);
    cookieJar.set('dmq_otp_attempts', '5'); // MAX_ATTEMPTS

    const req = makeRequest({ email: 'admin@test.com', code: '123456', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Too many attempts');

    // Should have deleted OTP cookies
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_otp_hash');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
  });

  it('returns 401 for invalid OTP code', async () => {
    const storedHash = await hashOtp('111111');
    cookieJar.set('dmq_otp_hash', storedHash);

    const req = makeRequest({ email: 'admin@test.com', code: '999999', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid or expired code');
  });

  it('returns 200 and creates session on successful verification', async () => {
    const validHash = await hashOtp('654321');
    cookieJar.set('dmq_otp_hash', validHash);

    const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user).toEqual({ id: 'user-1', email: 'admin@test.com' });

    expect(createSession).toHaveBeenCalledWith('user-1');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_otp_hash');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { otpCode: null, otpExpiresAt: null },
    });
  });

  it('returns needsPassword: true when user has no password hash', async () => {
    const validHash = await hashOtp('654321');
    cookieJar.set('dmq_otp_hash', validHash);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      passwordHash: null,
    });

    const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose: 'login' });
    const res = await POST(req);
    const data = await res.json();
    expect(data.needsPassword).toBe(true);
  });

  it('returns needsPassword: false when user has a password hash', async () => {
    const validHash = await hashOtp('654321');
    cookieJar.set('dmq_otp_hash', validHash);

    const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose: 'login' });
    const res = await POST(req);
    const data = await res.json();
    expect(data.needsPassword).toBe(false);
  });

  it('returns 403 when OTP matches but user not found in DB', async () => {
    const validHash = await hashOtp('654321');
    cookieJar.set('dmq_otp_hash', validHash);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('not found');
  });

  it('increments attempt counter on each attempt', async () => {
    const validHash = await hashOtp('111111');
    cookieJar.set('dmq_otp_hash', validHash);

    const req = makeRequest({ email: 'admin@test.com', code: '999999', purpose: 'login' });
    await POST(req);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'dmq_otp_attempts',
      '1',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('handles DB failure during OTP clearing gracefully', async () => {
    const validHash = await hashOtp('654321');
    cookieJar.set('dmq_otp_hash', validHash);
    vi.mocked(db.user.update).mockRejectedValue(new Error('DB down'));

    const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose: 'login' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('accepts all valid purpose values', async () => {
    const validHash = await hashOtp('654321');
    const purposes = ['login', 'set_password', 'change_email', 'change_password', 'update_profile'];

    for (const purpose of purposes) {
      cookieJar.clear();
      cookieJar.set('dmq_otp_hash', validHash);
      vi.clearAllMocks();
      vi.mocked(otpRateLimit).mockReturnValue({ ...defaultRateLimitResult });
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(db.user.update).mockResolvedValue({} as never);
      vi.mocked(createSession).mockResolvedValue({
        token: 'tok',
        expiresAt: new Date(),
      });

      const req = makeRequest({ email: 'admin@test.com', code: '654321', purpose });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});
