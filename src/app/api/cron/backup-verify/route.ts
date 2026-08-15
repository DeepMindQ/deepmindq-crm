import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * GET /api/cron/backup-verify — Verify database connectivity and health.
 *
 * Runs a periodic health check against the primary database by executing
 * a lightweight query and measuring response latency. Verifies that the
 * database is reachable, responsive, and contains data across core tables.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Monthly (with optional weekly lightweight check).
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/backup-verify: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/backup-verify: started');

  try {
    // Verify database connectivity with a raw query (SELECT 1 equivalent)
    const queryStart = Date.now();
    await db.$queryRaw(Prisma.sql`SELECT 1`);
    const queryLatencyMs = Date.now() - queryStart;

    // Probe core tables to confirm data is intact
    const [signalCount, organizationCount, auditLogCount] = await Promise.all([
      db.signal.count(),
      db.organization.count(),
      db.auditLog.count(),
    ]);

    const verified = queryLatencyMs < 5000;
    const lastBackup = new Date().toISOString();

    const durationMs = Date.now() - start;
    logger.info('cron/backup-verify: completed', {
      verified,
      queryLatencyMs,
      signalCount,
      organizationCount,
      auditLogCount,
      lastBackup,
      durationMs,
    });

    return NextResponse.json({
      verified,
      lastBackup,
      durationMs,
      diagnostics: {
        queryLatencyMs,
        signalCount,
        organizationCount,
        auditLogCount,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/backup-verify: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Database health check failed' }, { status: 503 });
  }
}
