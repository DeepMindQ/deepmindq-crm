/**
 * @vitest-environment node
 *
 * Login API — Route Tests
 *
 * Tests POST /api/auth/login — password verification + OTP generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/otp', () => ({
  requestOtp: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
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

import { verifyPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp';
import { db } from '@/lib/db';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { POST } from '@/app/api/auth/login/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  passwordHash: 'hashed-pw',
  role: 'admin',
};

// ── POST /api/auth/login ──────────────────────────────────────────────

describe('POST /api/auth/login', () => {
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

  // ── Rate limiting ─────────────────────────────────────────────────

  it('returns 429 when rate limited', async () => {
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
    });

    const req = makeRequest({ email: 'test@example.com', password: 'pw' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many login attempts');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  // ── Validation ───────────────────────────────────────────────────

  it('returns 400 for missing email', async () => {
    const req = makeRequest({ password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    // Zod reports "Invalid input: expected string, received undefined"
    expect(body.error).toBeDefined();
  });

  it('returns 400 for missing password', async () => {
    const req = makeRequest({ email: 'admin@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for invalid email format', async () => {
    const req = makeRequest({ email: 'not-an-email', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for empty body (not JSON)', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(503);
  });

  // ── User lookup ───────────────────────────────────────────────────

  it('returns 401 when user not found (timing-safe)', async () => {
    vi.useFakeTimers();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeRequest({ email: 'nonexistent@example.com', password: 'password123' });
    const promise = POST(req);

    // Advance past the 1-second delay
    await vi.advanceTimersByTimeAsync(1000);
    const res = await promise;
    vi.useRealTimers();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns 403 when user has no passwordHash', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...mockUser,
      passwordHash: null,
    });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('No password set');
    expect(body.needsOtpLogin).toBe(true);
  });

  // ── Password verification ─────────────────────────────────────────

  it('returns 401 when password is incorrect', async () => {
    vi.useFakeTimers();
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const req = makeRequest({ email: 'admin@example.com', password: 'wrong-password' });
    const promise = POST(req);

    await vi.advanceTimersByTimeAsync(1000);
    const res = await promise;
    vi.useRealTimers();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password');
  });

  it('normalizes email (trim + lowercase) before lookup', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    // Use mixed case (no surrounding spaces, as Zod would reject those)
    const req = makeRequest({ email: 'Admin@Example.COM', password: 'password123' });
    await POST(req);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
  });

  // ── Successful login + OTP ─────────────────────────────────────────

  it('returns success and sends OTP on valid credentials', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('OTP sent');
    expect(requestOtp).toHaveBeenCalledWith('admin@example.com', 'login');
  });

  it('includes devCode in dev mode when ALLOW_DEV_OTP is true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DEV_OTP = 'true';

    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true, devCode: '123456' });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.devCode).toBe('123456');
    expect(body.message).toContain('dev mode');
  });

  it('does not include devCode when ALLOW_DEV_OTP is not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_DEV_OTP;

    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true, devCode: '123456' });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.devCode).toBeUndefined();
    expect(body.message).toContain('OTP sent to your email');
  });

  // ── OTP failure ────────────────────────────────────────────────────

  it('returns 500 when OTP sending fails', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: false, error: 'Email service down' });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    // The OTP error is forwarded directly when present
    expect(body.error).toBe('Email service down');
  });

  it('returns 500 with fallback message when OTP error is undefined', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: false });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('Failed to send OTP');
  });

  // ── IP extraction ─────────────────────────────────────────────────

  it('extracts IP from x-forwarded-for header', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest(
      { email: 'admin@example.com', password: 'password123' },
      { 'x-forwarded-for': '203.0.113.50, 10.0.0.1' },
    );
    await POST(req);

    expect(generalApiRateLimit).toHaveBeenCalledWith('203.0.113.50', 'login');
  });

  it('falls back to unknown IP when no x-forwarded-for header', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' }, {});
    await POST(req);

    expect(generalApiRateLimit).toHaveBeenCalledWith('unknown', 'login');
  });

  // ── Error handling ─────────────────────────────────────────────────

  it('returns 503 on unexpected error', async () => {
    vi.mocked(db.user.findUnique).mockRejectedValue(new Error('DB connection lost'));

    const req = makeRequest({ email: 'admin@example.com', password: 'password123' });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('temporarily unavailable');
  });
});
