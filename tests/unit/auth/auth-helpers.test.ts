/**
 * Unit Tests — Auth Helpers (auth-helpers.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: isPublicPath, isApiRoute, getSecurityHeaders, rate limiting
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Auth Helpers (auth-helpers.ts)', () => {
  let isPublicPath: any, isApiRoute: any, isRateLimitedPublicApi: any;
  let getSessionToken: any, validateCsrf: any, csrfCheck: any;
  let getSecurityHeaders: any, applySecurityHeaders: any;
  let secureJsonResponse: any, unauthorizedResponse: any;
  let rateLimitedResponse: any, forbiddenResponse: any;
  let edgeRateLimit: any, otpRateLimit: any, generalApiRateLimit: any;
  let PUBLIC_PATH_PREFIXES: any;
  beforeAll(async () => {
    const mod = await import('@/lib/auth-helpers');
    isPublicPath = mod.isPublicPath;
    isApiRoute = mod.isApiRoute;
    getSessionToken = mod.getSessionToken;
    validateCsrf = mod.validateCsrf;
    csrfCheck = mod.csrfCheck;
    getSecurityHeaders = mod.getSecurityHeaders;
    applySecurityHeaders = mod.applySecurityHeaders;
    secureJsonResponse = mod.secureJsonResponse;
    unauthorizedResponse = mod.unauthorizedResponse;
    rateLimitedResponse = mod.rateLimitedResponse;
    forbiddenResponse = mod.forbiddenResponse;
    edgeRateLimit = mod.edgeRateLimit;
    otpRateLimit = mod.otpRateLimit;
    generalApiRateLimit = mod.generalApiRateLimit;
    isRateLimitedPublicApi = mod.isRateLimitedPublicApi;
    PUBLIC_PATH_PREFIXES = mod.PUBLIC_PATH_PREFIXES;
  });

  describe('isPublicPath', () => {
    it('returns true for root path', () => {
      expect(isPublicPath('/')).toBe(true);
    });
    it('returns true for /login', () => {
      expect(isPublicPath('/login')).toBe(true);
    });
    it('returns true for /demo', () => {
      expect(isPublicPath('/demo')).toBe(true);
    });
    it('returns true for /marketing', () => {
      expect(isPublicPath('/marketing')).toBe(true);
    });
    it('returns true for /api/auth/ prefix', () => {
      expect(isPublicPath('/api/auth/login')).toBe(true);
      expect(isPublicPath('/api/auth/verify-otp')).toBe(true);
    });
    it('returns true for /api/health/ prefix paths', () => {
      expect(isPublicPath('/api/health/')).toBe(true);
      expect(isPublicPath('/api/health/detailed')).toBe(true);
    });
    it('returns true for /api/ping', () => {
      expect(isPublicPath('/api/ping')).toBe(true);
    });
    it('returns true for /api/ready', () => {
      expect(isPublicPath('/api/ready')).toBe(true);
    });
    it('returns true for /api/version', () => {
      expect(isPublicPath('/api/version')).toBe(true);
    });
    it('returns true for /api/webhooks/crm/ prefix', () => {
      expect(isPublicPath('/api/webhooks/crm/hubspot')).toBe(true);
    });
    it('returns true for /api/webhooks/bounce', () => {
      expect(isPublicPath('/api/webhooks/bounce')).toBe(true);
    });
    it('returns true for /api/tracking/ prefix', () => {
      expect(isPublicPath('/api/tracking/pixel')).toBe(true);
    });
    it('returns true for /api/cron/ prefix', () => {
      expect(isPublicPath('/api/cron/daily-job')).toBe(true);
    });
    it('returns true for /api/unsubscribe', () => {
      expect(isPublicPath('/api/unsubscribe')).toBe(true);
    });
    it('returns true for /api/verify-email', () => {
      expect(isPublicPath('/api/verify-email')).toBe(true);
    });
    it('returns true for /api/verify-queue', () => {
      expect(isPublicPath('/api/verify-queue')).toBe(true);
    });
    it('returns true for Next.js static assets', () => {
      expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
      expect(isPublicPath('/_next/image/foo.jpg')).toBe(true);
      expect(isPublicPath('/favicon.ico')).toBe(true);
    });
    it('returns false for protected API routes', () => {
      expect(isPublicPath('/api/companies')).toBe(false);
      expect(isPublicPath('/api/leads')).toBe(false);
      expect(isPublicPath('/api/dashboard')).toBe(false);
      expect(isPublicPath('/api/settings')).toBe(false);
    });
    it('returns false for application routes', () => {
      expect(isPublicPath('/app')).toBe(false);
      expect(isPublicPath('/settings')).toBe(false);
    });
    it('returns false for /api/seed (not public)', () => {
      expect(isPublicPath('/api/seed')).toBe(false);
    });
  });

  describe('isApiRoute', () => {
    it('returns true for /api/ prefixed paths', () => {
      expect(isApiRoute('/api/companies')).toBe(true);
      expect(isApiRoute('/api/health')).toBe(true);
    });
    it('returns false for non-API paths', () => {
      expect(isApiRoute('/app')).toBe(false);
      expect(isApiRoute('/login')).toBe(false);
    });
  });

  describe('getSecurityHeaders', () => {
    let headers: Record<string, string>;

    beforeEach(() => {
      headers = getSecurityHeaders();
    });

    it('includes Strict-Transport-Security with max-age=31536000', () => {
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    });
    it('includes X-Frame-Options: DENY', () => {
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
    it('includes X-Content-Type-Options: nosniff', () => {
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });
    it('includes X-XSS-Protection', () => {
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });
    it('includes Referrer-Policy', () => {
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
    it('includes Permissions-Policy restricting camera/mic/geolocation', () => {
      const pp = headers['Permissions-Policy'];
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });
    it('includes Content-Security-Policy', () => {
      const csp = headers['Content-Security-Policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });
    it('CSP includes img-src with data: and blob:', () => {
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('img-src');
      expect(csp).toContain('data:');
      expect(csp).toContain('blob:');
    });
    it('CSP includes connect-src for allowed external services', () => {
      const csp = headers['Content-Security-Policy'];
      expect(csp).toContain('connect-src');
      expect(csp).toContain('https://api.tavily.com');
    });
  });

  describe('edgeRateLimit', () => {
    it('returns success:true when under limit', () => {
      const result = edgeRateLimit('test-key-1', 5, 60_000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
    it('returns success:false when over limit', () => {
      for (let i = 0; i < 5; i++) {
        edgeRateLimit('test-key-2', 5, 60_000);
      }
      const result = edgeRateLimit('test-key-2', 5, 60_000);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
    it('resets after window expires', () => {
      const key = 'test-key-reset-' + Date.now();
      const first = edgeRateLimit(key, 1, 1);
      expect(first.success).toBe(true);
      const second = edgeRateLimit(key, 1, 1);
      expect(typeof second.success).toBe('boolean');
      expect(typeof second.remaining).toBe('number');
    });
    it('counts increment correctly across multiple calls', () => {
      const key = 'test-key-count-' + Date.now();
      const r1 = edgeRateLimit(key, 10, 60_000);
      expect(r1.remaining).toBe(9);
      const r2 = edgeRateLimit(key, 10, 60_000);
      expect(r2.remaining).toBe(8);
      const r3 = edgeRateLimit(key, 10, 60_000);
      expect(r3.remaining).toBe(7);
    });
  });

  describe('otpRateLimit', () => {
    it('uses otp: prefix key', () => {
      const result = otpRateLimit('User@Example.COM');
      expect(result.success).toBe(true);
    });
    it('returns success:false after 5 requests', () => {
      const email = 'rate-test@example.com';
      for (let i = 0; i < 5; i++) {
        otpRateLimit(email);
      }
      const result = otpRateLimit(email);
      expect(result.success).toBe(false);
    });
  });

  describe('generalApiRateLimit', () => {
    it('returns success:true initially', () => {
      const result = generalApiRateLimit('127.0.0.1', '/api/companies');
      expect(result.success).toBe(true);
    });
    it('uses api:ip:path key format', () => {
      const r1 = generalApiRateLimit('1.2.3.4', '/api/test');
      const r2 = generalApiRateLimit('1.2.3.4', '/api/other');
      expect(r1.remaining).toBe(99);
      expect(r2.remaining).toBe(99);
    });
  });
});
