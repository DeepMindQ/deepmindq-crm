/**
 * @vitest-environment node
 *
 * Admin Data Retention — Route Tests
 *
 * Tests GET /api/cron/data-retention — Enforce data retention policies.
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
    auditLog: {
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
  },
}));

import { validateCronSecret } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { GET } from '@/app/api/cron/data-retention/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/data-retention', { headers });
}

// ── GET /api/cron/data-retention ──────────────────────────────────────

describe('GET /api/cron/data-retention', () => {
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
    expect(logger.warn).toHaveBeenCalledWith('cron/data-retention: unauthorized access attempt');
  });

  it('returns 401 when cron secret does not match', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('incorrect-secret');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 5 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 3 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns purged object with signals, auditLogs, and sessions keys', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 10 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.purged).toBeDefined();
    expect(body.purged).toHaveProperty('signals');
    expect(body.purged).toHaveProperty('auditLogs');
    expect(body.purged).toHaveProperty('sessions');
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── Purge behavior ────────────────────────────────────────────────

  it('reports number of audit logs purged', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 42 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.purged.auditLogs).toBe(42);
  });

  it('reports number of sessions purged', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 7 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.purged.sessions).toBe(7);
  });

  it('always reports signals purged as 0', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 100 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 50 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.purged.signals).toBe(0);
  });

  it('deletes audit logs older than 90 days', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.auditLog.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('deletes expired sessions', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 5 });

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.session.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('handles zero records purged gracefully', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purged.auditLogs).toBe(0);
    expect(body.purged.sessions).toBe(0);
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs start and completion on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockResolvedValue({ count: 3 });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith('cron/data-retention: started');
    expect(logger.info).toHaveBeenCalledWith(
      'cron/data-retention: completed',
      expect.objectContaining({
        purged: expect.objectContaining({ auditLogs: 3, sessions: 1 }),
      }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockRejectedValue(new Error('DB down'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/data-retention: failed',
      expect.objectContaining({ error: 'DB down' }),
    );
  });

  it('includes durationMs in error response logs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.auditLog.deleteMany).mockRejectedValue(new Error('Timeout'));

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.error).toHaveBeenCalledWith(
      'cron/data-retention: failed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });
});
