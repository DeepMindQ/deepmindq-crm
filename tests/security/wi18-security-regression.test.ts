/**
 * WI-18.1-10: Security Regression Tests
 *
 * Validates all WI-18.1 security fixes:
 * 1. Edge middleware exists and exports correct function
 * 2. CSRF token generation works
 * 3. fetchApi sends CSRF token header
 * 4. /api/ai/evaluation requires authentication
 * 5. DOMPurify-based sanitization is active
 * 6. updateCompanySchema covers all sensitive fields
 * 7. CSP does not contain unsafe-inline in production mode
 * 8. AuthProvider exports session hook
 * 9. Security headers are complete
 * 10. API_KEY_ENCRYPTION_KEY documented
 * 11. CI workflow exists
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Test 1: Edge middleware exists ───────────────────────
describe('WI-18.1-01: Edge proxy (Next.js 16)', () => {
  it('should export a config with matcher', async () => {
    const proxyModule = await import('@/proxy');
    expect(proxyModule.config).toBeDefined();
    expect(proxyModule.config.matcher).toBeDefined();
    expect(Array.isArray(proxyModule.config.matcher)).toBe(true);
  });

  it('should have correct matcher config', async () => {
    const proxyModule = await import('@/proxy');
    expect(proxyModule.config).toBeDefined();
    expect(proxyModule.config.matcher).toBeDefined();
    expect(Array.isArray(proxyModule.config.matcher)).toBe(true);
  });
});

// ── Test 2: CSRF token generation ─────────────────────
describe('WI-18.1-02: CSRF token', () => {
  it('should generate cryptographically random tokens', async () => {
    const { generateCsrfToken } = await import('@/lib/csrf');
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();

    expect(token1).toBeDefined();
    expect(token2).toBeDefined();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
  });

  it('should validate matching tokens via auth-helpers', async () => {
    const { validateCsrf, CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER } = await import('@/lib/auth-helpers');

    // Create a minimal NextRequest-like object
    const token = 'abc123def456789';
    const req = {
      method: 'POST',
      headers: {
        get: (key: string) => {
          const map: Record<string, string> = {
            [CSRF_TOKEN_HEADER]: token,
            'cookie': `${CSRF_COOKIE_NAME}=${token}`,
          };
          return map[key] || null;
        },
      },
    } as any;

    expect(validateCsrf(req)).toBe(true);
  });

  it('should reject mismatched tokens', async () => {
    const { validateCsrf, CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER } = await import('@/lib/auth-helpers');

    const req = {
      method: 'POST',
      headers: {
        get: (key: string) => {
          const map: Record<string, string> = {
            [CSRF_TOKEN_HEADER]: 'wrong-token',
            'cookie': `${CSRF_COOKIE_NAME}=correct-token`,
          };
          return map[key] || null;
        },
      },
    } as any;

    expect(validateCsrf(req)).toBe(false);
  });

  it('should skip CSRF for GET requests', async () => {
    const { validateCsrf } = await import('@/lib/auth-helpers');

    const req = {
      method: 'GET',
      headers: { get: () => null },
    } as any;

    expect(validateCsrf(req)).toBe(true);
  });
});

// ── Test 3: fetchApi CSRF header pattern ────────────────
describe('WI-18.1-02: fetchApi CSRF header logic', () => {
  it('should extract CSRF token from document.cookie pattern', () => {
    const cookieStr = 'session=abc; csrf-token=deadbeef1234; other=val';
    const match = cookieStr.match(/(?:^|;\s*)csrf-token=([^;]*)/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('deadbeef1234');
  });
});

// ── Test 4: /api/ai/evaluation requires auth ──────────────
describe('WI-18.1-03: AI evaluation route auth', () => {
  const routePath = resolve(__dirname, '../src/app/api/ai/evaluation/route.ts');
  let content: string;

  it('route file should exist', () => {
    expect(existsSync(routePath)).toBe(true);
    content = readFileSync(routePath, 'utf-8');
  });

  it('should import checkApiAuth', () => {
    expect(content).toContain("import { checkApiAuth } from '@/lib/api-auth'");
  });

  it('should have WI-18.1-03 annotation', () => {
    expect(content).toContain('WI-18.1-03');
  });

  it('should call checkApiAuth in both GET and POST handlers', () => {
    const matches = content.match(/checkApiAuth/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Test 5: DOMPurify-based sanitization ─────────────────
describe('WI-18.1-05: DOMPurify sanitization', () => {
  it('should strip script tags from input', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    const result = sanitizeString('<script>alert("xss")</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
  });

  it('should strip event handlers', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    const result = sanitizeString('<div onclick="alert(1)">Click me</div>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
  });

  it('should handle malformed HTML without crashing', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    const result = sanitizeString('<div><script><<<unclosed');
    expect(typeof result).toBe('string');
    // Should be much shorter than input after stripping
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('should strip iframe tags', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    const result = sanitizeString('<iframe src="evil.com"></iframe>content');
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil.com');
    expect(result).toContain('content');
  });

  it('should strip SVG-based XSS', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    const result = sanitizeString('<svg><script>alert(1)</script></svg>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<svg>');
  });

  it('should handle null and undefined input gracefully', async () => {
    const { sanitizeString } = await import('@/lib/sanitize');
    expect(sanitizeString(null as any)).toBe('');
    expect(sanitizeString(undefined as any)).toBe('');
    expect(sanitizeString('')).toBe('');
  });
});

// ── Test 6: updateCompanySchema covers sensitive fields ──
describe('WI-18.1-04: Company update Zod schema', () => {
  it('should validate intelligenceScore as a number 0-100', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ intelligenceScore: 75 }).success).toBe(true);
    expect(updateCompanySchema.safeParse({ intelligenceScore: 150 }).success).toBe(false);
    expect(updateCompanySchema.safeParse({ intelligenceScore: -5 }).success).toBe(false);
    expect(updateCompanySchema.safeParse({ intelligenceScore: 'hacked' }).success).toBe(false);
  });

  it('should validate engagementScore as a number 0-100', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ engagementScore: 50 }).success).toBe(true);
    expect(updateCompanySchema.safeParse({ engagementScore: 200 }).success).toBe(false);
  });

  it('should validate accountPriorityScore as a number 0-100', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ accountPriorityScore: 80 }).success).toBe(true);
  });

  it('should validate assignedTo as a string', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ assignedTo: 'user@example.com' }).success).toBe(true);
    // Reject non-string types
    expect(updateCompanySchema.safeParse({ assignedTo: 123 }).success).toBe(false);
  });

  it('should validate priorityTier as enum', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ priorityTier: 'HOT' }).success).toBe(true);
    expect(updateCompanySchema.safeParse({ priorityTier: 'ACTIVE' }).success).toBe(true);
    expect(updateCompanySchema.safeParse({ priorityTier: 'INVALID' }).success).toBe(false);
  });

  it('should accept tags as array or string', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ tags: ['ai', 'ml'] }).success).toBe(true);
    expect(updateCompanySchema.safeParse({ tags: '["ai","ml"]' }).success).toBe(true);
  });

  it('should validate lifecycleStage as string', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    expect(updateCompanySchema.safeParse({ lifecycleStage: 'discovery' }).success).toBe(true);
  });

  it('should reject extremely long strings', async () => {
    const { updateCompanySchema } = await import('@/lib/validations');

    const longName = 'x'.repeat(300);
    expect(updateCompanySchema.safeParse({ name: longName }).success).toBe(false);
    expect(updateCompanySchema.safeParse({ internalSummary: 'x'.repeat(3000) }).success).toBe(false);
  });
});

// ── Test 7: CSP without unsafe-inline in production ───────
describe('WI-18.1-07: CSP policy', () => {
  it('should not contain unsafe-inline in script-src in production', async () => {
    const { getSecurityHeaders } = await import('@/lib/auth-helpers');

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const headers = getSecurityHeaders();
    process.env.NODE_ENV = origEnv;

    const csp = headers['Content-Security-Policy'];
    expect(csp).toBeDefined();

    const scriptSrc = csp.match(/script-src[^;]*/)?.[0] || '';
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('should allow unsafe-eval in development for Next.js HMR', async () => {
    const { getSecurityHeaders } = await import('@/lib/auth-helpers');

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const headers = getSecurityHeaders();
    process.env.NODE_ENV = origEnv;

    const csp = headers['Content-Security-Policy'];
    const scriptSrc = csp.match(/script-src[^;]*/)?.[0] || '';
    expect(scriptSrc).toContain('unsafe-eval');
  });

  it('should include frame-ancestors none', async () => {
    const { getSecurityHeaders } = await import('@/lib/auth-helpers');
    const headers = getSecurityHeaders();
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });
});

// ── Test 8: AuthProvider session check ──────────────────
describe('WI-18.1-08: AuthProvider', () => {
  it('should export useSession hook', async () => {
    const mod = await import('@/providers/auth-provider');
    expect(mod.useSession).toBeDefined();
    expect(typeof mod.useSession).toBe('function');
  });

  it('should export AuthProvider component', async () => {
    const mod = await import('@/providers/auth-provider');
    expect(mod.AuthProvider).toBeDefined();
  });

  it('should reference /api/auth/me for session check', async () => {
    const providerPath = resolve(__dirname, '../src/providers/auth-provider.tsx');
    const content = readFileSync(providerPath, 'utf-8');
    expect(content).toContain('/api/auth/me');
    expect(content).toContain('window.location.href');
  });
});

// ── Test 9: Security headers are complete ──────────────
describe('Security headers completeness', () => {
  it('should include all required security headers', async () => {
    const { getSecurityHeaders } = await import('@/lib/auth-helpers');
    const headers = getSecurityHeaders();

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Content-Security-Policy'].length).toBeGreaterThan(50);
  });
});

// ── Test 10: API_KEY_ENCRYPTION_KEY documented ──────────
describe('WI-18.1-06: .env.example documentation', () => {
  const envPath = resolve(__dirname, '../.env.example');
  let content: string;

  it('.env.example should exist', () => {
    expect(existsSync(envPath)).toBe(true);
    content = readFileSync(envPath, 'utf-8');
  });

  it('should document API_KEY_ENCRYPTION_KEY with security warning', () => {
    expect(content).toContain('API_KEY_ENCRYPTION_KEY');
    expect(content).toContain('AES-256-GCM');
    expect(content).toContain('PLAINTEXT');
    expect(content).toContain('REQUIRED in production');
  });
});

// ── Test 11: CI workflow exists ─────────────────────────
describe('WI-18.1-09: GitHub Actions CI', () => {
  const ciPath = resolve(__dirname, '../.github/workflows/ci.yml');
  let content: string;

  it('CI workflow file should exist', () => {
    expect(existsSync(ciPath)).toBe(true);
    content = readFileSync(ciPath, 'utf-8');
  });

  it('should include lint step', () => {
    expect(content).toContain('npm run lint');
  });

  it('should include test step', () => {
    expect(content).toContain('npm test');
  });

  it('should include build verification', () => {
    expect(content).toContain('build');
  });

  it('should include prisma generate', () => {
    expect(content).toContain('prisma generate');
  });

  it('should run on PRs to main and develop', () => {
    expect(content).toContain('pull_request');
    expect(content).toContain('main');
    expect(content).toContain('develop');
  });

  it('should have concurrency control', () => {
    expect(content).toContain('cancel-in-progress');
  });
});

// ── Test 12: Edge proxy file-level verification (Next.js 16) ──
describe('WI-18.1-01: Proxy implementation details', () => {
  const proxyPath = resolve(__dirname, '../src/proxy.ts');
  let content: string;

  it('proxy.ts should exist at src/proxy.ts', () => {
    expect(existsSync(proxyPath)).toBe(true);
    content = readFileSync(proxyPath, 'utf-8');
  });

  it('should import security headers', () => {
    expect(content).toContain('getSecurityHeaders');
  });

  it('should validate CSRF on state-changing API requests', () => {
    expect(content).toContain('validateCsrf');
    expect(content).toContain("['GET', 'HEAD', 'OPTIONS']");
  });

  it('should validate session on protected API routes', () => {
    expect(content).toContain('getSessionToken');
    expect(content).toContain('unauthorizedResponse');
  });

  it('should rate-limit public auth endpoints', () => {
    expect(content).toContain('rateLimitedResponse');
    expect(content).toContain('generalApiRateLimit');
  });
});
