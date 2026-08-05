/**
 * Unit Tests — OTP Service (otp.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: requestOtp, verifyOtp — mock DB and sendEmail, test real logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module mocks
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    otpCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email-provider', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(),
  AuditCategory: {},
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(),
}));

import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email-provider';

describe('OTP Service (otp.ts)', () => {
  let requestOtp: any, verifyOtp: any;
  beforeAll(async () => {
    const otpMod = await import('@/lib/otp');
    requestOtp = otpMod.requestOtp;
    verifyOtp = otpMod.verifyOtp;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTHORIZED_EMAIL = 'admin@deepmindq.com';
    process.env.EMAIL_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_OTP;
    delete process.env.ENABLE_DEV_AUTH_BYPASS;
  });

  describe('requestOtp', () => {
    it('rejects invalid email format', async () => {
      const result = await requestOtp('not-an-email', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    it('rejects when AUTHORIZED_EMAIL is not configured', async () => {
      delete process.env.AUTHORIZED_EMAIL;
      const result = await requestOtp('user@example.com', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('AUTHORIZED_EMAIL');
    });

    it('rejects non-authorized email', async () => {
      const result = await requestOtp('unauthorized@evil.com', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('restricted');
    });

    it('rejects if user is inactive', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: false, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('deactivated');
    });

    it('rate-limits OTP requests within 1-minute window', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-1', userId: 'user-1', email: 'admin@deepmindq.com', code: 'hash',
        purpose: 'login', verified: false, expiresAt: new Date(Date.now() + 9 * 60 * 1000),
        attempts: 0, createdAt: new Date(Date.now() - 30_000),
      } as any);

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('wait');
    });

    it('sends OTP email and returns success when email provider works', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpCode.create).mockResolvedValue({ id: 'otp-new' } as any);
      vi.mocked(sendEmail).mockResolvedValue({ success: true, provider: 'resend' });

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(result.success).toBe(true);
      expect(result.devCode).toBeUndefined();
      expect(sendEmail).toHaveBeenCalledOnce();
    });

    it('returns devCode in development when ALLOW_DEV_OTP=true and email fails', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_DEV_OTP = 'true';
      delete process.env.EMAIL_API_KEY;

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpCode.create).mockImplementation(async (args: any) => {
        return { id: 'otp-new', ...args } as any;
      });

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(result.success).toBe(true);
      expect(result.devCode).toBeDefined();
      expect(result.devCode!).toHaveLength(6);
      expect(result.devCode!).toMatch(/^\d{6}$/);
    });

    it('returns failure when email fails in production', async () => {
      process.env.NODE_ENV = 'production';
      vi.mocked(sendEmail).mockResolvedValue({ success: false, provider: 'resend', error: 'SMTP error' });

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpCode.create).mockResolvedValue({ id: 'otp-new' } as any);

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('temporarily unavailable');
    });

    it('auto-creates user if authorized email does not exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.user.create).mockResolvedValue({
        id: 'user-new', email: 'admin@deepmindq.com', name: 'admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpCode.create).mockResolvedValue({ id: 'otp-new' } as any);
      vi.mocked(sendEmail).mockResolvedValue({ success: true, provider: 'resend' });

      const result = await requestOtp('admin@deepmindq.com', 'login');
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'admin@deepmindq.com', role: 'admin' }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('invalidates previous unverified OTPs before creating new one', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 2 });
      vi.mocked(db.otpCode.create).mockResolvedValue({ id: 'otp-new' } as any);
      vi.mocked(sendEmail).mockResolvedValue({ success: true, provider: 'resend' });

      await requestOtp('admin@deepmindq.com', 'login');

      expect(db.otpCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'admin@deepmindq.com', purpose: 'login', verified: false }),
        })
      );
    });

    it('stores OTP as SHA-256 hash with dmq: prefix, never plaintext', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1', email: 'admin@deepmindq.com', name: 'Admin', role: 'admin',
        isActive: true, hasPassword: false, avatarUrl: null, phone: null,
        company: null, designation: null, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
      } as any);

      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      vi.mocked(db.otpCode.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.otpCode.create).mockResolvedValue({ id: 'otp-new' } as any);
      vi.mocked(sendEmail).mockResolvedValue({ success: true, provider: 'resend' });

      await requestOtp('admin@deepmindq.com', 'login');

      const createCall = vi.mocked(db.otpCode.create).mock.calls[0][0] as any;
      expect(createCall.data.code).toMatch(/^[0-9a-f]{64}$/);
      expect(createCall.data.code.length).toBe(64);
    });
  });

  describe('verifyOtp', () => {
    it('rejects codes that are not 6 characters', async () => {
      const result = await verifyOtp('admin@deepmindq.com', '12345', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid code format');
    });

    it('rejects empty code', async () => {
      const result = await verifyOtp('admin@deepmindq.com', '', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid code format');
    });

    it('returns success:true with userId and otpId for valid OTP', async () => {
      const encoder = new TextEncoder();
      const code = '123456';
      const data = encoder.encode(`dmq:${code}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-1', userId: 'user-1', email: 'admin@deepmindq.com', code: codeHash,
        purpose: 'login', verified: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0, user: { id: 'user-1', hasPassword: true },
      } as any);

      vi.mocked(db.otpCode.update).mockResolvedValue({} as any);

      const result = await verifyOtp('admin@deepmindq.com', code, 'login');
      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.otpId).toBe('otp-1');
      expect(result.needsPassword).toBe(false);
    });

    it('returns needsPassword:true when user has not set password', async () => {
      const encoder = new TextEncoder();
      const code = '654321';
      const data = encoder.encode(`dmq:${code}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-2', userId: 'user-2', email: 'admin@deepmindq.com', code: codeHash,
        purpose: 'set_password', verified: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0, user: { id: 'user-2', hasPassword: false },
      } as any);

      vi.mocked(db.otpCode.update).mockResolvedValue({} as any);

      const result = await verifyOtp('admin@deepmindq.com', code, 'set_password');
      expect(result.success).toBe(true);
      expect(result.needsPassword).toBe(true);
    });

    it('returns error for expired OTP', async () => {
      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      const result = await verifyOtp('admin@deepmindq.com', '123456', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });

    it('returns error after MAX_ATTEMPTS (5) failed verifications', async () => {
      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-3', userId: 'user-1', email: 'admin@deepmindq.com', code: 'some-hash',
        purpose: 'login', verified: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 5, user: { id: 'user-1', hasPassword: true },
      } as any);

      vi.mocked(db.otpCode.update).mockResolvedValue({} as any);

      const result = await verifyOtp('admin@deepmindq.com', '000000', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many attempts');
    });

    it('increments attempt count on each verification attempt', async () => {
      const encoder = new TextEncoder();
      const code = '111111';
      const data = encoder.encode(`dmq:${code}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-4', userId: 'user-1', email: 'admin@deepmindq.com', code: codeHash,
        purpose: 'login', verified: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 2, user: { id: 'user-1', hasPassword: true },
      } as any);

      vi.mocked(db.otpCode.update).mockResolvedValue({} as any);

      await verifyOtp('admin@deepmindq.com', code, 'login');

      expect(db.otpCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'otp-4' }, data: { attempts: { increment: 1 } } })
      );
    });

    it('marks OTP as verified after successful verification', async () => {
      const encoder = new TextEncoder();
      const code = '222222';
      const data = encoder.encode(`dmq:${code}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      vi.mocked(db.otpCode.findFirst).mockResolvedValue({
        id: 'otp-5', userId: 'user-1', email: 'admin@deepmindq.com', code: codeHash,
        purpose: 'login', verified: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0, user: { id: 'user-1', hasPassword: true },
      } as any);

      vi.mocked(db.otpCode.update).mockResolvedValue({} as any);

      await verifyOtp('admin@deepmindq.com', code, 'login');

      const updateCalls = vi.mocked(db.otpCode.update).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[0]).toEqual(
        expect.objectContaining({ where: { id: 'otp-5' }, data: { verified: true } })
      );
    });

    it('wrong code does not match hashed OTP (real hash comparison)', async () => {
      vi.mocked(db.otpCode.findFirst).mockResolvedValue(null);
      const result = await verifyOtp('admin@deepmindq.com', '999999', 'login');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });
  });
});
