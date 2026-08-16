/**
 * @vitest-environment node
 *
 * Register API — Route Tests
 *
 * Tests POST /api/auth/register — user creation + email verification OTP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

vi.mock('@/lib/otp', () => ({
  requestOtp: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
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

vi.mock('@/lib/encryption', () => ({
  encryptUserFields: vi.fn().mockResolvedValue({ email: 'encrypted-email' }),
}));

vi.mock('@/lib/auth-helpers', () => ({
  generalApiRateLimit: vi
    .fn()
    .mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
}));

import { hashPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp';
import { db } from '@/lib/db';
import { encryptUserFields } from '@/lib/encryption';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { POST } from '@/app/api/auth/register/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const validPayload = {
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'Password123',
  confirmPassword: 'Password123',
};

const mockCreatedUser = {
  id: 'user-1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  passwordHash: 'hashed-password',
};

// ── POST /api/auth/register ────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations that tests override
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
    vi.mocked(hashPassword).mockResolvedValue('hashed-password');
    vi.mocked(encryptUserFields).mockResolvedValue({ email: 'encrypted-email' });
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

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many registration attempts');
  });

  // ── Validation ───────────────────────────────────────────────────

  it('returns 400 for missing name', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'bad-email',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for password too short', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'a@b.com',
      password: 'Short1',
      confirmPassword: 'Short1',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 8 characters/i);
  });

  it('returns 400 for password missing uppercase', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'a@b.com',
      password: 'password1',
      confirmPassword: 'password1',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/uppercase/i);
  });

  it('returns 400 for password missing lowercase', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'a@b.com',
      password: 'PASSWORD1',
      confirmPassword: 'PASSWORD1',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/lowercase/i);
  });

  it('returns 400 for password missing number', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'a@b.com',
      password: 'Passwordx',
      confirmPassword: 'Passwordx',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/number/i);
  });

  it('returns 400 when passwords do not match', async () => {
    const req = makeRequest({
      name: 'Test',
      email: 'a@b.com',
      password: 'Password123',
      confirmPassword: 'Different456',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Passwords do not match/i);
  });

  // ── AUTHORIZED_EMAIL enforcement ──────────────────────────────────

  it('returns 503 when AUTHORIZED_EMAIL env var is not set', async () => {
    delete process.env.AUTHORIZED_EMAIL;

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('not configured');
  });

  it('returns 403 when email does not match AUTHORIZED_EMAIL', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    const req = makeRequest({ ...validPayload, email: 'other@example.com' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('restricted');
  });

  it('allows registration when email matches AUTHORIZED_EMAIL', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockCreatedUser);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  // ── Existing user check ───────────────────────────────────────────

  it('returns 409 when user already exists', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    vi.mocked(db.user.findUnique).mockResolvedValue(mockCreatedUser);

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already exists');
    // Should not attempt to create user
    expect(db.user.create).not.toHaveBeenCalled();
  });

  // ── Successful registration ────────────────────────────────────────

  it('creates user with hashed password and sends OTP', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockCreatedUser);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('user-1');
    expect(body.data.name).toBe('Admin User');

    expect(hashPassword).toHaveBeenCalledWith('Password123');
    expect(encryptUserFields).toHaveBeenCalledWith({ email: 'admin@example.com' });
    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        email: 'encrypted-email',
        name: 'Admin User',
        passwordHash: 'hashed-password',
        role: 'admin',
      },
    });
    expect(requestOtp).toHaveBeenCalledWith('admin@example.com', 'login');
  });

  it('normalizes email before lookup', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockCreatedUser);
    vi.mocked(requestOtp).mockResolvedValue({ success: true });

    // Use mixed case without surrounding spaces (Zod rejects spaces in email)
    const req = makeRequest({ ...validPayload, email: 'Admin@Example.COM' });
    await POST(req);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
  });

  it('includes devCode in dev mode', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DEV_OTP = 'true';

    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(mockCreatedUser);
    vi.mocked(requestOtp).mockResolvedValue({ success: true, devCode: '654321' });

    const req = makeRequest(validPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(body.devCode).toBe('654321');
    expect(body.message).toContain('dev mode');
  });

  // ── Error handling ───────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@example.com';

    vi.mocked(db.user.findUnique).mockRejectedValue(new Error('DB down'));

    const req = makeRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
