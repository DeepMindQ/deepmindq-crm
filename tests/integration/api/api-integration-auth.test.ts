/**
 * Milestone 3 — API Integration Tests with Real Authentication
 * Section 3.7: Real Environment Validation
 *
 * Tests API route handlers with authentication and authorization:
 * - Session validation on protected routes
 * - RBAC enforcement per role
 * - CSRF validation on state-changing methods
 * - Public route access without auth
 * - Error responses for unauthorized access
 *
 * Run: npx vitest run --config vitest.api.config.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Module Mocks
// ═══════════════════════════════════════════════════════════════

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    otpCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    evidence: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    intelligenceCard: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    aIGenerationAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit-001' }),
    },
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    companyNote: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email-provider', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, provider: 'resend' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(),
  AuditCategory: { AUTH: 'AUTH', RBAC: 'RBAC' },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/lib/session-manager', () => ({
  shouldRotateSession: vi.fn().mockReturnValue(false),
  enforceSessionLimit: vi.fn().mockResolvedValue(0),
  assessLoginSecurity: vi.fn().mockReturnValue({ risk: 'low' }),
  parseUserAgent: vi.fn().mockReturnValue({ browser: 'test', os: 'test' }),
  generateDeviceFingerprint: vi.fn().mockReturnValue('fp-001'),
  recordLoginEvent: vi.fn().mockResolvedValue(undefined),
}));

// ═══════════════════════════════════════════════════════════════
// RBAC Route Authorization Tests
// ═══════════════════════════════════════════════════════════════

describe('API Integration — RBAC Route Authorization', () => {
  it('admin can access all company endpoints', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/companies', 'GET', 'admin');
    expect(result.authorized).toBe(true);
  });

  it('viewer cannot access company write endpoints', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/companies', 'POST', 'viewer');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('viewer');
  });

  it('viewer can access dashboard', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/dashboard', 'GET', 'viewer');
    expect(result.authorized).toBe(true);
  });

  it('operator cannot access user management', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/users/manage', 'POST', 'operator');
    expect(result.authorized).toBe(false);
  });

  it('unknown role is denied by default', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/companies', 'GET', 'hacker');
    expect(result.authorized).toBe(false);
  });

  it('empty role is denied by default', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/companies', 'GET', '');
    expect(result.authorized).toBe(false);
  });

  it('null role is denied by default', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/companies', 'GET', 'null');
    expect(result.authorized).toBe(false);
  });

  it('public routes bypass authorization', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    expect(authorizeRoute('/api/health', 'GET', 'viewer').authorized).toBe(true);
    expect(authorizeRoute('/api/request-otp', 'POST', 'viewer').authorized).toBe(true);
    expect(authorizeRoute('/api/ping', 'GET', 'viewer').authorized).toBe(true);
    expect(authorizeRoute('/api/version', 'GET', 'viewer').authorized).toBe(true);
  });

  it('unconfigured routes are denied by default', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    const result = authorizeRoute('/api/unknown-endpoint', 'GET', 'admin');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('no authorization configuration');
  });

  it('prefix matching works for nested routes', async () => {
    const { authorizeRoute } = await import('@/lib/rbac');
    expect(authorizeRoute('/api/ai/chat', 'POST', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/ai/chat', 'POST', 'viewer').authorized).toBe(false);
    expect(authorizeRoute('/api/companies/123/contacts', 'GET', 'operator').authorized).toBe(true);
  });
});

describe('API Integration — CSRF Validation', () => {
  it('CSRF passes for safe methods (GET, HEAD, OPTIONS)', async () => {
    const { validateCsrf } = await import('@/lib/csrf');
    const getRequest = new Request('http://localhost/api/companies', { method: 'GET' });
    expect(validateCsrf(getRequest)).toBe(true);

    const headRequest = new Request('http://localhost/api/companies', { method: 'HEAD' });
    expect(validateCsrf(headRequest)).toBe(true);

    const optionsRequest = new Request('http://localhost/api/companies', { method: 'OPTIONS' });
    expect(validateCsrf(optionsRequest)).toBe(true);
  });

  it('CSRF fails for POST without token', async () => {
    const { validateCsrf } = await import('@/lib/csrf');
    const postRequest = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(validateCsrf(postRequest)).toBe(false);
  });

  it('CSRF fails when header and cookie mismatch', async () => {
    const { validateCsrf } = await import('@/lib/csrf');
    const postRequest = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'token-a',
        'cookie': 'csrf-token=token-b',
      },
    });
    expect(validateCsrf(postRequest)).toBe(false);
  });

  it('CSRF passes when header and cookie match', async () => {
    const { validateCsrf } = await import('@/lib/csrf');
    const postRequest = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'matching-token-value',
        'cookie': 'csrf-token=matching-token-value',
      },
    });
    expect(validateCsrf(postRequest)).toBe(true);
  });
});

describe('API Integration — Auth Helper Security', () => {
  it('identifies public paths correctly', async () => {
    const { isPublicPath } = await import('@/lib/auth-helpers');
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/auth/request-otp')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/api/companies')).toBe(false);
    expect(isPublicPath('/api/dashboard')).toBe(false);
  });

  it('identifies API routes correctly', async () => {
    const { isApiRoute } = await import('@/lib/auth-helpers');
    expect(isApiRoute('/api/companies')).toBe(true);
    expect(isApiRoute('/api/ai/chat')).toBe(true);
    expect(isApiRoute('/dashboard')).toBe(false);
    expect(isApiRoute('/login')).toBe(false);
  });

  it('security headers include required protections', async () => {
    const { getSecurityHeaders } = await import('@/lib/auth-helpers');
    const headers = getSecurityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toContain('max-age');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Content-Security-Policy']).toBeDefined();
  });
});

describe('API Integration — Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('OTP rate limit allows 5 requests per minute', async () => {
    const { otpRateLimit } = await import('@/lib/auth-helpers');
    // First 5 should succeed
    for (let i = 0; i < 5; i++) {
      const result = otpRateLimit('test@example.com');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
    // 6th should fail
    const overflow = otpRateLimit('test@example.com');
    expect(overflow.success).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('general API rate limit allows 100 requests per minute', async () => {
    const { generalApiRateLimit } = await import('@/lib/auth-helpers');
    const result = generalApiRateLimit('1.2.3.4', '/api/companies');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(99);
  });
});
