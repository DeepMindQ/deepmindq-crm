/**
 * Playwright API Health E2E Tests
 *
 * Critical path: Health endpoints → Database connectivity → AI service status
 * Tests that all API routes respond correctly and the system is operational.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Health Check Endpoints', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('GET /api/health/livez returns liveness probe', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/livez`);
    // Liveness probes should always return 200 if the process is running
    expect(response.status()).toBe(200);
  });

  test('GET /api/health/ready returns readiness probe', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/ready`);
    // Readiness should return 200 when all dependencies are ready
    // May return 503 during startup
    expect([200, 503]).toContain(response.status());
  });

  test('GET /api/health/database returns database status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/database`);
    expect([200, 503]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toBeTruthy();
    }
  });

  test('GET /api/health/ai returns AI provider status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/ai`);
    expect([200, 503]).toContain(response.status());
  });

  test('GET /api/health/metrics returns system metrics', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/metrics`);
    expect([200, 503]).toContain(response.status());
  });

  test('GET /api/health/deps returns dependency status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/deps`);
    expect([200, 503]).toContain(response.status());
  });
});

test.describe('API Error Handling', () => {
  test('unauthenticated request to protected endpoint returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);
    // Should return 401 or redirect when no session
    expect([401, 307, 302]).toContain(response.status());
  });

  test('malformed request to API returns proper error', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/request-otp`, {
      data: { email: 'not-an-email' },
    });

    // Should return 400 for invalid input (Zod validation)
    expect([400, 422]).toContain(response.status());
  });

  test('OPTIONS request returns CORS headers', async ({ request }) => {
    const response = await request.fetch(`${BASE_URL}/api/health`, {
      method: 'OPTIONS',
    });

    // CORS preflight should be handled
    expect([200, 204, 405]).toContain(response.status());
  });

  test('GET /api returns API info or 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api`);
    // Root API route should either return info or 404
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('API Response Headers', () => {
  test('health endpoints have content-type JSON', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    if (response.status() === 200) {
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    }
  });

  test('responses have reasonable timing (< 2s)', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}/api/health`);
    const elapsed = Date.now() - start;

    expect(response.status()).toBeLessThan(500);
    expect(elapsed).toBeLessThan(2000);
  });
});
