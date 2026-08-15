/**
 * @vitest-environment node
 *
 * Change Password API — Route Tests
 *
 * Tests POST /api/auth/change-password — OTP verification + password update.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockCsrfMiddleware, mockRequireAuth, mockAuthError } = vi.hoisted(() => {
  const mockCsrfMiddleware = vi.fn();
  const mockRequireAuth = vi.fn();
  const mockAuthError = class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'AuthError';
    }
  };
  return { mockCsrfMiddleware, mockRequireAuth, mockAuthError };
});

vi.mock('@/lib/with-csrf', () => ({
  withCsrf: (handler: unknown) => {
    return async (request: unknown, context: unknown) => {
      const result = mockCsrfMiddleware(request);
      if (!result.valid) return result.response;
      return (handler as Function)(request, context);
    };
  },
}));

vi.mock('@/lib/otp', () => ({
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  requireAuth: mockRequireAuth,
  AuthError: mockAuthError,
  hashToken: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  generalApiRateLimit: vi
    .fn()
    .mockReturnValue({ success: true, remaining: 99, resetAt: Date.now() + 60000 }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { verifyOtp } from '@/lib/otp';
import { hashPassword } from '@/lib/password';
import { requireAuth, hashToken } from '@/lib/session';
import { db } from '@/lib/db';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { cookies } from 'next/headers';
import { POST } from '@/app/api/auth/change-password/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const mockUser = { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'admin' };

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCsrfMiddleware.mockReturnValue({ valid: true });
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'session-token-abc' }),
      set: vi.fn(),
      delete: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockCsrfMiddleware.mockReturnValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(generalApiRateLimit).mockReturnValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Too many attempts');
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new mockAuthError('Authentication required', 401));
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Authentication required');
  });

  it('returns 400 when email is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    const req = makeRequest({ otpCode: '123456', newPassword: 'newPass1234' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('returns 400 when OTP code is not 6 digits', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('6 digits');
  });

  it('returns 400 when password is too short', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    const req = makeRequest({ email: 'admin@test.com', otpCode: '123456', newPassword: 'short' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('8 characters');
  });

  it('returns 401 when OTP verification fails', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    vi.mocked(verifyOtp).mockResolvedValue({
      success: false,
      error: 'Invalid or expired code',
      needsPassword: false,
    });
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '000000',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid or expired code');
  });

  it('returns 403 when OTP userId does not match current user', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'other-user-id',
      needsPassword: false,
    });
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('does not match current user');
  });

  it('changes password and deletes other sessions on success', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'user-1',
      needsPassword: false,
    });
    vi.mocked(hashPassword).mockResolvedValue('salt$hashedpassword');
    vi.mocked(hashToken).mockResolvedValue('hashed-session-token');
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 } as never);

    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newSecurePass1',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Password changed successfully');

    expect(hashPassword).toHaveBeenCalledWith('newSecurePass1');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'salt$hashedpassword' },
    });
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: { not: 'hashed-session-token' } },
    });
  });

  it('deletes all sessions when no current token exists', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
    vi.mocked(verifyOtp).mockResolvedValue({
      success: true,
      userId: 'user-1',
      needsPassword: false,
    });
    vi.mocked(hashPassword).mockResolvedValue('salt$hashedpassword');
    vi.mocked(db.user.update).mockResolvedValue({} as never);
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 3 } as never);
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      delete: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newSecurePass1',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // When no current token, should delete ALL sessions for user
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('returns 500 on unexpected error', async () => {
    vi.mocked(requireAuth).mockImplementation(() => {
      throw new Error('DB connection lost');
    });
    const req = makeRequest({
      email: 'admin@test.com',
      otpCode: '123456',
      newPassword: 'newPass1234',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });
});
