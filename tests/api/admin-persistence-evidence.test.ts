/**
 * @vitest-environment node
 *
 * Admin Persistence Evidence — Route Tests
 *
 * Tests GET /api/cron/persistence-evidence — Collect evidence metrics.
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
    evidence: {
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
import { GET } from '@/app/api/cron/persistence-evidence/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/persistence-evidence', { headers });
}

// ── GET /api/cron/persistence-evidence ──────────────────────────────────

describe('GET /api/cron/persistence-evidence', () => {
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
      'cron/persistence-evidence: unauthorized access attempt',
    );
  });

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('invalid-token');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(5);
    vi.mocked(db.evidence.count).mockResolvedValue(3);
    vi.mocked(db.auditLog.count).mockResolvedValue(10);
    vi.mocked(db.insight.count).mockResolvedValue(2);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns evidenceCollected as sum of signals and evidence', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(12);
    vi.mocked(db.evidence.count).mockResolvedValue(8);
    vi.mocked(db.auditLog.count).mockResolvedValue(15);
    vi.mocked(db.insight.count).mockResolvedValue(4);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.evidenceCollected).toBe(20); // 12 + 8
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.evidence.count).mockResolvedValue(0);
    vi.mocked(db.auditLog.count).mockResolvedValue(0);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes metrics object with all four counters', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(7);
    vi.mocked(db.evidence.count).mockResolvedValue(3);
    vi.mocked(db.auditLog.count).mockResolvedValue(11);
    vi.mocked(db.insight.count).mockResolvedValue(5);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.metrics).toBeDefined();
    expect(body.metrics).toHaveProperty('signalsLastHour', 7);
    expect(body.metrics).toHaveProperty('evidenceLastHour', 3);
    expect(body.metrics).toHaveProperty('auditLogsLastHour', 11);
    expect(body.metrics).toHaveProperty('insightsLastHour', 5);
  });

  // ── Time-based filtering ────────────────────────────────────────────

  it('queries signals with createdAt >= one hour ago', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.evidence.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(1);
    vi.mocked(db.insight.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.signal.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('queries evidence records with createdAt >= one hour ago', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.evidence.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(0);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.evidence.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  // ── Evidence aggregation ─────────────────────────────────────────────

  it('returns 0 evidenceCollected when both signals and evidence are 0', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.evidence.count).mockResolvedValue(0);
    vi.mocked(db.auditLog.count).mockResolvedValue(5);
    vi.mocked(db.insight.count).mockResolvedValue(3);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.evidenceCollected).toBe(0);
  });

  it('handles large evidence counts correctly', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(500);
    vi.mocked(db.evidence.count).mockResolvedValue(300);
    vi.mocked(db.auditLog.count).mockResolvedValue(1000);
    vi.mocked(db.insight.count).mockResolvedValue(200);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.evidenceCollected).toBe(800);
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs start and completion on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(3);
    vi.mocked(db.evidence.count).mockResolvedValue(2);
    vi.mocked(db.auditLog.count).mockResolvedValue(7);
    vi.mocked(db.insight.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith('cron/persistence-evidence: started');
    expect(logger.info).toHaveBeenCalledWith(
      'cron/persistence-evidence: completed',
      expect.objectContaining({
        evidenceCollected: 5,
        recentSignals: 3,
        recentEvidence: 2,
      }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockRejectedValue(new Error('Database unavailable'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/persistence-evidence: failed',
      expect.objectContaining({ error: 'Database unavailable' }),
    );
  });

  it('includes durationMs in error logs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockRejectedValue(new Error('Timeout'));

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.error).toHaveBeenCalledWith(
      'cron/persistence-evidence: failed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });
});
