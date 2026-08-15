/**
 * @vitest-environment node
 *
 * Admin Backup Verify — Route Tests
 *
 * Tests GET /api/cron/backup-verify — Verify database connectivity and health.
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
import { GET } from '@/app/api/cron/backup-verify/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(authToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`;
  }
  return new NextRequest('http://localhost/api/cron/backup-verify', { headers });
}

// ── GET /api/cron/backup-verify ───────────────────────────────────────

describe('GET /api/cron/backup-verify', () => {
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
    expect(logger.warn).toHaveBeenCalledWith('cron/backup-verify: unauthorized access attempt');
  });

  it('returns 401 when cron secret is invalid', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(false);

    const req = makeRequest('invalid');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when authorized', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(50);
    vi.mocked(db.organization.count).mockResolvedValue(10);
    vi.mocked(db.auditLog.count).mockResolvedValue(200);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  // ── Response structure ──────────────────────────────────────────────

  it('returns verified: true when query latency is under 5000ms', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.organization.count).mockResolvedValue(5);
    vi.mocked(db.auditLog.count).mockResolvedValue(100);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.verified).toBe(true);
  });

  it('returns lastBackup as a valid ISO date string', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.organization.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(() => new Date(body.lastBackup)).not.toThrow();
  });

  it('returns durationMs as a positive number', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.organization.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.durationMs).toBe('number');
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes diagnostics object with queryLatencyMs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(25);
    vi.mocked(db.organization.count).mockResolvedValue(7);
    vi.mocked(db.auditLog.count).mockResolvedValue(150);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.diagnostics).toBeDefined();
    expect(body.diagnostics).toHaveProperty('queryLatencyMs');
    expect(typeof body.diagnostics.queryLatencyMs).toBe('number');
  });

  // ── Diagnostics counts ────────────────────────────────────────────

  it('includes entity counts in diagnostics', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(33);
    vi.mocked(db.organization.count).mockResolvedValue(12);
    vi.mocked(db.auditLog.count).mockResolvedValue(444);

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);
    const body = await res.json();

    expect(body.diagnostics.signalCount).toBe(33);
    expect(body.diagnostics.organizationCount).toBe(12);
    expect(body.diagnostics.auditLogCount).toBe(444);
  });

  it('executes raw SQL query for connectivity check', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(1);
    vi.mocked(db.organization.count).mockResolvedValue(1);
    vi.mocked(db.auditLog.count).mockResolvedValue(1);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(db.$queryRaw).toHaveBeenCalled();
  });

  // ── Logging ───────────────────────────────────────────────────────

  it('logs start and completion on success', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(10);
    vi.mocked(db.organization.count).mockResolvedValue(3);
    vi.mocked(db.auditLog.count).mockResolvedValue(20);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith('cron/backup-verify: started');
    expect(logger.info).toHaveBeenCalledWith(
      'cron/backup-verify: completed',
      expect.objectContaining({ verified: true }),
    );
  });

  it('logs diagnostic details in completion', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ _1: 1 }]);
    vi.mocked(db.signal.count).mockResolvedValue(55);
    vi.mocked(db.organization.count).mockResolvedValue(15);
    vi.mocked(db.auditLog.count).mockResolvedValue(300);

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.info).toHaveBeenCalledWith(
      'cron/backup-verify: completed',
      expect.objectContaining({
        signalCount: 55,
        organizationCount: 15,
        auditLogCount: 300,
      }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 503 when database query fails', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Connection refused'));

    const req = makeRequest(CRON_SECRET);
    const res = await GET(req);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Database health check failed');
    expect(logger.error).toHaveBeenCalledWith(
      'cron/backup-verify: failed',
      expect.objectContaining({ error: 'Connection refused' }),
    );
  });

  it('includes durationMs in error logs', async () => {
    vi.mocked(validateCronSecret).mockReturnValue(true);
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Timeout'));

    const req = makeRequest(CRON_SECRET);
    await GET(req);

    expect(logger.error).toHaveBeenCalledWith(
      'cron/backup-verify: failed',
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });
});
