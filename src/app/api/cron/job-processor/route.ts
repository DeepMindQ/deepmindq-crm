import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { processPendingIngestions } from '@/lib/intelligence/ingestion';

/**
 * GET /api/cron/job-processor — Process queued background jobs.
 *
 * Now includes ingestion job processing:
 *   1. Picks up 'pending' DataIngestion records with storedFilePath
 *   2. Runs the ingestion engine on each
 *   3. Reports diagnostics
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header.
 * Recommended schedule: Every 2–5 minutes.
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

    // ── NEW: Process pending ingestion jobs (#9) ──
    const ingestionResult = await processPendingIngestions();

    // ── NEW: Ingestion diagnostics ──
    const [ingestionTotal, ingestionPending, ingestionCompleted, ingestionFailed] =
      await Promise.all([
        db.dataIngestion.count(),
        db.dataIngestion.count({ where: { status: 'pending' } }),
        db.dataIngestion.count({ where: { status: 'completed' } }),
        db.dataIngestion.count({ where: { status: 'failed' } }),
      ]);

    const durationMs = Date.now() - start;
    logger.info('cron/job-processor: completed', {
      signalCount,
      organizationCount,
      auditLogCount,
      insightCount,
      pendingSignals,
      activeSignals,
      ingestionResult,
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
      ingestion: {
        total: ingestionTotal,
        pending: ingestionPending,
        completed: ingestionCompleted,
        failed: ingestionFailed,
        processedThisRun: ingestionResult.processed,
        errorsThisRun: ingestionResult.errors,
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
