import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrf, csrfMiddleware, CSRF_TOKEN_HEADER, CSRF_COOKIE_NAME } from '@/lib/csrf'

describe('CSRF Token Generation', () => {
  it('generates 64-char hex token', () => {
    const t = generateCsrfToken();
    expect(t).toHaveLength(64);
    expect(t).toMatch(/^[0-9a-f]+$/);
  });
  it('generates unique tokens', () => {
    const set = new Set(Array.from({length:100}, () => generateCsrfToken()));
    expect(set.size).toBe(100);
  });
});

describe('CSRF Safe Method Bypass', () => {
  ['GET','HEAD','OPTIONS'].forEach(method => {
    it(method + ' bypasses CSRF', () => {
      expect(validateCsrf(new Request('http://localhost/api/test', {method}))).toBe(true);
    });
  });
});

describe('CSRF Missing Token Detection', () => {
  it('POST without header rejected', () => {
    const req = new Request('http://localhost/api/test', {method:'POST', headers:{'content-type':'application/json'}});
    expect(validateCsrf(req)).toBe(false);
  });
  it('POST without cookie rejected', () => {
    const token = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {method:'POST', headers:{'content-type':'application/json', [CSRF_TOKEN_HEADER]:token}});
    expect(validateCsrf(req)).toBe(false);
  });
});

describe('CSRF Token Mismatch', () => {
  it('rejects mismatched tokens', () => {
    const h = generateCsrfToken(), c = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {method:'POST', headers:{[CSRF_TOKEN_HEADER]:h, cookie:CSRF_COOKIE_NAME+'='+c}});
    expect(validateCsrf(req)).toBe(false);
  });
  it('accepts matching tokens', () => {
    const t = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {method:'POST', headers:{[CSRF_TOKEN_HEADER]:t, cookie:CSRF_COOKIE_NAME+'='+t}});
    expect(validateCsrf(req)).toBe(true);
  });
});

describe('csrfMiddleware', () => {
  it('valid=true for matching tokens', () => {
    const t = generateCsrfToken();
    const req = new Request('http://localhost/api/test', {method:'POST', headers:{[CSRF_TOKEN_HEADER]:t, cookie:CSRF_COOKIE_NAME+'='+t}});
    const r = csrfMiddleware(req);
    expect(r.valid).toBe(true);
    expect(r.response).toBeUndefined();
  });
  it('returns 403 for missing token', () => {
    const req = new Request('http://localhost/api/test', {method:'POST'});
    const r = csrfMiddleware(req);
    expect(r.valid).toBe(false);
    expect(r.response?.status).toBe(403);
  });
});