// ═══════════════════════════════════════════════════════════════════════════
// OTP Service — Unit Tests
//
// Tests requestOtp and verifyOtp from @/lib/otp.ts.
// All database and external dependencies are mocked.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Environment Setup (must be hoisted before vi.mock) ────────────────
vi.hoisted(() => {
  process.env.AUTHORIZED_EMAIL = 'admin@example.com';
  process.env.EMAIL_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'noreply@deepmindq.com';
  process.env.NODE_ENV = 'test';
  delete process.env.ENABLE_DEV_AUTH_BYPASS;
  delete process.env.ALLOW_DEV_OTP;
});

// ── Mocks (factory must be self-contained — no top-level variables) ────

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/lib/email-provider', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { requestOtp, verifyOtp } from '@/lib/otp';
import { sendEmail } from '@/lib/email-provider';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Helpers ────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
  otpCode: null,
  otpExpiresAt: null,
  passwordHash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset env vars that tests might modify
  process.env.AUTHORIZED_EMAIL = 'admin@example.com';
  process.env.EMAIL_API_KEY = 're_test_key';
  delete process.env.ENABLE_DEV_AUTH_BYPASS;
  delete process.env.ALLOW_DEV_OTP;
});

// ── requestOtp ─────────────────────────────────────────────────────────

describe('requestOtp', () => {
  it('rejects invalid email format', async () => {
    const result = await requestOtp('not-an-email', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email format');
  });

  it('rejects email that does not match AUTHORIZED_EMAIL', async () => {
    const result = await requestOtp('unauthorized@evil.com', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toContain('restricted');
  });

  it('returns error when AUTHORIZED_EMAIL env var is not set', async () => {
    delete process.env.AUTHORIZED_EMAIL;
    const result = await requestOtp('anyone@test.com', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('creates user if not found and sends OTP via email', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(db.user.create).mockResolvedValueOnce({
      ...mockUser,
      id: 'new-user',
    });
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockResolvedValueOnce(true);

    const result = await requestOtp('admin@example.com', 'login');
    expect(result.success).toBe(true);
    expect(db.user.create).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Auto-created authorized user'),
    );
  });

  it('sends OTP email successfully for existing user', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockResolvedValueOnce(true);

    const result = await requestOtp('admin@example.com', 'login');
    expect(result.success).toBe(true);
    expect(result.devCode).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledWith(
      'admin@example.com',
      expect.stringContaining('Login Verification'),
      expect.stringContaining('<!DOCTYPE html>'),
    );
  });

  it('returns error when email send fails in production-like config', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockResolvedValueOnce(false);

    const result = await requestOtp('admin@example.com', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toContain('temporarily unavailable');
  });

  it('returns devCode when ALLOW_DEV_OTP is enabled in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_DEV_OTP = 'true';
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockResolvedValueOnce(false);

    const result = await requestOtp('admin@example.com', 'login');
    expect(result.success).toBe(true);
    expect(result.devCode).toBeDefined();
    expect(result.devCode).toHaveLength(6);
    expect(result.devCode).toMatch(/^\d{6}$/);
  });

  it('logs the OTP code when ENABLE_DEV_AUTH_BYPASS is true', async () => {
    process.env.ENABLE_DEV_AUTH_BYPASS = 'true';
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockResolvedValueOnce(true);

    await requestOtp('admin@example.com', 'login');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('DEV — Code for'));
  });

  it('handles email send exception gracefully', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser);
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP down'));

    const result = await requestOtp('admin@example.com', 'login');
    expect(result.success).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Email exception'),
      expect.objectContaining({ error: 'SMTP down' }),
    );
  });

  it('uses correct purpose labels for different purposes', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
    vi.mocked(db.user.update).mockResolvedValue(mockUser);
    vi.mocked(sendEmail).mockResolvedValue(true);

    const labels: Record<string, string> = {
      set_password: 'Set Your Password',
      change_email: 'Change Email Verification',
      change_password: 'Change Password Verification',
      update_profile: 'Profile Update Verification',
    };

    for (const [purpose, label] of Object.entries(labels)) {
      await requestOtp('admin@example.com', purpose as any);
      expect(sendEmail).toHaveBeenCalledWith(
        'admin@example.com',
        expect.stringContaining(label),
        expect.any(String),
      );
    }
  });
});

// ── verifyOtp ──────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  async function hashOtpForTest(code: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`dmq:${code}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('rejects code that is not 6 digits', async () => {
    const result = await verifyOtp('admin@example.com', '12345', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid code format');
  });

  it('rejects empty code', async () => {
    const result = await verifyOtp('admin@example.com', '', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid code format');
  });

  it('rejects if user not found', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    const result = await verifyOtp('admin@example.com', '123456', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or expired code');
  });

  it('rejects expired OTP', async () => {
    const hash = await hashOtpForTest('123456');
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      otpCode: hash,
      otpExpiresAt: new Date(Date.now() - 60_000), // expired
    });

    const result = await verifyOtp('admin@example.com', '123456', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('rejects incorrect code', async () => {
    const correctHash = await hashOtpForTest('123456');
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      otpCode: correctHash,
      otpExpiresAt: new Date(Date.now() + 60_000),
    });

    const result = await verifyOtp('admin@example.com', '654321', 'login');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid or expired code');
  });

  it('verifies correct code and clears OTP', async () => {
    const hash = await hashOtpForTest('123456');
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      otpCode: hash,
      otpExpiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);

    const result = await verifyOtp('admin@example.com', '123456', 'login');
    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-1');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { otpCode: null, otpExpiresAt: null },
    });
  });

  it('returns needsPassword=true when user has no password hash', async () => {
    const hash = await hashOtpForTest('123456');
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      otpCode: hash,
      otpExpiresAt: new Date(Date.now() + 60_000),
      passwordHash: null,
    });
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);

    const result = await verifyOtp('admin@example.com', '123456', 'login');
    expect(result.needsPassword).toBe(true);
  });

  it('returns needsPassword=false when user has a password hash', async () => {
    const hash = await hashOtpForTest('123456');
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      ...mockUser,
      otpCode: hash,
      otpExpiresAt: new Date(Date.now() + 60_000),
      passwordHash: 'some-hash',
    });
    vi.mocked(db.user.update).mockResolvedValueOnce(mockUser);

    const result = await verifyOtp('admin@example.com', '123456', 'login');
    expect(result.needsPassword).toBe(false);
  });

  it('normalizes email to lowercase and trims whitespace', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
    const result = await verifyOtp('  ADMIN@Example.COM  ', '123456', 'login');
    // The findUnique should be called with normalized email
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
  });
});
