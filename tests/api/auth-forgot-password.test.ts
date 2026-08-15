/**
 * @vitest-environment node
 *
 * Forgot Password API — Route Tests
 *
 * Tests POST /api/auth/forgot-password — sends password reset OTP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/otp', () => ({
  requestOtp: vi.fn(),
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
  generalApiRateLimit: vi
    .fn()
    .mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
}));

import { requestOtp } from '@/lib/otp';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { POST } from '@/app/api/auth/forgot-password/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── POST /api/auth/forgot-password ─────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations that tests override
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Rate limiting ─────────────────────────────────────────────────

  it('returns 429 when rate limited', async () => {
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many requests');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  // ── Validation ───────────────────────────────────────────────────

  it('returns 400 for missing email field', async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    // Zod reports "Invalid input: expected string, received undefined"
    expect(body.error).toBeDefined();
  });

  it('returns 400 for invalid email format', async () => {
    const req = makeRequest({ email: 'not-an-email' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for empty email string', async () => {
    const req = makeRequest({ email: '' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  // ── Success ───────────────────────────────────────────────────────

  it('returns success for valid email (prevents email enumeration)', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('reset OTP has been sent');
  });

  it('always returns success even if user does not exist', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'nonexistent@example.com' });
    const res = await POST(req);
    const body = await res.json();

    // Should not reveal whether user exists
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('sends OTP with change_password purpose', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'user@example.com' });
    await POST(req);

    expect(requestOtp).toHaveBeenCalledWith('user@example.com', 'change_password');
  });

  // ── Email normalization ───────────────────────────────────────────

  it('normalizes email (trim + lowercase)', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    // Use mixed case without surrounding spaces (Zod email validator rejects spaces)
    const req = makeRequest({ email: 'User@Example.COM' });
    await POST(req);

    expect(requestOtp).toHaveBeenCalledWith('user@example.com', 'change_password');
  });

  // ── Dev mode OTP ──────────────────────────────────────────────────

  it('returns dev-mode message when ALLOW_DEV_OTP is true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DEV_OTP = 'true';

    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.message).toContain('dev mode');
  });

  it('returns production message when ALLOW_DEV_OTP is not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_DEV_OTP;

    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.message).toContain('If an account exists');
  });

  // ── IP extraction ────────────────────────────────────────────────

  it('extracts IP from x-forwarded-for header', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    await POST(req);

    expect(generalApiRateLimit).toHaveBeenCalledWith('1.2.3.4', 'forgot-password');
  });

  it('uses unknown IP when no x-forwarded-for header', async () => {
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'user@example.com' });
    await POST(req);

    expect(generalApiRateLimit).toHaveBeenCalledWith('unknown', 'forgot-password');
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    vi.mocked(requestOtp).mockRejectedValue(new Error('Service down'));

    const req = makeRequest({ email: 'user@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
