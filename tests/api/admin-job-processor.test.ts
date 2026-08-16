/**
 * @vitest-environment node
 *
 * Admin Job Processor — Route Tests
 *
 * Tests GET /api/cron/job-processor — Process queued background jobs.
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
    signal: {
      count: vi.fn(),
    },
    organization: {
      count: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
    },
    insight: {
      count: vi.fn(),
    },
  },
}));

import { validateCronSecret } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/cron/job-processor/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/job-processor', { headers });
}

// ── GET /api/cron/job-processor ────────────────────────────────────────

describe('GET /api/cron/job-processor', () => {
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
    expect(logger.warn).toHaveBeenCalledWith('cron/job-processor: unauthorized access attempt');
  });

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('bad-secret');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(50);
    vi.mocked(db.organization.count).mockResolvedValue(10);
    vi.mocked(db.auditLog.count).mockResolvedValue(200);
    vi.mocked(db.insight.count).mockResolvedValue(30);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns processed: true', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(5);
    vi.mocked(db.organization.count).mockResolvedValue(3);
    vi.mocked(db.auditLog.count).mockResolvedValue(100);
    vi.mocked(db.insight.count).mockResolvedValue(20);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.processed).toBe(true);
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.organization.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(1);
    vi.mocked(db.insight.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns diagnostics object with entity counts', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(25);
    vi.mocked(db.organization.count).mockResolvedValue(8);
    vi.mocked(db.auditLog.count).mockResolvedValue(150);
    vi.mocked(db.insight.count).mockResolvedValue(12);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.diagnostics).toEqual({
      signalCount: 25,
      organizationCount: 8,
      auditLogCount: 150,
      insightCount: 12,
      pendingSignals: expect.any(Number),
      activeSignals: expect.any(Number),
    });
  });

  // ── Diagnostics counts ────────────────────────────────────────────

  it('reports correct signal count', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(99);
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.auditLog.count).mockResolvedValue(0);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.diagnostics.signalCount).toBe(99);
  });

  it('reports correct organization count', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.organization.count).mockResolvedValue(37);
    vi.mocked(db.auditLog.count).mockResolvedValue(0);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.diagnostics.organizationCount).toBe(37);
  });

  it('queries pending signals (status = detected)', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.organization.count).mockResolvedValue(5);
    vi.mocked(db.auditLog.count).mockResolvedValue(20);
    vi.mocked(db.insight.count).mockResolvedValue(5);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    // The last two calls to signal.count should be for pending and active
    const calls = vi.mocked(db.signal.count).mock.calls;
    // Find the call with where: { status: 'detected' }
    const pendingCall = calls.find((c) => c[0]?.where?.status === 'detected');
    expect(pendingCall).toBeDefined();
  });

  it('queries active signals with proper status filter', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.organization.count).mockResolvedValue(5);
    vi.mocked(db.auditLog.count).mockResolvedValue(20);
    vi.mocked(db.insight.count).mockResolvedValue(5);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    const calls = vi.mocked(db.signal.count).mock.calls;
    const activeCall = calls.find((c) => Array.isArray(c[0]?.where?.status?.in));
    expect(activeCall).toBeDefined();
    expect(activeCall![0].where.status.in).toEqual(
      expect.arrayContaining(['detected', 'validated', 'analyzed']),
    );
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs start and completion on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.organization.count).mockResolvedValue(5);
    vi.mocked(db.auditLog.count).mockResolvedValue(20);
    vi.mocked(db.insight.count).mockResolvedValue(5);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith('cron/job-processor: started');
    expect(logger.info).toHaveBeenCalledWith(
      'cron/job-processor: completed',
      expect.objectContaining({ signalCount: 10, organizationCount: 5 }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockRejectedValue(new Error('Connection lost'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/job-processor: failed',
      expect.objectContaining({ error: 'Connection lost' }),
    );
  });

  it('includes durationMs in error response logs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockRejectedValue(new Error('Timeout'));

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.error).toHaveBeenCalledWith(
      'cron/job-processor: failed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('handles zero counts across all entities', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.auditLog.count).mockResolvedValue(0);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.diagnostics.signalCount).toBe(0);
    expect(body.diagnostics.organizationCount).toBe(0);
    expect(body.diagnostics.auditLogCount).toBe(0);
    expect(body.diagnostics.insightCount).toBe(0);
    expect(body.diagnostics.pendingSignals).toBe(0);
    expect(body.diagnostics.activeSignals).toBe(0);
  });
});
