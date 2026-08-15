/**
 * @vitest-environment node
 *
 * Admin Performance — Route Tests
 *
 * Tests GET /api/cron/persistence-performance — Monitor persistence layer metrics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/cron-auth', () => ({
  validateCronSecret: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    signal: { count: vi.fn() },
    organization: { count: vi.fn() },
    auditLog: { count: vi.fn() },
    evidence: { count: vi.fn() },
    insight: { count: vi.fn() },
  },
  PrismaDiagnostics: {
    snapshot: vi.fn().mockReturnValue({
      totalQueries: 150,
      slowQueries: 3,
    }),
  },
}));

vi.mock('@prisma/client', () => ({
  Prisma: {
    sql: vi.fn(),
  },
}));

import { validateCronSecret } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/cron/persistence-performance/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/persistence-performance', { headers });
}

// ── GET /api/cron/persistence-performance ───────────────────────────────

describe('GET /api/cron/persistence-performance', () => {
  const originalEnv = process.env;
  const CRON_SECRET = 'test-cron-secret-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Authentication ─────────────────────────────────────────────────

  it('returns 401 when no authorization header is provided', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
    expect(logger.warn).toHaveBeenCalledWith(
      'cron/persistence-performance: unauthorized access attempt',
    );
  });

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('wrong-key');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(42);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns metricsRecorded: true', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(10);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.metricsRecorded).toBe(true);
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes metrics object with dbLatencyMs, countLatencyMs, and parallelLatencyMs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(50);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.metrics).toBeDefined();
    expect(body.metrics).toHaveProperty('dbLatencyMs');
    expect(body.metrics).toHaveProperty('countLatencyMs');
    expect(body.metrics).toHaveProperty('parallelLatencyMs');
  });

  // ── Metrics values ─────────────────────────────────────────────────

  it('reports signal count in metrics', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(75);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.metrics.signalCount).toBe(75);
  });

  it('includes pool diagnostics in response', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(10);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.metrics.poolDiagnostics).toBeDefined();
    expect(body.metrics.poolDiagnostics).toHaveProperty('totalQueries');
    expect(body.metrics.poolDiagnostics).toHaveProperty('slowQueries');
  });

  it('executes raw SQL query for latency measurement', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('runs parallel queries for organization, auditLog, evidence, insight counts', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.organization.count).mockResolvedValue(10);
    vi.mocked(db.auditLog.count).mockResolvedValue(100);
    vi.mocked(db.evidence.count).mockResolvedValue(50);
    vi.mocked(db.insight.count).mockResolvedValue(25);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.organization.count).toHaveBeenCalled();
    expect(db.auditLog.count).toHaveBeenCalled();
    expect(db.evidence.count).toHaveBeenCalled();
    expect(db.insight.count).toHaveBeenCalled();
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs start and completion on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(10);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith('cron/persistence-performance: started');
    expect(logger.info).toHaveBeenCalledWith(
      'cron/persistence-performance: completed',
      expect.objectContaining({ metricsRecorded: true }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 503 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('DB down'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Database performance check failed');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/persistence-performance: failed',
      expect.objectContaining({ error: 'DB down' }),
    );
  });

  it('includes durationMs in error logs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Timeout'));

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.error).toHaveBeenCalledWith(
      'cron/persistence-performance: failed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  // ── Latency types ────────────────────────────────────────────────

  it('returns all latency values as numbers', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(5);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.metrics.dbLatencyMs).toBe('number');
    expect(typeof body.metrics.countLatencyMs).toBe('number');
    expect(typeof body.metrics.parallelLatencyMs).toBe('number');
  });
});
