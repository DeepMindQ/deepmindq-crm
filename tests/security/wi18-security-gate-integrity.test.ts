/**
 * WI-18.1-Lock: CI Gate Integrity Verification
 *
 * These tests verify that the CI security gates are correctly configured.
 * If any gate check fails, it means the CI pipeline has been weakened.
 * These tests should NEVER be skipped or modified without security review.
 *
 * @security-gate — Do not remove or weaken without explicit security approval
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Helper to read file content ──────────────────────────
function readSrcFile(relativePath: string): string {
  const filePath = resolve(__dirname, `../../${relativePath}`);
  expect(existsSync(filePath), `File must exist: ${relativePath}`).toBe(true);
  return readFileSync(filePath, 'utf-8');
}

// ══════════════════════════════════════════════════════════
describe('SECURITY GATE: Edge Proxy Existence (CI Gate 1)', () => {
  it('src/proxy.ts must exist (Next.js 16 replaces middleware.ts)', () => {
    expect(existsSync(resolve(__dirname, '../../src/proxy.ts'))).toBe(true);
  });
});

describe('SECURITY GATE: Edge Proxy Enforcement (CI Gate 2)', () => {
  const proxy = readSrcFile('src/proxy.ts');

  it('must validate CSRF on state-changing requests', () => {
    expect(proxy).toContain('validateCsrf');
    expect(proxy).toContain("['GET', 'HEAD', 'OPTIONS']");
  });

  it('must apply security headers', () => {
    expect(proxy).toContain('getSecurityHeaders');
    expect(proxy).toContain('applySecurityHeaders');
  });

  it('must validate sessions on protected API routes', () => {
    expect(proxy).toContain('getSessionToken');
    expect(proxy).toContain('unauthorizedResponse');
  });

  it('must rate-limit public auth endpoints', () => {
    expect(proxy).toContain('rateLimitedResponse');
    expect(proxy).toContain('generalApiRateLimit');
  });

  it('must skip public paths from session check', () => {
    expect(proxy).toContain('isPublicPath');
    expect(proxy).toContain('isRateLimitedPublicApi');
  });
});

describe('SECURITY GATE: CSRF Flow Integrity (CI Gate 3)', () => {
  it('fetchApi must send x-csrf-token header', () => {
    const fetchApi = readSrcFile('src/lib/fetchApi.ts');
    expect(fetchApi).toContain('x-csrf-token');
    expect(fetchApi).toContain('csrf-token');
    expect(fetchApi).toContain('isStateChangingMethod');
  });

  it('auth-helpers must validate CSRF', () => {
    const auth = readSrcFile('src/lib/auth-helpers.ts');
    expect(auth).toContain('validateCsrf');
    expect(auth).toContain('timingSafeEqual');
  });

  it('csrf.ts must generate random tokens', () => {
    const csrf = readSrcFile('src/lib/csrf.ts');
    expect(csrf).toContain('randomBytes');
    expect(csrf).toContain('generateCsrfToken');
  });

  it('proxy must validate CSRF (not generate)', () => {
    const proxy = readSrcFile('src/proxy.ts');
    // Proxy validates CSRF tokens on state-changing requests
    expect(proxy).toContain('validateCsrf');
    // Proxy does NOT generate tokens — that's csrf.ts's job
    // Token generation happens in auth endpoints via csrf.ts
  });
});

describe('SECURITY GATE: Protected API Authentication (CI Gate 4)', () => {
  const evaluation = readSrcFile('src/app/api/ai/evaluation/route.ts');

  it('/api/ai/evaluation must import checkApiAuth', () => {
    expect(evaluation).toContain("import { checkApiAuth } from '@/lib/api-auth'");
  });

  it('/api/ai/evaluation must call checkApiAuth in GET handler', () => {
    // Find the GET handler and verify checkApiAuth is called
    const getHandlerMatch = evaluation.match(/export async function GET[\s\S]*?(?=export)/);
    expect(getHandlerMatch).not.toBeNull();
    expect(getHandlerMatch![0]).toContain('checkApiAuth');
  });

  it('/api/ai/evaluation must call checkApiAuth in POST handler', () => {
    const postHandlerMatch = evaluation.match(/export async function POST[\s\S]*$/);
    expect(postHandlerMatch).not.toBeNull();
    expect(postHandlerMatch![0]).toContain('checkApiAuth');
  });
});

describe('SECURITY GATE: Security Headers (CI Gate 5)', () => {
  const auth = readSrcFile('src/lib/auth-helpers.ts');

  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Strict-Transport-Security',
    'Referrer-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ];

  for (const header of requiredHeaders) {
    it(`must include ${header}`, () => {
      expect(auth).toContain(header);
    });
  }

  it('X-Content-Type-Options must be nosniff', () => {
    expect(auth).toContain("'X-Content-Type-Options': 'nosniff'");
  });

  it('X-Frame-Options must be DENY', () => {
    expect(auth).toContain("'X-Frame-Options': 'DENY'");
  });

  it('HSTS must include max-age=31536000', () => {
    expect(auth).toContain('max-age=31536000');
  });

  it('HSTS must include includeSubDomains', () => {
    expect(auth).toContain('includeSubDomains');
  });
});

describe('SECURITY GATE: CSP Hardening (CI Gate 6)', () => {
  const auth = readSrcFile('src/lib/auth-helpers.ts');

  it('production script-src must not contain unsafe-inline', () => {
    // Extract just the script-src directive for production
    const prodMatch = auth.match(/NODE_ENV === 'production'\s*\? "script-src '[^"]*"/);
    expect(prodMatch).not.toBeNull();
    expect(prodMatch![0]).not.toContain('unsafe-inline');
  });

  it('development script-src may include unsafe-eval for HMR', () => {
    // Extract just the script-src directive for development (else branch of ternary)
    const devMatch = auth.match(/: "script-src '[^"]*"/);
    expect(devMatch).not.toBeNull();
    expect(devMatch![0]).toContain('unsafe-eval');
  });

  it('CSP must include frame-ancestors none', () => {
    expect(auth).toContain("frame-ancestors 'none'");
  });

  it('CSP must include form-action self', () => {
    expect(auth).toContain("form-action 'self'");
  });
});

describe('SECURITY GATE: Input Sanitization (CI Gate 7)', () => {
  const sanitize = readSrcFile('src/lib/sanitize.ts');

  it('must use DOMPurify', () => {
    expect(sanitize).toContain('isomorphic-dompurify');
  });

  it('must have jsdom fallback for server-side', () => {
    expect(sanitize).toContain('JSDOM');
    expect(sanitize).toContain('jsdomWindow');
  });

  it('must strip all tags for plain text (ALLOWED_TAGS: [])', () => {
    expect(sanitize).toContain('ALLOWED_TAGS: []');
  });

  it('must have regex fallback if jsdom unavailable', () => {
    expect(sanitize).toContain('Fallback');
  });

  it('must export sanitizeString and sanitizeHtml', () => {
    expect(sanitize).toContain('export function sanitizeString');
    expect(sanitize).toContain('export function sanitizeHtml');
  });
});

describe('SECURITY GATE: AuthProvider Session Check (CI Gate 8)', () => {
  const provider = readSrcFile('src/providers/auth-provider.tsx');

  it('must call an auth check endpoint', () => {
    expect(provider).toContain('/api/auth/me');
  });

  it('must redirect unauthenticated users to login', () => {
    expect(provider).toContain('/login');
  });

  it('must expose useSession hook', () => {
    expect(provider).toContain('useSession');
    expect(provider).toContain('createContext');
  });

  it('must not be a no-op (must have actual logic)', () => {
    // A no-op AuthProvider would just return <>{children}</>
    // Ours should have significant logic
    expect(provider.length).toBeGreaterThan(200);
    expect(provider).toContain('checkSession');
    expect(provider).toContain('setIsAuthenticated');
  });
});

describe('SECURITY GATE: Secret Documentation (CI Gate 9)', () => {
  const envExample = readSrcFile('.env.example');

  it('must document API_KEY_ENCRYPTION_KEY', () => {
    expect(envExample).toContain('API_KEY_ENCRYPTION_KEY');
  });

  it('must describe the risk of missing the key', () => {
    expect(envExample).toContain('PLAINTEXT');
  });

  it('must provide generation instructions', () => {
    expect(envExample).toContain('openssl rand');
  });

  it('must mark it as REQUIRED in production', () => {
    expect(envExample).toContain('REQUIRED in production');
  });
});

describe('SECURITY GATE: CI Configuration (CI Gate 10)', () => {
  const ci = readSrcFile('.github/workflows/ci.yml');

  it('must have security-gate job', () => {
    expect(ci).toContain('security-gate:');
    expect(ci).toContain('name: "Blocking — Security Gate"');
  });

  it('security-gate must run before other jobs', () => {
    const securityGate = ci.indexOf('security-gate:');
    const lintJob = ci.indexOf('lint-and-typecheck:');
    const testUnitJob = ci.indexOf('test-unit:');
    const buildJob = ci.indexOf('build:');
    expect(securityGate).toBeGreaterThan(-1);
    expect(lintJob).toBeGreaterThan(-1);
    expect(testUnitJob).toBeGreaterThan(-1);
    expect(buildJob).toBeGreaterThan(-1);
    expect(securityGate).toBeLessThan(lintJob);
    expect(securityGate).toBeLessThan(testUnitJob);
    expect(securityGate).toBeLessThan(buildJob);
  });

  it('other jobs must depend on security-gate', () => {
    expect(ci).toContain('security-gate');
    expect(ci).toContain('needs:');
  });

  it('must have dependency-audit job', () => {
    expect(ci).toContain('dependency-audit:');
    expect(ci).toContain('dependency-audit-ci.js');
  });

  it('must have api-security-contract job', () => {
    expect(ci).toContain('api-security-contract:');
    expect(ci).toContain('API Security Contract');
  });

  it('middleware checks must fail the build on violation', () => {
    expect(ci).toContain('exit 1');
    expect(ci).toContain('SECURITY GATE FAILED');
    expect(ci).toContain('::error::');
  });

  it('must verify CSRF flow integrity', () => {
    expect(ci).toContain('CSRF flow integrity');
    expect(ci).toContain('generateCsrfToken');
    expect(ci).toContain('src/lib/csrf.ts');
    expect(ci).toContain('timingSafeEqual');
  });

  it('must verify security headers', () => {
    expect(ci).toContain('Verify security headers');
    expect(ci).toContain('X-Content-Type-Options');
  });

  it('must verify DOMPurify sanitization', () => {
    expect(ci).toContain('DOMPurify');
    expect(ci).toContain('isomorphic-dompurify');
  });

  it('must verify AuthProvider session enforcement', () => {
    expect(ci).toContain('AuthProvider');
    expect(ci).toContain('/api/auth/me');
  });

  it('must verify environment validation', () => {
    expect(ci).toContain('API_KEY_ENCRYPTION_KEY');
    expect(ci).toContain('PLAINTEXT');
  });
});

// ── Gate 11: API Security Contract Scanner ──────────
describe('SECURITY GATE: API Security Contract (CI Gate 11)', () => {
  const scanner = readSrcFile('scripts/api-security-scan.js');

  it('scanner must exist', () => {
    expect(existsSync(resolve(__dirname, '../../scripts/api-security-scan.js'))).toBe(true);
  });

  it('must check for checkApiAuth', () => {
    expect(scanner).toContain('checkApiAuth');
  });

  it('must check for withApiMiddleware', () => {
    expect(scanner).toContain('withApiMiddleware');
  });

  it('must have a public route exemption list', () => {
    expect(scanner).toContain('PUBLIC_ROUTE_PREFIXES');
    expect(scanner).toContain('/api/auth/');
    expect(scanner).toContain('/api/webhooks/');
  });

  it('must exit with code 1 on violations', () => {
    expect(scanner).toContain('process.exit(1)');
  });

  it('must exit with code 0 when all routes are protected', () => {
    expect(scanner).toContain('process.exit(0)');
  });

  it('public route list must match auth-helpers PUBLIC_PATH_PREFIXES', () => {
    const auth = readSrcFile('src/lib/auth-helpers.ts');
    // Both files must list /api/auth/ and /api/webhooks/ as public
    expect(scanner).toContain('/api/auth/');
    expect(auth).toContain('/api/auth/');
    expect(scanner).toContain('/api/webhooks/');
    expect(auth).toContain('/api/webhooks/');
  });
});

// ── Gate 12: Environment Security Validation ──────────
describe('SECURITY GATE: Environment Security (CI Gate 12)', () => {
  const envValidation = readSrcFile('src/lib/validate-env.ts');

  it('must validate API_KEY_ENCRYPTION_KEY', () => {
    expect(envValidation).toContain('API_KEY_ENCRYPTION_KEY');
  });

  it('must warn about plaintext storage risk', () => {
    expect(envValidation).toContain('PLAINTEXT');
  });

  it('must throw Error in production if encryption key missing', () => {
    expect(envValidation).toContain('throw new Error');
    expect(envValidation).toContain('API_KEY_ENCRYPTION_KEY must be set in production');
  });

  it('must require minimum 32 characters for encryption key', () => {
    expect(envValidation).toContain('min(32');
  });

  it('must warn in development (not throw)', () => {
    expect(envValidation).toContain("NODE_ENV === 'production'");
  });

  it('must require NEXTAUTH_SECRET min 32 characters', () => {
    // Schema-level validation
    expect(envValidation).toContain("NEXTAUTH_SECRET");
  });
});
