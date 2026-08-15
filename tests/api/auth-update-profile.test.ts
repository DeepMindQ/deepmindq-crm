/**
 * @vitest-environment node
 *
 * Update Profile API — Route Tests
 *
 * Tests POST /api/auth/update-profile — OTP-verified profile/email changes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/otp', () => ({
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
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
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeString: vi.fn((s: string) => s.trim()),
}));

vi.mock('@/lib/encryption', () => ({
  encryptUserFields: vi.fn().mockResolvedValue({ email: 'encrypted-new-email' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/csrf', () => ({
  csrfMiddleware: vi.fn().mockReturnValue({ valid: true }),
}));

import { verifyOtp } from '@/lib/otp';
import { requireAuth, AuthError } from '@/lib/session';
import { db } from '@/lib/db';
import { sanitizeString } from '@/lib/sanitize';
import { encryptUserFields } from '@/lib/encryption';
import { csrfMiddleware } from '@/lib/csrf';
import { POST } from '@/app/api/auth/update-profile/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'admin@example.com', name: 'Admin' };

const updateProfilePayload = {
  email: 'admin@example.com',
  otpCode: '123456',
  purpose: 'update_profile',
  updates: { name: 'New Name' },
};

const changeEmailPayload = {
  email: 'admin@example.com',
  otpCode: '123456',
  purpose: 'change_email',
  updates: { newEmail: 'newadmin@example.com' },
};

const changePasswordPayload = {
  email: 'admin@example.com',
  otpCode: '123456',
  purpose: 'change_password',
};

// ── POST /api/auth/update-profile ──────────────────────────────────────

describe('POST /api/auth/update-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations that tests override
    vi.mocked(csrfMiddleware).mockReturnValue({ valid: true });
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
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

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  // ── Auth required ─────────────────────────────────────────────────

  it('returns error when requireAuth fails', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('Unauthorized', 401));

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  // ── Validation ───────────────────────────────────────────────────

  it('returns 400 for missing email', async () => {
    const req = makeRequest({
      otpCode: '123456',
      purpose: 'update_profile',
      updates: { name: 'Test' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest({
      email: 'bad',
      otpCode: '123456',
      purpose: 'update_profile',
      updates: { name: 'Test' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for OTP code not 6 digits', async () => {
    const req = makeRequest({
      email: 'a@b.com',
      otpCode: '123',
      purpose: 'update_profile',
      updates: { name: 'Test' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/6 digits/i);
  });

  it('returns 400 for invalid purpose', async () => {
    const req = makeRequest({ email: 'a@b.com', otpCode: '123456', purpose: 'invalid_purpose' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  // ── OTP verification ────────────────────────────────────────────

  it('returns 401 when OTP verification fails', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: false, error: 'Invalid OTP' });

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid OTP');
  });

  it('returns 403 when OTP userId does not match session user', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'other-user-id' });

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('OTP does not match current user');
  });

  // ── update_profile ───────────────────────────────────────────────

  it('updates name on update_profile purpose', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Profile updated');

    expect(sanitizeString).toHaveBeenCalledWith('New Name');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
    });
  });

  // ── change_email ──────────────────────────────────────────────────

  it('returns 409 when new email is already taken', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'other-user',
      email: 'newadmin@example.com',
    });

    const req = makeRequest(changeEmailPayload);
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Email already in use');
  });

  it('updates email on change_email purpose', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeRequest(changeEmailPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Email updated');

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'newadmin@example.com' },
    });
    expect(encryptUserFields).toHaveBeenCalledWith({ email: 'newadmin@example.com' });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'encrypted-new-email' },
    });
  });

  it('normalizes new email (lowercase) before storage', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    // Use mixed case without surrounding spaces (Zod email validator rejects spaces)
    const req = makeRequest({
      ...changeEmailPayload,
      updates: { newEmail: 'NewAdmin@Example.COM' },
    });
    await POST(req);

    expect(encryptUserFields).toHaveBeenCalledWith({ email: 'newadmin@example.com' });
  });

  // ── change_password purpose ───────────────────────────────────────

  it('returns success for change_password purpose (handled by separate route)', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ success: true, userId: 'user-1' });

    const req = makeRequest(changePasswordPayload);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Verified');
    expect(db.user.update).not.toHaveBeenCalled();
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error('DB down'));

    const req = makeRequest(updateProfilePayload);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
