/**
 * @vitest-environment node
 *
 * Request OTP API — Route Tests
 *
 * Tests POST /api/auth/request-otp — OTP code generation and email sending.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Set env vars BEFORE the module loads (vi.hoisted runs before vi.mock factories)
vi.hoisted(() => {
  process.env.AUTHORIZED_EMAIL = 'admin@test.com';
  process.env.EMAIL_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'noreply@deepmindq.com';
  process.env.NODE_ENV = 'test';
});

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-helpers', () => ({
  otpRateLimit: vi
    .fn()
    .mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 60000 }),
}));

vi.mock('@/lib/encryption', () => ({
  encryptUserFields: vi.fn().mockImplementation(async (data) => data),
}));

vi.mock('@/lib/brand-helper', () => ({
  getBrandName: vi.fn().mockResolvedValue('DeepMindQ'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@test.com' }),
      create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'admin@test.com' }),
    },
  },
}));

import { otpRateLimit } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { POST } from '@/app/api/auth/request-otp/route';

const defaultRateLimitResult = { success: true, remaining: 4, resetAt: Date.now() + 60000 };

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/request-otp', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(otpRateLimit).mockReturnValue({ ...defaultRateLimitResult });
    process.env = {
      ...originalEnv,
      AUTHORIZED_EMAIL: 'admin@test.com',
      EMAIL_API_KEY: 're_test_key',
      EMAIL_FROM: 'noreply@deepmindq.com',
      NODE_ENV: 'test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 400 for invalid email format', async () => {
    const req = makeRequest({ email: 'not-an-email' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('valid email');
  });

  it('returns 400 for missing email', async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when OTP rate limit is exceeded', async () => {
    vi.mocked(otpRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });
    const req = makeRequest({ email: 'admin@test.com' });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Too many OTP');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('returns 403 when email does not match authorized email', async () => {
    const req = makeRequest({ email: 'unauthorized@other.com' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('restricted');
  });

  it('returns 503 when email send fails (Resend returns non-OK)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error' }),
    } as unknown as Response);

    const req = makeRequest({ email: 'admin@test.com' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('Failed to send verification email');
  });

  it('returns 503 when Resend API throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    const req = makeRequest({ email: 'admin@test.com' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('Failed to send verification email');
  });

  it('returns 200 and stores OTP hash in cookie on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);

    const req = makeRequest({ email: 'admin@test.com' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('OTP sent');

    // Verify cookie was set with OTP hash
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'dmq_otp_hash',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, maxAge: 600 }),
    );

    // Verify attempt counter was reset
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_otp_attempts');
  });

  it('calls Resend API with correct payload', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);

    const req = makeRequest({ email: 'admin@test.com' });
    await POST(req);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('lowercases the email for DB operations', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);

    const req = makeRequest({ email: 'Admin@TEST.COM' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify DB was called with normalized email
    expect(db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@test.com' } }),
    );
  });

  it('creates user in DB if not found', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeRequest({ email: 'admin@test.com' });
    await POST(req);

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'admin' }),
      }),
    );
  });

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('handles DB failure gracefully (cookie is primary)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);
    vi.mocked(db.user.updateMany).mockRejectedValue(new Error('DB down'));
    vi.mocked(db.user.findUnique).mockRejectedValue(new Error('DB down'));

    const req = makeRequest({ email: 'admin@test.com' });
    const res = await POST(req);
    // Should still succeed because cookie is the primary OTP storage
    expect(res.status).toBe(200);
  });

  it('sets OTP cookie with secure flag in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'email_123' }),
    } as unknown as Response);

    const req = makeRequest({ email: 'admin@test.com' });
    await POST(req);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'dmq_otp_hash',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });
});
