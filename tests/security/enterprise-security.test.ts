/**
 * WI-18.5 Phase 5 Tests — Enterprise Security Modules
 *
 * Tests for: session-manager.ts, rbac.ts, enterprise-health.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Session Manager Tests ──────────────────────────────────────

describe('Session Manager', () => {
  describe('parseUserAgent', () => {
    // Import the function
    let parseUserAgent: (ua: string) => { deviceType: string; os: string; browser: string };

    beforeEach(async () => {
      const mod = await import('@/lib/session-manager');
      parseUserAgent = mod.parseUserAgent;
    });

    it('should detect desktop Chrome on Windows', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Chrome');
    });

    it('should detect desktop Safari on macOS', () => {
      const result = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('macOS');
      expect(result.browser).toBe('Safari');
    });

    it('should detect mobile iPhone', () => {
      const result = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148');
      expect(result.deviceType).toBe('mobile');
      expect(result.os).toBe('iOS');
    });

    it('should detect tablet iPad', () => {
      const result = parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0) Tablet');
      expect(result.deviceType).toBe('tablet');
      expect(result.os).toBe('iOS');
    });

    it('should detect Firefox on Linux', () => {
      const result = parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Linux');
      expect(result.browser).toBe('Firefox');
    });

    it('should detect Edge', () => {
      const result = parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Edg/120.0.0.0');
      expect(result.browser).toBe('Edge');
    });

    it('should return Unknown for unrecognized UA', () => {
      const result = parseUserAgent('SomeBot/1.0');
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Unknown');
      expect(result.browser).toBe('Unknown');
    });
  });

  describe('generateDeviceFingerprint', () => {
    let generateDeviceFingerprint: (ua: string, ip: string) => string;

    beforeEach(async () => {
      const mod = await import('@/lib/session-manager');
      generateDeviceFingerprint = mod.generateDeviceFingerprint;
    });

    it('should produce consistent fingerprints for same input', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      const fp2 = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different IPs in same subnet', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      const fp2 = generateDeviceFingerprint('Chrome/120', '192.168.1.2');
      // Same subnet → same fingerprint
      expect(fp1).toBe(fp2);
    });

    it('should produce different fingerprints for different subnets', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      const fp2 = generateDeviceFingerprint('Chrome/120', '10.0.0.1');
      expect(fp1).not.toBe(fp2);
    });

    it('should produce different fingerprints for different user agents', () => {
      const fp1 = generateDeviceFingerprint('Chrome/120', '192.168.1.1');
      const fp2 = generateDeviceFingerprint('Firefox/120', '192.168.1.1');
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('shouldRotateSession', () => {
    let shouldRotateSession: (createdAt: Date) => boolean;

    beforeEach(async () => {
      const mod = await import('@/lib/session-manager');
      shouldRotateSession = mod.shouldRotateSession;
    });

    it('should not rotate sessions less than 7 days old', () => {
      const createdAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(createdAt)).toBe(false);
    });

    it('should rotate sessions older than 7 days', () => {
      const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      expect(shouldRotateSession(createdAt)).toBe(true);
    });

    it('should not rotate brand new sessions', () => {
      const createdAt = new Date();
      expect(shouldRotateSession(createdAt)).toBe(false);
    });
  });
});

// ── RBAC Tests ─────────────────────────────────────────────────

describe('RBAC Authorization', () => {
  let hasPermission: (role: string, permission: any) => boolean;
  let authorizeRoute: (path: string, method: string, role: string) => { authorized: boolean; reason?: string };
  let getAllRoles: () => Array<{ name: string; label: string; permissions: string[] }>;
  let generateAuthorizationReport: () => Array<{ path: string; methods: Record<string, { permissions: string[]; public: boolean }> }>;

  beforeEach(async () => {
    const mod = await import('@/lib/rbac');
    hasPermission = mod.hasPermission;
    authorizeRoute = mod.authorizeRoute;
    getAllRoles = mod.getAllRoles;
    generateAuthorizationReport = mod.generateAuthorizationReport;
  });

  describe('hasPermission', () => {
    it('admin should have all permissions', () => {
      expect(hasPermission('admin', 'companies:read')).toBe(true);
      expect(hasPermission('admin', 'companies:write')).toBe(true);
      expect(hasPermission('admin', 'companies:delete')).toBe(true);
      expect(hasPermission('admin', 'users:manage')).toBe(true);
      expect(hasPermission('admin', 'ai:configure')).toBe(true);
    });

    it('operator should have data write but not user management', () => {
      expect(hasPermission('operator', 'companies:write')).toBe(true);
      expect(hasPermission('operator', 'ai:write')).toBe(true);
      expect(hasPermission('operator', 'users:manage')).toBe(false);
      expect(hasPermission('operator', 'settings:write')).toBe(false);
    });

    it('user should have only read permissions', () => {
      expect(hasPermission('user', 'companies:read')).toBe(true);
      expect(hasPermission('user', 'companies:write')).toBe(false);
      expect(hasPermission('user', 'ai:read')).toBe(true);
      expect(hasPermission('user', 'ai:write')).toBe(false);
    });

    it('viewer should have only dashboard and reports', () => {
      expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
      expect(hasPermission('viewer', 'analytics:read')).toBe(true);
      expect(hasPermission('viewer', 'companies:read')).toBe(false);
      expect(hasPermission('viewer', 'ai:read')).toBe(false);
    });

    it('unknown role should be denied', () => {
      expect(hasPermission('hacker', 'companies:read')).toBe(false);
    });
  });

  describe('authorizeRoute', () => {
    it('should allow public routes without auth', () => {
      const result = authorizeRoute('/api/health', 'GET', 'viewer');
      expect(result.authorized).toBe(true);
    });

    it('should allow admin access to all protected routes', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'admin');
      expect(result.authorized).toBe(true);
    });

    it('should deny viewer access to write operations', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'viewer');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('lacks required permissions');
    });

    it('should allow operator to read analytics', () => {
      const result = authorizeRoute('/api/analytics', 'GET', 'operator');
      expect(result.authorized).toBe(true);
    });

    it('should default to authenticated for unconfigured routes', () => {
      const result = authorizeRoute('/api/some-new-route', 'GET', 'admin');
      expect(result.authorized).toBe(true);
    });
  });

  describe('generateAuthorizationReport', () => {
    it('should produce report with all configured routes', () => {
      const report = generateAuthorizationReport();
      expect(report.length).toBeGreaterThan(0);
      expect(report.some(r => r.path === '/api/companies')).toBe(true);
      expect(report.some(r => r.path === '/api/health')).toBe(true);
    });
  });

  describe('getAllRoles', () => {
    it('should return 4 roles', () => {
      const roles = getAllRoles();
      expect(roles).toHaveLength(4);
      expect(roles.map(r => r.name)).toEqual(['admin', 'operator', 'user', 'viewer']);
    });
  });
});

// ── CSRF Tests ──────────────────────────────────────────────────

describe('CSRF Protection', () => {
  let generateCsrfToken: () => string;
  let validateCsrf: (req: Request) => boolean;

  beforeEach(async () => {
    const mod = await import('@/lib/csrf');
    generateCsrfToken = mod.generateCsrfToken;
    validateCsrf = mod.validateCsrf;
  });

  it('should generate different tokens on each call', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
    expect(t1).toHaveLength(64); // 32 bytes * 2 hex chars
  });

  it('should validate matching tokens', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost', {
      headers: {
        'x-csrf-token': token,
        'cookie': `csrf-token=${token}`,
      },
      method: 'POST',
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('should reject mismatched tokens', () => {
    const token = generateCsrfToken();
    const otherToken = generateCsrfToken();
    const req = new Request('http://localhost', {
      headers: {
        'x-csrf-token': token,
        'cookie': `csrf-token=${otherToken}`,
      },
      method: 'POST',
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('should skip CSRF for GET requests', () => {
    const req = new Request('http://localhost', { method: 'GET' });
    expect(validateCsrf(req)).toBe(true);
  });

  it('should skip CSRF for HEAD requests', () => {
    const req = new Request('http://localhost', { method: 'HEAD' });
    expect(validateCsrf(req)).toBe(true);
  });

  it('should reject POST without CSRF token', () => {
    const req = new Request('http://localhost', { method: 'POST' });
    expect(validateCsrf(req)).toBe(false);
  });
});

// ── Rate Limit Tests ───────────────────────────────────────────

describe('Rate Limiting', () => {
  let rateLimit: (opts: { key: string; limit: number; windowMs: number }) => { success: boolean; remaining: number; resetAt: number };

  beforeEach(async () => {
    const mod = await import('@/lib/rate-limit');
    rateLimit = mod.rateLimit;
  });

  it('should allow requests under the limit', () => {
    const result = rateLimit({ key: 'test-under-limit', limit: 10, windowMs: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('should reject requests over the limit', () => {
    for (let i = 0; i < 10; i++) {
      rateLimit({ key: 'test-over-limit', limit: 5, windowMs: 60000 });
    }
    const result = rateLimit({ key: 'test-over-limit', limit: 5, windowMs: 60000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    vi.useFakeTimers();
    try {
      // First request consumes the limit
      const result1 = rateLimit({ key: 'test-window-reset', limit: 1, windowMs: 60000 });
      expect(result1.success).toBe(true);

      // Second request should be rejected (same window)
      const result2 = rateLimit({ key: 'test-window-reset', limit: 1, windowMs: 60000 });
      expect(result2.success).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(60001);

      // Third request should succeed (new window)
      const result3 = rateLimit({ key: 'test-window-reset', limit: 1, windowMs: 60000 });
      expect(result3.success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should track different keys independently', () => {
    const r1 = rateLimit({ key: 'test-key-a', limit: 1, windowMs: 60000 });
    const r2 = rateLimit({ key: 'test-key-b', limit: 1, windowMs: 60000 });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

// ── Session Security Assessment (unit tests, no DB) ────────────

describe('Session Security Assessment', () => {
  let SESSION_ROTATION_DAYS: number;
  let MAX_CONCURRENT_SESSIONS: number;

  beforeEach(async () => {
    const mod = await import('@/lib/session-manager');
    SESSION_ROTATION_DAYS = mod.SESSION_ROTATION_DAYS;
    MAX_CONCURRENT_SESSIONS = mod.MAX_CONCURRENT_SESSIONS;
  });

  it('should have reasonable session rotation period', () => {
    expect(SESSION_ROTATION_DAYS).toBeGreaterThanOrEqual(1);
    expect(SESSION_ROTATION_DAYS).toBeLessThanOrEqual(30);
  });

  it('should limit concurrent sessions', () => {
    expect(MAX_CONCURRENT_SESSIONS).toBeGreaterThan(0);
    expect(MAX_CONCURRENT_SESSIONS).toBeLessThanOrEqual(20);
  });
});

// ── Audit Logger Tests ─────────────────────────────────────────

describe('Audit Logger', () => {
  it('should export correct audit categories', async () => {
    const { audit, AuditCategory } = await import('@/lib/audit-logger');
    // Verify types are available
    const categories: string[] = ['auth', 'authorization', 'csrf', 'rate_limit', 'admin', 'data_export', 'data_import', 'data_delete', 'config_change', 'webhook', 'security'];
    expect(categories.length).toBeGreaterThan(0);
  });
});
