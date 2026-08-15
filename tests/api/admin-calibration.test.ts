/**
 * @vitest-environment node
 *
 * Admin Calibration Runner — Route Tests
 *
 * Tests GET /api/cron/calibration-runner — AI model calibration metrics.
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
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

import { validateCronSecret } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/cron/calibration-runner/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/calibration-runner', { headers });
}

// ── GET /api/cron/calibration-runner ────────────────────────────────────

describe('GET /api/cron/calibration-runner', () => {
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
      'cron/calibration-runner: unauthorized access attempt',
    );
  });

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('wrong-secret');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(100);
    vi.mocked(db.signal.groupBy).mockResolvedValue([
      { status: 'detected', _count: { status: 50 } },
      { status: 'acted_upon', _count: { status: 30 } },
    ]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 72.5, impactScore: 60.3 },
      _count: 100,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns calibrated: true in response', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: null, impactScore: null },
      _count: 10,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibrated).toBe(true);
  });

  it('returns modelsChecked as 1', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(5);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 50, impactScore: 40 },
      _count: 5,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.modelsChecked).toBe(1);
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: null, impactScore: null },
      _count: 1,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes calibration object with totalSignals', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(42);
    vi.mocked(db.signal.groupBy).mockResolvedValue([
      { status: 'detected', _count: { status: 20 } },
    ]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 65, impactScore: 55 },
      _count: 42,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration).toBeDefined();
    expect(body.calibration.totalSignals).toBe(42);
  });

  // ── Calibration metrics ────────────────────────────────────────────

  it('includes statusCounts in calibration output', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(50);
    vi.mocked(db.signal.groupBy).mockResolvedValue([
      { status: 'detected', _count: { status: 25 } },
      { status: 'validated', _count: { status: 10 } },
      { status: 'acted_upon', _count: { status: 15 } },
    ]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 70, impactScore: 60 },
      _count: 50,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration.statusCounts).toEqual({
      detected: 25,
      validated: 10,
      acted_upon: 15,
    });
  });

  it('includes averageConfidence and averageImpact from aggregate', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(20);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 83.7, impactScore: 91.2 },
      _count: 20,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration.averageConfidence).toBe(83.7);
    expect(body.calibration.averageImpact).toBe(91.2);
  });

  it('handles null average scores gracefully', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: null, impactScore: null },
      _count: 0,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration.averageConfidence).toBeNull();
    expect(body.calibration.averageImpact).toBeNull();
  });

  // ── Accuracy ratio ────────────────────────────────────────────────

  it('returns null accuracyRatio when no high-confidence signals exist', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    // count resolves: totalCount, groupBy, aggregate, confidenceGroups, highConfTotal, highConfActed
    // 6 count calls for confidence distribution tiers (5) + initial + highConfTotal + highConfActed
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: null, impactScore: null },
      _count: 0,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration.accuracyRatio).toBeNull();
  });

  // ── Confidence distribution ────────────────────────────────────────

  it('includes confidence distribution with all five tiers', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(100);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 75, impactScore: 65 },
      _count: 100,
    });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.calibration.confidenceDistribution).toHaveProperty('very_high');
    expect(body.calibration.confidenceDistribution).toHaveProperty('high');
    expect(body.calibration.confidenceDistribution).toHaveProperty('medium');
    expect(body.calibration.confidenceDistribution).toHaveProperty('low');
    expect(body.calibration.confidenceDistribution).toHaveProperty('very_low');
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockRejectedValue(new Error('Connection refused'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/calibration-runner: failed',
      expect.objectContaining({ error: 'Connection refused' }),
    );
  });

  it('logs completion info on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.signal.groupBy).mockResolvedValue([]);
    vi.mocked(db.signal.aggregate).mockResolvedValue({
      _avg: { confidenceScore: 50, impactScore: 40 },
      _count: 10,
    });

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith(
      'cron/calibration-runner: completed',
      expect.objectContaining({ calibrated: true }),
    );
  });
});
