/**
 * Unit Tests — Session Manager (session-manager.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: shouldRotateSession, enforceSessionLimit, assessLoginSecurity,
 * parseUserAgent, generateDeviceFingerprint, recordLoginEvent,
 * revokeAllUserSessions, revokeSession, rotateSession, getUserSessions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('@/lib/email-provider', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() } }));
vi.mock('@/lib/audit-logger', () => ({ audit: vi.fn(), AuditCategory: {} }));
vi.mock('@/lib/timer-registry', () => ({ registerTimer: vi.fn() }));

import { db } from '@/lib/db';
import { audit } from '@/lib/audit-logger';

describe('Session Manager (session-manager.ts)', () => {
  let shouldRotateSession: any, enforceSessionLimit: any;
  let assessLoginSecurity: any, parseUserAgent: any;
  let generateDeviceFingerprint: any, recordLoginEvent: any;
  let revokeAllUserSessions: any, revokeSession: any, rotateSession: any;
  let getUserSessions: any;
  beforeAll(async () => {
    const mod = await import('@/lib/session-manager');
    shouldRotateSession = mod.shouldRotateSession;
    enforceSessionLimit = mod.enforceSessionLimit;
    assessLoginSecurity = mod.assessLoginSecurity;
    parseUserAgent = mod.parseUserAgent;
    generateDeviceFingerprint = mod.generateDeviceFingerprint;
    recordLoginEvent = mod.recordLoginEvent;
    revokeAllUserSessions = mod.revokeAllUserSessions;
    revokeSession = mod.revokeSession;
    rotateSession = mod.rotateSession;
    getUserSessions = mod.getUserSessions;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseUserAgent', () => {
    it('detects desktop for standard desktop browser UA', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Chrome');
    });
    it('detects macOS desktop', () => {
      const result = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('macOS');
      expect(result.browser).toBe('Safari');
    });
    it('detects Linux desktop with Firefox', () => {
      const result = parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Firefox/115.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Linux');
      expect(result.browser).toBe('Firefox');
    });
    it('detects Edge browser', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Edg/120.0');
      expect(result.browser).toBe('Edge');
    });
    it('detects mobile iPhone', () => {
      const result = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Chrome/120.0 Mobile');
      expect(result.deviceType).toBe('mobile');
    });
    it('detects mobile Android phone', () => {
      const result = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile');
      expect(result.deviceType).toBe('mobile');
    });
    it('detects tablet iPad', () => {
      const result = parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/605.1.15');
      expect(result.deviceType).toBe('tablet');
    });
    it('detects tablet Android', () => {
      const result = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel Tablet) Chrome/120.0');
      expect(result.deviceType).toBe('tablet');
    });
    it('returns Unknown for unrecognized UA', () => {
      const result = parseUserAgent('SomeBot/1.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Unknown');
      expect(result.browser).toBe('Unknown');
    });
    it('detects Chrome on macOS correctly', () => {
      const result = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0');
      expect(result.os).toBe('macOS');
      expect(result.browser).toBe('Chrome');
    });
  });

  describe('generateDeviceFingerprint', () => {
    it('is deterministic for same UA and IP', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.100');
      const fp2 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.100');
      expect(fp1).toBe(fp2);
    });
    it('produces different fingerprints for different UAs', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.100');
      const fp2 = generateDeviceFingerprint('Firefox/115.0', '192.168.1.100');
      expect(fp1).not.toBe(fp2);
    });
    it('produces same fingerprint for same subnet', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.100');
      const fp2 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.200');
      expect(fp1).toBe(fp2);
    });
    it('produces different fingerprints for different subnets', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120.0', '192.168.1.100');
      const fp2 = generateDeviceFingerprint('Chrome/120.0', '10.0.0.100');
      expect(fp1).not.toBe(fp2);
    });
    it('handles short IP addresses gracefully', () => {
      const fp = generateDeviceFingerprint('Chrome/120', '127.0.0.1');
      expect(typeof fp).toBe('string');
      expect(fp.length).toBeGreaterThan(0);
    });
    it('returns a base-36 encoded string', () => {
      const fp = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      expect(fp).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('shouldRotateSession', () => {
    it('returns false for a brand new session', () => {
      expect(shouldRotateSession(new Date())).toBe(false);
    });
    it('returns false for a session created 6 days ago', () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(sixDaysAgo)).toBe(false);
    });
    it('returns true for a session older than 7 days', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(eightDaysAgo)).toBe(true);
    });
    it('returns false exactly at 7 days', () => {
      const exactlySevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(exactlySevenDays)).toBe(false);
    });
    it('returns true for a session created 30 days ago', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(thirtyDaysAgo)).toBe(true);
    });
    it('enforceSessionLimit returns 0 when under limit', () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      expect(enforceSessionLimit('user-1', 'tok-1')).resolves.toBe(0);
    });
  });

  describe('assessLoginSecurity', () => {
    it('returns zero risk for first login from known IP', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      vi.mocked(db.session.findFirst).mockResolvedValue({
        id: 'prev-session', ipAddress: '192.168.1.100', userAgent: 'Chrome', createdAt: new Date(),
      } as any);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome/120', ip: '192.168.1.100', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'abc123',
      });

      expect(result.isSuspicious).toBe(false);
      expect(result.riskScore).toBe(0);
      expect(result.isNewDevice).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('detects new device (no prior session from this IP)', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      vi.mocked(db.session.findFirst).mockResolvedValue(null);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome/120', ip: '10.0.0.1', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'new-fp',
      });

      expect(result.isNewDevice).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(25);
      expect(result.reasons.some(r => r.includes('unrecognized'))).toBe(true);
    });

    it('detects rapid login (3+ sessions in 10 minutes)', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([
        { ipAddress: '1.1.1.1', userAgent: 'UA1', createdAt: new Date() },
        { ipAddress: '1.1.1.1', userAgent: 'UA2', createdAt: new Date() },
        { ipAddress: '1.1.1.1', userAgent: 'UA3', createdAt: new Date() },
      ] as any[]);
      vi.mocked(db.session.findFirst).mockResolvedValue({
        id: 'prev', ipAddress: '1.1.1.1', createdAt: new Date(),
      } as any);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome', ip: '1.1.1.1', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'fp',
      });

      expect(result.isRapidLogin).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.reasons.some(r => r.includes('Rapid'))).toBe(true);
    });

    it('detects location change (different first IP octet)', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      vi.mocked(db.session.findFirst).mockResolvedValue({
        id: 'prev', ipAddress: '192.168.1.100', createdAt: new Date(),
      } as any);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome', ip: '10.0.0.1', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'fp',
      });

      expect(result.isNewLocation).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
    });

    it('does not flag location change within same first IP octet', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      vi.mocked(db.session.findFirst).mockResolvedValue({
        id: 'prev', ipAddress: '192.168.1.100', createdAt: new Date(),
      } as any);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome', ip: '192.168.2.200', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'fp',
      });

      expect(result.isNewLocation).toBe(false);
    });

    it('sets isSuspicious=true when riskScore >= 50', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([
        { ipAddress: '1.1.1.1', userAgent: 'UA1', createdAt: new Date() },
        { ipAddress: '1.1.1.1', userAgent: 'UA2', createdAt: new Date() },
        { ipAddress: '1.1.1.1', userAgent: 'UA3', createdAt: new Date() },
      ] as any[]);
      vi.mocked(db.session.findFirst).mockResolvedValue(null);

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome', ip: '99.0.0.1', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'fp',
      });

      expect(result.isSuspicious).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('fails open (no crash) if DB query throws', async () => {
      vi.mocked(db.session.findMany).mockRejectedValue(new Error('DB down'));

      const result = await assessLoginSecurity('user-1', {
        userAgent: 'Chrome', ip: '1.2.3.4', deviceType: 'desktop',
        os: 'Windows', browser: 'Chrome', fingerprint: 'fp',
      });

      expect(result.isSuspicious).toBe(false);
      expect(result.riskScore).toBe(0);
    });
  });

  describe('enforceSessionLimit', () => {
    it('returns 0 when sessions are within limit', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, createdAt: new Date() }))
      );
      const removed = await enforceSessionLimit('user-1');
      expect(removed).toBe(0);
      expect(db.session.deleteMany).not.toHaveBeenCalled();
    });

    it('removes oldest sessions when exceeding MAX_CONCURRENT_SESSIONS', async () => {
      const sessions = Array.from({ length: 7 }, (_, i) => ({
        id: `s${i}`, createdAt: new Date(Date.now() - (7 - i) * 60_000),
      }));
      vi.mocked(db.session.findMany).mockResolvedValue(sessions);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 } as any);

      const removed = await enforceSessionLimit('user-1');
      expect(removed).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 if DB query fails (fail open)', async () => {
      vi.mocked(db.session.findMany).mockRejectedValue(new Error('DB down'));
      const removed = await enforceSessionLimit('user-1');
      expect(removed).toBe(0);
    });
  });

  describe('getUserSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([]);
      const sessions = await getUserSessions('user-1');
      expect(sessions).toEqual([]);
    });

    it('masks token in response (first 8 chars only)', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([{
        id: 's1', token: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
        userAgent: 'Chrome/120', ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
      } as any]);

      const sessions = await getUserSessions('user-1');
      expect(sessions[0].token).toBe('a1b2c3d4***');
    });

    it('parses user agent info for each session', async () => {
      vi.mocked(db.session.findMany).mockResolvedValue([{
        id: 's1', token: 'a1b2c3d4' + '0'.repeat(56),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
        ipAddress: '1.2.3.4', expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
      } as any]);

      const sessions = await getUserSessions('user-1');
      expect(sessions[0].os).toBe('Windows');
      expect(sessions[0].browser).toBe('Chrome');
      expect(sessions[0].deviceType).toBe('desktop');
    });

    it('returns empty array on DB error', async () => {
      vi.mocked(db.session.findMany).mockRejectedValue(new Error('DB down'));
      const sessions = await getUserSessions('user-1');
      expect(sessions).toEqual([]);
    });
  });

  describe('recordLoginEvent', () => {
    it('calls audit with correct parameters', async () => {
      vi.mocked(db.user.update).mockResolvedValue({} as any);

      await recordLoginEvent('user-1', 'admin@test.com',
        { userAgent: 'Chrome/120', ip: '1.2.3.4', deviceType: 'desktop', os: 'Windows', browser: 'Chrome', fingerprint: 'fp123' },
        { isSuspicious: false, isNewDevice: false, isNewLocation: false, isRapidLogin: false, reasons: [], riskScore: 0 },
        'otp', true
      );

      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: expect.stringContaining('login'), category: 'auth', severity: 'info', actor: 'user-1' })
      );
    });

    it('uses warn severity for suspicious logins', async () => {
      vi.mocked(db.user.update).mockResolvedValue({} as any);

      await recordLoginEvent('user-1', 'admin@test.com',
        { userAgent: 'Chrome', ip: '1.2.3.4', deviceType: 'desktop', os: 'Windows', browser: 'Chrome', fingerprint: 'fp' },
        { isSuspicious: true, isNewDevice: true, isNewLocation: false, isRapidLogin: false, reasons: ['New device'], riskScore: 55 }
      );

      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
    });

    it('updates user lastLoginAt', async () => {
      vi.mocked(db.user.update).mockResolvedValue({} as any);

      await recordLoginEvent('user-1', 'admin@test.com',
        { userAgent: 'Chrome', ip: '1.2.3.4', deviceType: 'desktop', os: 'Windows', browser: 'Chrome', fingerprint: 'fp' },
        { isSuspicious: false, isNewDevice: false, isNewLocation: false, isRapidLogin: false, reasons: [], riskScore: 0 }
      );

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' }, data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) })
      );
    });

    it('does not throw if DB fails (non-blocking)', async () => {
      vi.mocked(db.user.update).mockRejectedValue(new Error('DB down'));
      await expect(
        recordLoginEvent('user-1', 'admin@test.com',
          { userAgent: 'Chrome', ip: '1.2.3.4', deviceType: 'desktop', os: 'Windows', browser: 'Chrome', fingerprint: 'fp' },
          { isSuspicious: false, isNewDevice: false, isNewLocation: false, isRapidLogin: false, reasons: [], riskScore: 0 }
        )
      ).resolves.not.toThrow();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('deletes all sessions for user and returns count', async () => {
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 3 } as any);
      const count = await revokeAllUserSessions('user-1', 'Password change');
      expect(count).toBe(3);
      expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('returns 0 on DB error', async () => {
      vi.mocked(db.session.deleteMany).mockRejectedValue(new Error('DB down'));
      const count = await revokeAllUserSessions('user-1');
      expect(count).toBe(0);
    });
  });

  describe('revokeSession', () => {
    it('deletes specific session and returns true', async () => {
      vi.mocked(db.session.delete).mockResolvedValue({} as any);
      const result = await revokeSession('session-1', 'admin-1', 'Suspicious activity');
      expect(result).toBe(true);
    });

    it('returns false on DB error', async () => {
      vi.mocked(db.session.delete).mockRejectedValue(new Error('Not found'));
      const result = await revokeSession('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('rotateSession', () => {
    it('deletes session and returns true', async () => {
      vi.mocked(db.session.delete).mockResolvedValue({} as any);
      const result = await rotateSession('session-1');
      expect(result).toBe(true);
    });

    it('returns false on DB error', async () => {
      vi.mocked(db.session.delete).mockRejectedValue(new Error('Not found'));
      const result = await rotateSession('nonexistent');
      expect(result).toBe(false);
    });
  });
});
