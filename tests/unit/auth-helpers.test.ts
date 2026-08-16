/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (must use vi.hoisted for variables referenced in vi.mock factories) ──

const { mockHeadersGet, mockHeadersSet } = vi.hoisted(() => {
  const mockHeadersGet = vi.fn();
  const mockHeadersSet = vi.fn();
  return { mockHeadersGet, mockHeadersSet };
});

vi.mock('next/server', () => {
  function MockNextRequest(this: any, url: string, init?: any) {
    this.url = url;
    this.headers = {
      get: mockHeadersGet,
      set: mockHeadersSet,
    };
    this.method = (init && init.method) || 'GET';
    this.nextUrl = { pathname: new URL(url).pathname };
  }

  function MockNextResponse(this: any, body?: any, init?: any) {
    this.status = (init && init.status) || 200;
    this.body = body;
    this.headers = new Map(Object.entries((init && init.headers) || {}));
  }
  MockNextResponse.json = function (data: any, init?: any) {
    return new (MockNextResponse as any)(data, init);
  };
  MockNextResponse.next = function () {
    return new (MockNextResponse as any)();
  };

  return {
    NextRequest: MockNextRequest as any,
    NextResponse: MockNextResponse as any,
  };
});

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(),
  CSRF_COOKIE_NAME: 'csrf-token',
  CSRF_TOKEN_HEADER: 'x-csrf-token',
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(),
}));

// Import after mocks
import {
  getSessionToken,
  isPublicPath,
  isApiRoute,
  isRateLimitedPublicApi,
  validateCsrf,
  csrfCheck,
  generateCspNonce,
  getSecurityHeaders,
  applySecurityHeaders,
  edgeRateLimit,
  otpRateLimit,
  generalApiRateLimit,
  distributedApiRateLimit,
  secureJsonResponse,
  unauthorizedResponse,
  rateLimitedResponse,
  forbiddenResponse,
  edgeAuditAuthFailure,
  edgeAuditCsrfFailure,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEADER,
  PUBLIC_PATH_PREFIXES,
  RATE_LIMITED_PUBLIC_APIS,
} from '@/lib/auth-helpers';
import { validateCsrf as csrfValidateCsrf } from '@/lib/csrf';
import { NextRequest } from 'next/server';

// ── Helpers ────────────────────────────────────────────────────────

function createMockRequest(
  url: string,
  cookieHeaders: Record<string, string> = {},
  method = 'GET',
) {
  mockHeadersGet.mockImplementation((key: string) => {
    return cookieHeaders[key] || null;
  });
  return new NextRequest(url, { method });
}

function createPlainResponse() {
  const headers = new Map<string, string>();
  return {
    headers: {
      set: (key: string, value: string) => headers.set(key, value),
      get: (key: string) => headers.get(key),
      has: (key: string) => headers.has(key),
    },
  };
}

// ── Constants ──────────────────────────────────────────────────────

describe('auth-helpers constants', () => {
  it('exports SESSION_COOKIE_NAME', () => {
    expect(SESSION_COOKIE_NAME).toBe('dmq_session');
  });

  it('re-exports CSRF_COOKIE_NAME', () => {
    expect(CSRF_COOKIE_NAME).toBe('csrf-token');
  });

  it('re-exports CSRF_TOKEN_HEADER', () => {
    expect(CSRF_TOKEN_HEADER).toBe('x-csrf-token');
  });

  it('has expected PUBLIC_PATH_PREFIXES', () => {
    expect(PUBLIC_PATH_PREFIXES).toContain('/api/auth/');
    expect(PUBLIC_PATH_PREFIXES).toContain('/login');
    expect(PUBLIC_PATH_PREFIXES).toContain('/api/health/');
    expect(PUBLIC_PATH_PREFIXES).toContain('/api/ping');
  });

  it('has expected RATE_LIMITED_PUBLIC_APIS', () => {
    expect(RATE_LIMITED_PUBLIC_APIS).toContain('/api/auth/request-otp');
    expect(RATE_LIMITED_PUBLIC_APIS).toContain('/api/auth/verify-otp');
  });
});

// ── getSessionToken ────────────────────────────────────────────────

describe('getSessionToken', () => {
  beforeEach(() => {
    mockHeadersGet.mockReset();
  });

  it('extracts session token from cookie header', () => {
    const token = 'test-session-token-abc123';
    const request = createMockRequest('http://localhost:3000/api/companies', {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    });
    expect(getSessionToken(request)).toBe(token);
  });

  it('returns null when no cookie header', () => {
    mockHeadersGet.mockReturnValue(null);
    const request = createMockRequest('http://localhost:3000/api/companies');
    expect(getSessionToken(request)).toBeNull();
  });

  it('returns null when session cookie is missing', () => {
    const request = createMockRequest('http://localhost:3000/api/companies', {
      cookie: 'other=value',
    });
    expect(getSessionToken(request)).toBeNull();
  });

  it('handles URL-encoded values', () => {
    const token = 'token%20with%20spaces';
    const request = createMockRequest('http://localhost:3000/api/companies', {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    });
    expect(getSessionToken(request)).toBe('token with spaces');
  });

  it('extracts token from cookie with multiple cookies', () => {
    const token = 'my-token';
    const request = createMockRequest('http://localhost:3000/api/companies', {
      cookie: `other=abc; ${SESSION_COOKIE_NAME}=${token}; another=xyz`,
    });
    expect(getSessionToken(request)).toBe(token);
  });
});

// ── isPublicPath ───────────────────────────────────────────────────

describe('isPublicPath', () => {
  it('returns true for exact prefix match', () => {
    expect(isPublicPath('/api/auth/login')).toBe(true);
  });

  it('returns true for prefix start match', () => {
    expect(isPublicPath('/api/auth/request-otp')).toBe(true);
  });

  it('returns true for prefix + trailing slash', () => {
    expect(isPublicPath('/api/auth/')).toBe(true);
  });

  it('returns true for root path', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('returns true for /login', () => {
    expect(isPublicPath('/login')).toBe(true);
  });

  it('returns true for /demo', () => {
    expect(isPublicPath('/demo')).toBe(true);
  });

  it('returns true for /api/ping', () => {
    expect(isPublicPath('/api/ping')).toBe(true);
  });

  it('returns true for /api/health', () => {
    expect(isPublicPath('/api/health')).toBe(true);
  });

  it('returns false for protected API routes', () => {
    expect(isPublicPath('/api/companies')).toBe(false);
    expect(isPublicPath('/api/contacts')).toBe(false);
    expect(isPublicPath('/api/opportunities')).toBe(false);
  });

  it('returns false for protected non-API routes', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/settings')).toBe(false);
  });

  it('returns true for _next static assets', () => {
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
    expect(isPublicPath('/_next/image?url=abc')).toBe(true);
    expect(isPublicPath('/_next/data/buildId/path.json')).toBe(true);
  });

  it('returns true for favicon', () => {
    expect(isPublicPath('/favicon.ico')).toBe(true);
  });
});

// ── isApiRoute ─────────────────────────────────────────────────────

describe('isApiRoute', () => {
  it('returns true for /api/ paths', () => {
    expect(isApiRoute('/api/companies')).toBe(true);
    expect(isApiRoute('/api/auth/login')).toBe(true);
  });

  it('returns false for non-api paths', () => {
    expect(isApiRoute('/dashboard')).toBe(false);
    expect(isApiRoute('/login')).toBe(false);
  });
});

// ── isRateLimitedPublicApi ────────────────────────────────────────

describe('isRateLimitedPublicApi', () => {
  it('returns true for rate-limited auth endpoints', () => {
    expect(isRateLimitedPublicApi('/api/auth/request-otp')).toBe(true);
    expect(isRateLimitedPublicApi('/api/auth/verify-otp')).toBe(true);
    expect(isRateLimitedPublicApi('/api/auth/login')).toBe(true);
    expect(isRateLimitedPublicApi('/api/auth/register')).toBe(true);
  });

  it('returns false for non rate-limited public endpoints', () => {
    expect(isRateLimitedPublicApi('/api/auth/me')).toBe(false);
    expect(isRateLimitedPublicApi('/api/companies')).toBe(false);
  });
});

// ── validateCsrf ──────────────────────────────────────────────────

describe('validateCsrf', () => {
  beforeEach(() => {
    mockHeadersGet.mockReset();
  });

  it('delegates to csrf.ts validateCsrf', () => {
    (csrfValidateCsrf as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const request = createMockRequest('http://localhost:3000/api/companies', {
      'x-csrf-token': 'abc',
    });
    expect(validateCsrf(request)).toBe(true);
    expect(csrfValidateCsrf).toHaveBeenCalledWith(request);
  });

  it('returns false when csrf.ts returns false', () => {
    (csrfValidateCsrf as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const request = createMockRequest('http://localhost:3000/api/companies');
    expect(validateCsrf(request)).toBe(false);
  });
});

// ── csrfCheck ─────────────────────────────────────────────────────

describe('csrfCheck', () => {
  beforeEach(() => {
    mockHeadersGet.mockReset();
  });

  it('returns valid:true when CSRF passes', () => {
    (csrfValidateCsrf as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const request = createMockRequest('http://localhost:3000/api/companies', {
      'x-csrf-token': 'abc',
    });
    const result = csrfCheck(request);
    expect(result.valid).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it('returns valid:false with 403 response when CSRF fails', () => {
    (csrfValidateCsrf as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const request = createMockRequest('http://localhost:3000/api/companies');
    const result = csrfCheck(request);
    expect(result.valid).toBe(false);
    expect(result.response).toBeDefined();
  });
});

// ── generateCspNonce ──────────────────────────────────────────────

describe('generateCspNonce', () => {
  it('generates a base64url-safe string of expected length', () => {
    const nonce = generateCspNonce();
    // btoa(16 bytes) = 24 base64 chars, minus 1 padding char = 22 after =+$
    // But slice(0, 24) keeps up to 24
    expect(nonce.length).toBeGreaterThanOrEqual(20);
    expect(nonce.length).toBeLessThanOrEqual(24);
  });

  it('generates different values on each call', () => {
    const nonce1 = generateCspNonce();
    const nonce2 = generateCspNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it('uses only base64url-safe characters', () => {
    const nonce = generateCspNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ── getSecurityHeaders ────────────────────────────────────────────

describe('getSecurityHeaders', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns all required security headers', () => {
    const headers = getSecurityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('includes CSP header', () => {
    const headers = getSecurityHeaders();
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('adds nonce to script-src when provided', () => {
    const nonce = 'test-nonce-123';
    const headers = getSecurityHeaders(nonce);
    expect(headers['Content-Security-Policy']).toContain(`'nonce-${nonce}'`);
  });

  it('includes unsafe-eval in development mode', () => {
    process.env.NODE_ENV = 'development';
    const headers = getSecurityHeaders();
    expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'");
  });

  it('excludes unsafe-eval in production mode', () => {
    process.env.NODE_ENV = 'production';
    const headers = getSecurityHeaders();
    expect(headers['Content-Security-Policy']).not.toContain("'unsafe-eval'");
  });
});

// ── applySecurityHeaders ──────────────────────────────────────────

describe('applySecurityHeaders', () => {
  it('sets security headers on a response', () => {
    const plainResp = createPlainResponse();
    const result = applySecurityHeaders(plainResp as any);
    expect(plainResp.headers.has('X-Content-Type-Options')).toBe(true);
    expect(plainResp.headers.has('Content-Security-Policy')).toBe(true);
    expect(plainResp.headers.has('x-csp-nonce')).toBe(true);
    const nonce = plainResp.headers.get('x-csp-nonce')!;
    expect(nonce!.length).toBeGreaterThanOrEqual(20);
  });

  it('returns the same response object', () => {
    const plainResp = createPlainResponse();
    const result = applySecurityHeaders(plainResp as any);
    expect(result).toBe(plainResp);
  });
});

// ── edgeRateLimit ─────────────────────────────────────────────────

describe('edgeRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns success:true for first request under limit', () => {
    const result = edgeRateLimit('unique-key-first', 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks remaining requests correctly', () => {
    edgeRateLimit('unique-key-tracking', 3, 60_000);
    edgeRateLimit('unique-key-tracking', 3, 60_000);
    const result = edgeRateLimit('unique-key-tracking', 3, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('returns success:false when limit exceeded', () => {
    edgeRateLimit('unique-key-exceed', 2, 60_000);
    edgeRateLimit('unique-key-exceed', 2, 60_000);
    const result = edgeRateLimit('unique-key-exceed', 2, 60_000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    const result1 = edgeRateLimit('unique-key-reset', 1, 60_000);
    expect(result1.success).toBe(true);

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    const result2 = edgeRateLimit('unique-key-reset', 1, 60_000);
    expect(result2.success).toBe(true);
  });

  it('resets remaining to 0 (never negative)', () => {
    edgeRateLimit('unique-key-neg', 1, 60_000);
    const result = edgeRateLimit('unique-key-neg', 1, 60_000);
    expect(result.remaining).toBe(0);
  });

  it('isolates keys from each other', () => {
    const resultA = edgeRateLimit('key-a-isolated', 1, 60_000);
    const resultB = edgeRateLimit('key-b-isolated', 1, 60_000);
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
  });
});

// ── otpRateLimit ─────────────────────────────────────────────────

describe('otpRateLimit', () => {
  it('uses edgeRateLimit with otp: prefix and limit of 5', () => {
    const result = otpRateLimit('unique-otp@example.com');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('normalizes email to lowercase in key', () => {
    otpRateLimit('CaseTest@example.COM');
    const result = otpRateLimit('casetest@example.com');
    expect(result.remaining).toBe(3);
  });
});

// ── generalApiRateLimit ──────────────────────────────────────────

describe('generalApiRateLimit', () => {
  it('uses edgeRateLimit with api: prefix and limit of 100', () => {
    const result = generalApiRateLimit('192.168.1.1', '/api/companies');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('uses different keys for different IPs', () => {
    generalApiRateLimit('1.1.1.1-diff', '/api/companies');
    const result = generalApiRateLimit('2.2.2.2-diff', '/api/companies');
    expect(result.remaining).toBe(99);
  });
});

// ── distributedApiRateLimit ───────────────────────────────────────

describe('distributedApiRateLimit', () => {
  it('calls the distributed module and returns a result with backend', async () => {
    const result = await distributedApiRateLimit('1.2.3.4-dist', '/api/test-dist');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('backend');
    expect(typeof result.backend).toBe('string');
  });
});

// ── Response Helpers ───────────────────────────────────────────────

describe('secureJsonResponse', () => {
  it('creates a JSON response with security headers', () => {
    const resp = secureJsonResponse({ success: true });
    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ success: true });
    expect(resp.headers.has('X-Content-Type-Options')).toBe(true);
  });

  it('accepts custom status codes', () => {
    const resp = secureJsonResponse({ created: true }, 201);
    expect(resp.status).toBe(201);
  });
});

describe('unauthorizedResponse', () => {
  it('returns 401 response with error body', () => {
    const resp = unauthorizedResponse();
    expect(resp.status).toBe(401);
    expect(resp.body.success).toBe(false);
    expect(resp.body.error).toBe('Authentication required');
    expect(resp.body.timestamp).toBeDefined();
  });
});

describe('rateLimitedResponse', () => {
  it('returns 429 response with body and headers', () => {
    const resp = rateLimitedResponse();
    expect(resp).toBeDefined();
    expect(resp.status).toBe(429);
    expect(resp.body).toBeDefined();
    // applySecurityHeaders sets CSP and other headers
    expect(resp.headers.has('Content-Security-Policy')).toBe(true);
  });

  it('accepts custom retry-after', () => {
    const resp = rateLimitedResponse(120);
    expect(resp).toBeDefined();
    expect(resp.status).toBe(429);
  });
});

describe('forbiddenResponse', () => {
  it('returns 403 response with default message', () => {
    const resp = forbiddenResponse();
    expect(resp.status).toBe(403);
    expect(resp.body.error).toBe('Forbidden');
  });

  it('accepts custom message', () => {
    const resp = forbiddenResponse('Custom forbidden message');
    expect(resp.body.error).toBe('Custom forbidden message');
  });
});

// ── Edge Audit Helpers ────────────────────────────────────────────

describe('edgeAuditAuthFailure', () => {
  it('logs a warning with action, ip, and extras', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    edgeAuditAuthFailure('login_failed', '1.2.3.4', { email: 'test@example.com' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[AUDIT:AUTH] login_failed',
      expect.objectContaining({ ip: '1.2.3.4', action: 'login_failed', email: 'test@example.com' }),
    );
    warnSpy.mockRestore();
  });

  it('works without extras', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    edgeAuditAuthFailure('token_expired', '5.6.7.8');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AUDIT:AUTH] token_expired',
      expect.objectContaining({ ip: '5.6.7.8', action: 'token_expired' }),
    );
    warnSpy.mockRestore();
  });
});

describe('edgeAuditCsrfFailure', () => {
  it('logs a warning with ip, path, and method', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    edgeAuditCsrfFailure('1.2.3.4', '/api/companies', 'POST');
    expect(warnSpy).toHaveBeenCalledWith('[AUDIT:CSRF] CSRF validation failed', {
      ip: '1.2.3.4',
      path: '/api/companies',
      method: 'POST',
    });
    warnSpy.mockRestore();
  });
});
