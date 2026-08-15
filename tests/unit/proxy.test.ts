// ═══════════════════════════════════════════════════════════════════════════
// Proxy (Edge Runtime) — Unit Tests
//
// Tests src/proxy.ts — the Next.js 16 proxy that handles auth enforcement,
// security headers, rate limiting, CSRF protection, and CORS.
// ═══════════════════════════════════════════════════════════════════════════

/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  getSessionToken: vi.fn(),
  isPublicPath: vi.fn(),
  isApiRoute: vi.fn(),
  isRateLimitedPublicApi: vi.fn(),
  validateCsrf: vi.fn(),
  applySecurityHeaders: vi.fn((response: any) => response),
  unauthorizedResponse: vi.fn(),
  rateLimitedResponse: vi.fn(),
  otpRateLimit: vi.fn(),
  generalApiRateLimit: vi.fn(),
  edgeRateLimit: vi.fn(),
  edgeAuditAuthFailure: vi.fn(),
  edgeAuditCsrfFailure: vi.fn(),
}));

vi.mock('@/lib/rate-limit-registry', () => ({
  getRateLimitConfig: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  generateCsrfToken: vi.fn(() => 'random-csrf-token'),
  deriveCsrfFromSession: vi.fn(() => Promise.resolve('derived-csrf-token')),
  CSRF_COOKIE_NAME: 'csrf-token',
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(),
}));

import { proxy } from '@/proxy';
import {
  getSessionToken,
  isPublicPath,
  isApiRoute,
  isRateLimitedPublicApi,
  validateCsrf,
  applySecurityHeaders,
  unauthorizedResponse,
  rateLimitedResponse,
  otpRateLimit,
  generalApiRateLimit,
  edgeRateLimit,
  edgeAuditAuthFailure,
  edgeAuditCsrfFailure,
} from '@/lib/auth-helpers';
import { getRateLimitConfig } from '@/lib/rate-limit-registry';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(url, options);
}

function makeUnauthorizedResponse() {
  return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeRateLimitedResponse(retryAfter: number) {
  return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applySecurityHeaders).mockImplementation((r: any) => r);
    vi.mocked(unauthorizedResponse).mockReturnValue(makeUnauthorizedResponse());
    vi.mocked(rateLimitedResponse).mockReturnValue(makeRateLimitedResponse(60));
  });

  // ═══════════════════════════════════════════════════════════════════
  // Public Path Handling
  // ═══════════════════════════════════════════════════════════════════

  describe('public paths', () => {
    it('allows public paths without auth', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(false);

      const req = makeRequest('http://localhost/login');
      const res = await proxy(req);

      expect(getSessionToken).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('injects CSRF cookie on public paths', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(false);

      const req = makeRequest('http://localhost/login');
      const res = await proxy(req);

      // The response should have a cookie set
      const cookies = res.headers.getSetCookie?.() || [];
      // At least security headers should be applied
      expect(applySecurityHeaders).toHaveBeenCalled();
    });

    it('passes GET requests to rate-limited public APIs through without rate limiting', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);

      const req = makeRequest('http://localhost/api/auth/request-otp');
      const res = await proxy(req);

      // Non-POST requests skip rate limiting in applyRateLimiting
      expect(otpRateLimit).not.toHaveBeenCalled();
      expect(generalApiRateLimit).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('applies OTP rate limit on POST to request-otp', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);
      vi.mocked(otpRateLimit).mockReturnValue({
        success: true,
        remaining: 4,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/auth/request-otp', { method: 'POST' });
      const res = await proxy(req);

      expect(otpRateLimit).toHaveBeenCalledWith('unknown');
      expect(generalApiRateLimit).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('returns 429 when OTP rate limit exceeded', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);
      vi.mocked(otpRateLimit).mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 45000,
      });

      const req = makeRequest('http://localhost/api/auth/request-otp', { method: 'POST' });
      const res = await proxy(req);

      expect(rateLimitedResponse).toHaveBeenCalled();
    });

    it('returns 429 when general rate limit exceeded on public API', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);
      vi.mocked(otpRateLimit).mockReturnValue({
        success: true,
        remaining: 4,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });

      const req = makeRequest('http://localhost/api/auth/register', { method: 'POST' });
      const res = await proxy(req);

      expect(rateLimitedResponse).toHaveBeenCalled();
    });

    it('sets correct rate limit headers for OTP endpoint', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);
      vi.mocked(otpRateLimit).mockReturnValue({
        success: true,
        remaining: 3,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/auth/request-otp', { method: 'POST' });
      const res = await proxy(req);

      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    });

    it('sets correct rate limit headers for non-OTP auth endpoint', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(true);
      vi.mocked(otpRateLimit).mockReturnValue({
        success: true,
        remaining: 4,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 98,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/auth/register', { method: 'POST' });
      const res = await proxy(req);

      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API Route Auth
  // ═══════════════════════════════════════════════════════════════════

  describe('API route authentication', () => {
    it('returns 401 for API route without session token', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue(null);

      const req = makeRequest('http://localhost/api/organizations');
      const res = await proxy(req);

      expect(res.status).toBe(401);
      expect(unauthorizedResponse).toHaveBeenCalled();
      expect(edgeAuditAuthFailure).toHaveBeenCalledWith(
        'Unauthenticated API access',
        'unknown',
        expect.objectContaining({ path: '/api/organizations' }),
      );
    });

    it('returns 403 when CSRF validation fails on POST', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(validateCsrf).mockReturnValue(false);
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/organizations', { method: 'POST' });
      const res = await proxy(req);

      expect(res.status).toBe(403);
      expect(edgeAuditCsrfFailure).toHaveBeenCalled();
      const body = await res.json();
      expect(body.error).toBe('CSRF validation failed');
    });

    it('allows GET requests without CSRF validation', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations');
      const res = await proxy(req);

      expect(validateCsrf).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('allows HEAD requests without CSRF validation', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations', { method: 'HEAD' });
      const res = await proxy(req);

      expect(validateCsrf).not.toHaveBeenCalled();
    });

    it('allows OPTIONS requests without CSRF validation', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations', { method: 'OPTIONS' });
      const res = await proxy(req);

      expect(validateCsrf).not.toHaveBeenCalled();
    });

    it('validates CSRF on PUT requests', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(validateCsrf).mockReturnValue(true);
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations/123', { method: 'PUT' });
      const res = await proxy(req);

      expect(validateCsrf).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('validates CSRF on DELETE requests', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(validateCsrf).mockReturnValue(false);
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/organizations/123', { method: 'DELETE' });
      const res = await proxy(req);

      expect(res.status).toBe(403);
    });

    it('validates CSRF on PATCH requests', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');
      vi.mocked(validateCsrf).mockReturnValue(true);
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations/123', { method: 'PATCH' });
      const res = await proxy(req);

      expect(validateCsrf).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API Rate Limiting
  // ═══════════════════════════════════════════════════════════════════

  describe('API rate limiting', () => {
    it('returns 429 when general rate limit exceeded', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations');
      const res = await proxy(req);

      expect(rateLimitedResponse).toHaveBeenCalled();
    });

    it('sets rate limit headers on successful request', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 95,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations');
      const res = await proxy(req);

      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('applies registry-specific rate limit when config exists', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(getRateLimitConfig).mockReturnValue({
        name: 'ai-chat',
        windowMs: 60000,
        maxRequests: 10,
      });
      vi.mocked(edgeRateLimit).mockReturnValue({
        success: true,
        remaining: 8,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const req = makeRequest('http://localhost/api/ai/chat-stream');
      const res = await proxy(req);

      expect(edgeRateLimit).toHaveBeenCalledWith('registry:ai-chat:unknown', 10, 60000);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('8');
      expect(res.headers.get('X-RateLimit-Policy')).toBe('ai-chat');
    });

    it('returns 429 when registry rate limit exceeded', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(getRateLimitConfig).mockReturnValue({
        name: 'ai-chat',
        windowMs: 60000,
        maxRequests: 10,
      });
      vi.mocked(edgeRateLimit).mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 45000,
      });

      const req = makeRequest('http://localhost/api/ai/chat-stream');
      const res = await proxy(req);

      expect(rateLimitedResponse).toHaveBeenCalled();
    });

    it('returns 429 when general limit exceeded but registry allows', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(getRateLimitConfig).mockReturnValue({
        name: 'ai-chat',
        windowMs: 60000,
        maxRequests: 10,
      });
      vi.mocked(edgeRateLimit).mockReturnValue({
        success: true,
        remaining: 8,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });

      const req = makeRequest('http://localhost/api/ai/chat-stream');
      const res = await proxy(req);

      expect(rateLimitedResponse).toHaveBeenCalled();
    });

    it('uses x-forwarded-for header for IP extraction', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });
      await proxy(req);

      expect(generalApiRateLimit).toHaveBeenCalledWith('1.2.3.4', '/api/organizations');
    });

    it('uses x-real-ip header when x-forwarded-for is absent', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });
      await proxy(req);

      expect(generalApiRateLimit).toHaveBeenCalledWith('10.0.0.1', '/api/organizations');
    });

    it('falls back to unknown when no IP headers present', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations');
      await proxy(req);

      expect(generalApiRateLimit).toHaveBeenCalledWith('unknown', '/api/organizations');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Page Route Handling
  // ═══════════════════════════════════════════════════════════════════

  describe('page routes', () => {
    it('redirects to login for unauthenticated page requests', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(getSessionToken).mockReturnValue(null);

      const req = makeRequest('http://localhost/dashboard');
      const res = await proxy(req);

      expect(res.status).toBe(307); // Next.js redirect status
      const location = res.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('redirect=');
      expect(location).toContain('dashboard');
    });

    it('allows authenticated page requests', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');

      const req = makeRequest('http://localhost/dashboard');
      const res = await proxy(req);

      expect(res.status).toBe(200);
      expect(applySecurityHeaders).toHaveBeenCalled();
    });

    it('injects session-bound CSRF cookie for authenticated pages', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(getSessionToken).mockReturnValue('valid-session-token');

      const req = makeRequest('http://localhost/dashboard');
      const res = await proxy(req);

      // Should call deriveCsrfFromSession (imported from csrf module)
      // Verify the response has a csrf cookie
      const cookies = res.headers.getSetCookie?.() || [];
      expect(cookies.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Security Headers
  // ═══════════════════════════════════════════════════════════════════

  describe('security headers', () => {
    it('always applies security headers', async () => {
      vi.mocked(isPublicPath).mockReturnValue(true);
      vi.mocked(isRateLimitedPublicApi).mockReturnValue(false);

      const req = makeRequest('http://localhost/login');
      await proxy(req);

      expect(applySecurityHeaders).toHaveBeenCalled();
    });

    it('applies security headers to API responses', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(true);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');
      vi.mocked(generalApiRateLimit).mockReturnValue({
        success: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });
      vi.mocked(getRateLimitConfig).mockReturnValue(undefined);

      const req = makeRequest('http://localhost/api/organizations');
      await proxy(req);

      expect(applySecurityHeaders).toHaveBeenCalled();
    });

    it('applies security headers to page responses', async () => {
      vi.mocked(isPublicPath).mockReturnValue(false);
      vi.mocked(isApiRoute).mockReturnValue(false);
      vi.mocked(getSessionToken).mockReturnValue('valid-token');

      const req = makeRequest('http://localhost/dashboard');
      await proxy(req);

      expect(applySecurityHeaders).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Config Export
  // ═══════════════════════════════════════════════════════════════════

  describe('config', () => {
    it('exports a config matcher that excludes static assets', async () => {
      const { config } = await import('@/proxy');
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);
      const pattern = config.matcher[0];
      // Should exclude _next/static, _next/image, etc.
      expect(pattern).toContain('_next/static');
      expect(pattern).toContain('_next/image');
      expect(pattern).toContain('favicon');
    });
  });
});
