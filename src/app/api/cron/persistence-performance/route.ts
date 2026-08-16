import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db, PrismaDiagnostics } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * GET /api/cron/persistence-performance — Monitor persistence layer metrics.
 *
 * Probes the database and records performance metrics:
 * - Database read latency via a timed lightweight query.
 * - Prisma connection pool diagnostics (total queries, slow queries).
 * - Table size health via count queries on core models.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Every 1–5 minutes.
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/persistence-performance: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/persistence-performance: started');

  try {
    // Measure database read latency with a raw query
    const dbQueryStart = Date.now();
    await db.$queryRaw(Prisma.sql`SELECT 1`);
    const dbLatencyMs = Date.now() - dbQueryStart;

    // Measure a slightly heavier query (count with index)
    const countQueryStart = Date.now();
    const signalCount = await db.signal.count();
    const countLatencyMs = Date.now() - countQueryStart;

    // Snapshot Prisma diagnostics
    const diagnostics = PrismaDiagnostics.snapshot();

    // Check connection pool by running multiple parallel queries
    const parallelStart = Date.now();
    await Promise.all([
      db.organization.count(),
      db.auditLog.count(),
      db.evidence.count(),
      db.insight.count(),
    ]);
    const parallelLatencyMs = Date.now() - parallelStart;

    const metricsRecorded = true;
    const durationMs = Date.now() - start;

    logger.info('cron/persistence-performance: completed', {
      metricsRecorded,
      dbLatencyMs,
      countLatencyMs,
      parallelLatencyMs,
      diagnostics,
      durationMs,
    });

    return NextResponse.json({
      metricsRecorded,
      durationMs,
      metrics: {
        dbLatencyMs,
        countLatencyMs,
        parallelLatencyMs,
        signalCount,
        poolDiagnostics: {
          totalQueries: diagnostics.totalQueries,
          slowQueries: diagnostics.slowQueries,
        },
      },
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/persistence-performance: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Database performance check failed' }, { status: 503 });
  }
}
