/**
 * Unit Tests — CSRF Protection (csrf.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: generateCsrfToken, validateCsrf, csrfMiddleware, constant-time comparison
 */

import { describe, it, expect } from 'vitest';

describe('CSRF Protection (csrf.ts)', () => {
  let generateCsrfToken: any, validateCsrf: any, csrfMiddleware: any;
  let CSRF_TOKEN_HEADER: any, CSRF_COOKIE_NAME: any;
  beforeAll(async () => {
    const mod = await import('@/lib/csrf');
    generateCsrfToken = mod.generateCsrfToken;
    validateCsrf = mod.validateCsrf;
    csrfMiddleware = mod.csrfMiddleware;
    CSRF_TOKEN_HEADER = mod.CSRF_TOKEN_HEADER;
    CSRF_COOKIE_NAME = mod.CSRF_COOKIE_NAME;
  });

  it('generateCsrfToken produces a 64-character hex string', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateCsrfToken produces unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(100);
  });

  it('validateCsrf returns true for safe methods (GET) without any tokens', () => {
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf returns true for HEAD method', () => {
    const req = new Request('http://localhost/api/test', { method: 'HEAD' });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf returns true for OPTIONS method', () => {
    const req = new Request('http://localhost/api/test', { method: 'OPTIONS' });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf returns false for POST without tokens', () => {
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns false for PUT without tokens', () => {
    const req = new Request('http://localhost/api/test', { method: 'PUT' });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns false for DELETE without tokens', () => {
    const req = new Request('http://localhost/api/test', { method: 'DELETE' });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns true when header and cookie tokens match', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
        'cookie': `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrf(req)).toBe(true);
  });

  it('validateCsrf returns false when header and cookie tokens mismatch', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: 'a'.repeat(64),
        'cookie': `${CSRF_COOKIE_NAME}=${'b'.repeat(64)}`,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns false when header token is missing', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'cookie': `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns false when cookie token is missing', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('validateCsrf returns false when tokens have different lengths', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: 'a'.repeat(64),
        'cookie': `${CSRF_COOKIE_NAME}=${'b'.repeat(32)}`,
      },
    });
    expect(validateCsrf(req)).toBe(false);
  });

  it('csrfMiddleware returns valid:true and no response for safe methods', () => {
    const req = new Request('http://localhost/api/test', { method: 'GET' });
    const result = csrfMiddleware(req);
    expect(result.valid).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it('csrfMiddleware returns valid:false and 403 response for invalid CSRF', () => {
    const req = new Request('http://localhost/api/test', { method: 'POST' });
    const result = csrfMiddleware(req);
    expect(result.valid).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(403);
  });

  it('csrfMiddleware returns valid:true and no response for valid CSRF', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
        'cookie': `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    const result = csrfMiddleware(req);
    expect(result.valid).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it('CSRF comparison is constant-time (no early exit on first char mismatch)', () => {
    const token = 'a'.repeat(64);
    const cookie = 'b'.repeat(64);

    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
        'cookie': `${CSRF_COOKIE_NAME}=${cookie}`,
      },
    });

    const reqLastChar = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: {
        [CSRF_TOKEN_HEADER]: token,
        'cookie': `${CSRF_COOKIE_NAME}=${'a'.repeat(63)}b`,
      },
    });

    const t1 = performance.now();
    validateCsrf(req);
    const time1 = performance.now() - t1;

    const t2 = performance.now();
    validateCsrf(reqLastChar);
    const time2 = performance.now() - t2;

    const ratio = Math.max(time1, time2) / (Math.min(time1, time2) || 0.001);
    expect(ratio).toBeLessThan(100);
    expect(validateCsrf(req)).toBe(false);
    expect(validateCsrf(reqLastChar)).toBe(false);
  });
});
