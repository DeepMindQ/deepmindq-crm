/**
 * Health Endpoint API Tests
 *
 * Tests for GET /api/health and GET /api/health/ready.
 * These tests mock the database layer to validate response shapes
 * without requiring a running PostgreSQL instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/server ───────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      const status = init?.status || 200;
      const headers = new Headers(init?.headers || { 'Content-Type': 'application/json' });
      return new Response(JSON.stringify(data), { status, headers });
    },
  },
}));

// ── Mock DB module ─────────────────────────────────────────
const mockQueryRaw = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
  getPoolStats: () => ({
    total: 10,
    active: 2,
    idle: 8,
    waiting: 0,
  }),
}));

// ── Mock enterprise-health ────────────────────────────────
const mockGetReadinessCheck = vi.fn();
vi.mock('@/lib/enterprise-health', () => ({
  getReadinessCheck: (...args: unknown[]) => mockGetReadinessCheck(...args),
}));

describe('Health Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns 200 with expected shape', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      // Import the route handler dynamically so mocks are in place
      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeDefined();
    });

    it('includes version field', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      expect(body.version).toBeDefined();
      expect(typeof body.version).toBe('string');
    });

    it('includes environment field', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      expect(body.environment).toBeDefined();
    });

    it('includes provider status (booleans, no secrets)', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      expect(body.providers).toBeDefined();
      expect(typeof body.providers.nvidia).toBe('boolean');
      expect(typeof body.providers.groq).toBe('boolean');
      expect(typeof body.providers.gemini).toBe('boolean');
      // Ensure no secret values are leaked
      const providersStr = JSON.stringify(body.providers);
      expect(providersStr).not.toContain('sk-');
      expect(providersStr).not.toContain('key=');
    });

    it('reports db: true when DB is healthy', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      expect(body.db).toBe(true);
    });

    it('reports db: false when DB query fails', async () => {
      mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();
      const body = await response.json();

      // Health returns 200 even if DB is down (degraded mode)
      expect(response.status).toBe(200);
      expect(body.db).toBe(false);
    });

    it('sets Cache-Control: no-store', async () => {
      mockQueryRaw.mockResolvedValue([{ _1: 1 }]);

      const { GET } = await import('@/app/api/health/route');
      const response = await GET();

      expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });
  });

  describe('GET /api/health/ready', () => {
    it('returns 200 when all deps are ready', async () => {
      mockGetReadinessCheck.mockResolvedValue({
        ready: true,
        db: true,
        ai: true,
        timestamp: new Date().toISOString(),
      });

      const { GET } = await import('@/app/api/health/ready/route');
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ready).toBe(true);
    });

    it('returns 503 when DB is down', async () => {
      mockGetReadinessCheck.mockResolvedValue({
        ready: false,
        db: false,
        ai: true,
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });

      const { GET } = await import('@/app/api/health/ready/route');
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.ready).toBe(false);
    });

    it('returns 503 when readiness check throws', async () => {
      mockGetReadinessCheck.mockRejectedValue(new Error('Internal error'));

      const { GET } = await import('@/app/api/health/ready/route');
      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.ready).toBe(false);
    });
  });
});
