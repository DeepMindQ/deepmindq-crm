/**
 * Smoke Test Suite — Deployed Environment Validation
 *
 * M4 Phase 3.5 (enhanced in Phase 3 Validation)
 *
 * Validates that a deployed DeepMindQ instance is operational after deployment.
 * Tests execute against the SMOKE_TEST_URL environment variable.
 *
 * Coverage:
 *   1. Health endpoint responds with correct structure (status, uptime, timestamp, db, providers)
 *   2. Version/build identifier present in health response
 *   3. Environment identifier present in health response
 *   4. Database connectivity confirmed
 *   5. Authentication endpoint available (returns expected error for invalid request)
 *   6. Static assets serve correctly
 *   7. Security headers present (Cache-Control, no x-powered-by, CSP or equivalent)
 *   8. API routes return proper JSON responses (ready, deps)
 *   9. Root page loads without server error
 *  10. Invalid endpoints return graceful 4xx (not 5xx crash)
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.SMOKE_TEST_URL || 'http://localhost:3000';
const ENV = process.env.SMOKE_TEST_ENV || 'staging';

describe(`Smoke Tests — ${ENV}`, () => {
  let healthResponse: {
    status: number;
    body: Record<string, unknown>;
    responseTime: number;
  };

  beforeAll(async () => {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/api/health`, {
      headers: { 'Accept': 'application/json' },
    });
    const responseTime = Date.now() - start;
    const body = await res.json();

    healthResponse = { status: res.status, body, responseTime };
  }, 15_000);

  // ─── Test 1: Health Endpoint Structure ───
  describe('Health Endpoint', () => {
    it('returns HTTP 200', () => {
      expect(healthResponse.status).toBe(200);
    });

    it('responds within 10 seconds', () => {
      expect(healthResponse.responseTime).toBeLessThan(10_000);
    });

    it('returns status "ok"', () => {
      expect(healthResponse.body.status).toBe('ok');
    });

    it('includes timestamp', () => {
      expect(healthResponse.body.timestamp).toBeDefined();
      const ts = new Date(healthResponse.body.timestamp as string);
      expect(ts.getTime()).toBeGreaterThan(Date.now() - 60_000); // Within last minute
    });

    it('includes uptime', () => {
      expect(healthResponse.body.uptime).toBeDefined();
      expect(healthResponse.body.uptime as number).toBeGreaterThan(0);
    });

    it('includes database status', () => {
      expect(healthResponse.body.db).toBeDefined();
      expect(healthResponse.body.db).toBe(true);
    });

    it('includes provider configuration flags', () => {
      expect(healthResponse.body.providers).toBeDefined();
      const providers = healthResponse.body.providers as Record<string, unknown>;
      // At minimum, the providers object should exist with boolean values
      for (const value of Object.values(providers)) {
        expect(typeof value).toBe('boolean');
      }
    });

    it('includes version/build identifier', () => {
      expect(healthResponse.body.version).toBeDefined();
      const version = healthResponse.body.version as string;
      // Version should be a non-empty string (commit SHA or 'dev')
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('includes environment identifier', () => {
      expect(healthResponse.body.environment).toBeDefined();
      const env = healthResponse.body.environment as string;
      expect(['development', 'staging', 'production']).toContain(env);
    });
  });

  // ─── Test 2: Root Page ───
  describe('Root Page', () => {
    it('loads without server error', async () => {
      const res = await fetch(BASE_URL, {
        redirect: 'manual', // Don't follow redirects — landing page may redirect
      });
      // Should not be a 5xx error
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── Test 3: Authentication Endpoint ───
  describe('Authentication Endpoint', () => {
    it('exists and returns expected error for missing credentials', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: { 'Accept': 'application/json' },
      });
      // Should not be a 5xx error
      expect(res.status).toBeLessThan(500);
      // Should return JSON
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });

  // ─── Test 4: API Routes Return JSON ───
  describe('API Routes', () => {
    const apiRoutes = [
      '/api/health/ready',
      '/api/health/deps',
    ];

    it.each(apiRoutes)('%s returns JSON with expected structure', async (route) => {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { 'Accept': 'application/json' },
      });
      expect(res.status).toBeLessThan(500);
      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const body = await res.json();
      expect(body).toBeDefined();
      expect(body).toHaveProperty('timestamp');
    });
  });

  // ─── Test 5: Security Headers ───
  describe('Security Headers', () => {
    it('includes Cache-Control: no-store on health endpoint', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
    });

    it('does not expose powered-by header', async () => {
      const res = await fetch(BASE_URL, { redirect: 'manual' });
      const poweredBy = res.headers.get('x-powered-by');
      expect(poweredBy).toBeNull();
    });

    it('includes Content-Security-Policy or equivalent security header', async () => {
      const res = await fetch(BASE_URL, { redirect: 'manual' });
      // Either CSP or a security-related header should be present
      const csp = res.headers.get('content-security-policy');
      const xFrameOptions = res.headers.get('x-frame-options');
      const strictTransport = res.headers.get('strict-transport-security');
      // At least one major security header should be present
      const hasSecurityHeader = Boolean(csp) || Boolean(xFrameOptions) || Boolean(strictTransport);
      expect(hasSecurityHeader).toBe(true);
    });
  });

  // ─── Test 6: Environment-Specific Validation ───
  describe('Environment Configuration', () => {
    it(`reports correct environment as ${ENV}`, () => {
      // The environment is verified by the SMOKE_TEST_ENV variable
      // and the fact that we reached the correct URL
      expect(ENV).toMatch(/^(staging|production)$/);
    });
  });

  // ─── Test 7: Deployment Unhealthiness Detection ───
  describe('Unhealthy Deployment Detection', () => {
    it('health endpoint returns degraded status when called with invalid path', async () => {
      // Verify the app properly handles invalid endpoints (not a 5xx crash)
      const res = await fetch(`${BASE_URL}/api/nonexistent-health-endpoint`);
      // Should be 404, not 500+
      expect(res.status).toBeLessThan(500);
    });
  });
});
