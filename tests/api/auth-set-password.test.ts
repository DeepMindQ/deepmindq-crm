/**
 * @vitest-environment node
 *
 * Set Password API — Route Tests
 *
 * Tests POST /api/auth/set-password — OTP-verified password setting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-new-password'),
}));

vi.mock('@/lib/otp', () => ({
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  createSession: vi.fn().mockResolvedValue({ success: true }),
  requireAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update: vi.fn(),
    },
  },
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

vi.mock('@/lib/csrf', () => ({
  csrfMiddleware: vi.fn().mockReturnValue({ valid: true }),
}));

import { hashPassword } from '@/lib/password';
import { verifyOtp } from '@/lib/otp';
import { createSession, AuthError } from '@/lib/session';
import { db } from '@/lib/db';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { csrfMiddleware } from '@/lib/csrf';
import { POST } from '@/app/api/auth/set-password/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/set-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const validPayload = {
  email: 'admin@example.com',
  otpCode: '123456',
  password: 'NewPassword123',
};

// ── POST /api/auth/set-password ────────────────────────────────────────

describe('POST /api/auth/set-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations that tests override
    vi.mocked(csrfMiddleware).mockReturnValue({ valid: true });
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
  });

  // ── CSRF protection ──────────────────────────────────────────────

  it('returns 403 when CSRF validation fails', async () => {
    vi.mocked(csrfMiddleware).mockReturnValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  // ── Rate limiting ─────────────────────────────────────────────────

  it('returns 429 when rate limited', async () => {
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many attempts');
  });

  // ── Validation ───────────────────────────────────────────────────

  it('returns 400 for missing email', async () => {
    const req = makeRequest({ otpCode: '123456', password: 'NewPassword123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest({ email: 'bad', otpCode: '123456', password: 'NewPassword123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for OTP code not 6 digits', async () => {
    const req = makeRequest({
      email: 'admin@example.com',
      otpCode: '123',
      password: 'NewPassword123',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for password too short', async () => {
    const req = makeRequest({ email: 'admin@example.com', otpCode: '123456', password: 'Short1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 8 characters/i);
  });

  // ── OTP verification ──────────────────────────────────────────────

  it('returns 401 when OTP verification fails', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: false, error: 'Invalid OTP' });

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid OTP');
  });

  it('returns 401 when OTP has no userId', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: undefined });

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('OTP verification failed');
  });

  // ── Successful password set ───────────────────────────────────────

  it('sets password and creates session on success', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Password set successfully');

    // Verify password was hashed and stored
    expect(hashPassword).toHaveBeenCalledWith('NewPassword123');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'hashed-new-password' },
    });

    // Verify session was created
    expect(createSession).toHaveBeenCalledWith('user-1');
  });

  // ── IP extraction ────────────────────────────────────────────────

  it('extracts IP from x-forwarded-for header for rate limiting', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: false, error: 'bad' });

    const req = new NextRequest('http://localhost/api/auth/set-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '5.6.7.8, 10.0.0.1',
      },
      body: JSON.stringify(validPayload),
    });
    await POST(req);

    expect(generalApiRateLimit).toHaveBeenCalledWith('5.6.7.8', 'set-password');
  });

  // ── Error handling ───────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error('Service failure'));

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns error from AuthError with its status code', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new AuthError('Session expired', 401));

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Session expired');
  });

  // ── Not valid JSON ────────────────────────────────────────────────

  it('returns 500 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
