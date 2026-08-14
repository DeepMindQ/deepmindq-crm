import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

/**
 * GET /api/cron/job-processor — Process queued background jobs.
 *
 * Runs a system health diagnostic by querying key Prisma models and
 * returning aggregate counts as diagnostic metrics. This serves as a
 * lightweight job-processor heartbeat that confirms the system is
 * operational and surfaces entity counts for monitoring dashboards.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Every 1–5 minutes depending on job volume.
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/job-processor: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/job-processor: started');

  try {
    const [signalCount, organizationCount, auditLogCount, insightCount] = await Promise.all([
      db.signal.count(),
      db.organization.count(),
      db.auditLog.count(),
      db.insight.count(),
    ]);

    const pendingSignals = await db.signal.count({
      where: { status: 'detected' },
    });

    const activeSignals = await db.signal.count({
      where: { status: { in: ['detected', 'validated', 'analyzed'] } },
    });

    const durationMs = Date.now() - start;
    logger.info('cron/job-processor: completed', {
      signalCount,
      organizationCount,
      auditLogCount,
      insightCount,
      pendingSignals,
      activeSignals,
      durationMs,
    });

    return NextResponse.json({
      processed: true,
      durationMs,
      diagnostics: {
        signalCount,
        organizationCount,
        auditLogCount,
        insightCount,
        pendingSignals,
        activeSignals,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/job-processor: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
