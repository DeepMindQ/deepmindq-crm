/**
 * @vitest-environment node
 *
 * Health API — Route Tests
 *
 * Tests GET /api/health — database, Redis, and service health probe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/deployment', () => ({
  getDeploymentConfig: vi.fn().mockReturnValue({
    deploySlot: 'primary',
    version: '1.0.0',
    region: 'local',
    environment: 'test',
    buildSha: 'abc123',
    isCanary: false,
    canaryWeight: 0,
  }),
}));

// Mock dynamic imports for optional services
vi.mock('@/lib/redis-client', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  getClientType: vi.fn().mockReturnValue('none'),
}));

vi.mock('@/lib/persistence/intelligence-persistence-adapter', () => ({
  getPersistenceAdapter: vi.fn().mockReturnValue({
    getPoolMetrics: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@/lib/intelligence/knowledge-graph', () => ({
  getGraphStats: vi.fn().mockResolvedValue({ totalNodes: 0, totalEdges: 0 }),
}));

vi.mock('@/lib/swr-cache', () => ({
  getSWRCacheStats: vi.fn().mockReturnValue({ size: 0, revalidating: 0 }),
}));

vi.mock('@/lib/redis-pubsub', () => ({
  isPubSubActive: vi.fn().mockReturnValue(false),
}));

import { db } from '@/lib/db';
import { GET } from '@/app/api/health/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/health');
}

// ── GET /api/health ────────────────────────────────────────────────────

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Basic response structure ───────────────────────────────────────

  it('returns 200 status', async () => {
    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('sets Cache-Control to no-store', async () => {
    const req = makeRequest();
    const res = await GET(req);

    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('returns JSON with required top-level fields', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('deployment');
    expect(body).toHaveProperty('providers');
    expect(body).toHaveProperty('db');
    expect(body).toHaveProperty('redis');
    expect(body).toHaveProperty('memory');
    expect(body).toHaveProperty('poolHealth');
    expect(body).toHaveProperty('kgReady');
    expect(body).toHaveProperty('swrCache');
    expect(body).toHaveProperty('ssePubSub');
    expect(body).toHaveProperty('persistenceMode');
  });

  // ── Deployment info ───────────────────────────────────────────────

  it('includes deployment configuration', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.deployment).toEqual({
      slot: 'primary',
      version: '1.0.0',
      region: 'local',
      environment: 'test',
      buildSha: 'abc123',
      isCanary: false,
      canaryWeight: 0,
    });
  });

  // ── Provider flags ────────────────────────────────────────────────

  it('reflects configured AI providers', async () => {
    process.env.NVIDIA_API_KEY = 'nv-key';
    process.env.GROQ_API_KEY = 'gq-key';

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.providers.nvidia).toBe(true);
    expect(body.providers.groq).toBe(true);
    expect(body.providers.fireworks).toBe(false);
    expect(body.providers.gemini).toBe(false);
    expect(body.providers.tavily).toBe(false);
  });

  it('shows all providers as false when no keys set', async () => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    Object.values(body.providers).forEach((val) => {
      expect(val).toBe(false);
    });
  });

  // ── Database health ───────────────────────────────────────────────

  it('reports db as healthy when query succeeds', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.db.healthy).toBe(true);
    expect(body.db.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports db as unhealthy when query fails', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Connection refused'));

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.db.healthy).toBe(false);
    expect(body.db.latencyMs).toBeNull();
  });

  it('reports db as unhealthy (false) when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    // Without DATABASE_URL, db probe is skipped — dbHealthy remains false
    expect(body.db.healthy).toBe(false);
  });

  it('returns degraded status when DB is unhealthy', async () => {
    delete process.env.DATABASE_URL;

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.status).toBe('degraded');
  });

  it('returns ok status when DB is healthy', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test';
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.status).toBe('ok');
  });

  // ── Redis health ───────────────────────────────────────────────────

  it('reports Redis as not configured when client is null and type is none', async () => {
    const { getRedisClient, getClientType } = await import('@/lib/redis-client');
    vi.mocked(getRedisClient).mockResolvedValue(null);
    vi.mocked(getClientType).mockReturnValue('none');

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.redis).toEqual({ configured: false });
  });

  it('reports Redis as configured and healthy on PONG', async () => {
    const mockRedisClient = { ping: vi.fn().mockResolvedValue('PONG') };
    const { getRedisClient } = await import('@/lib/redis-client');
    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient);

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.redis.configured).toBe(true);
    expect(body.redis.healthy).toBe(true);
    expect(body.redis.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports Redis as unhealthy when ping fails', async () => {
    const mockRedisClient = { ping: vi.fn().mockRejectedValue(new Error('Redis down')) };
    const { getRedisClient } = await import('@/lib/redis-client');
    vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient);

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.redis.configured).toBe(true);
    expect(body.redis.healthy).toBe(false);
  });

  // ── Memory metrics ───────────────────────────────────────────────

  it('returns memory usage in MB', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.memory).toHaveProperty('rssMb');
    expect(body.memory).toHaveProperty('heapUsedMb');
    expect(body.memory).toHaveProperty('heapTotalMb');
    expect(body.memory).toHaveProperty('externalMb');
    expect(typeof body.memory.rssMb).toBe('number');
    expect(body.memory.rssMb).toBeGreaterThanOrEqual(0);
  });

  // ── Persistence mode ─────────────────────────────────────────────

  it('defaults persistence mode to memory', async () => {
    delete process.env.PERSISTENCE_MODE;

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.persistenceMode).toBe('memory');
  });

  it('uses PERSISTENCE_MODE env var when set', async () => {
    process.env.PERSISTENCE_MODE = 'database';

    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.persistenceMode).toBe('database');
  });

  // ── Timestamp & uptime ────────────────────────────────────────────

  it('includes valid ISO timestamp and positive uptime', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  // ── Pool health defaults ──────────────────────────────────────────

  it('includes poolHealth with default zero values', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(body.poolHealth).toEqual({
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
    });
  });
});
