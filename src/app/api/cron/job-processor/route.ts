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

    // ── Entity Resolution: Auto-merge high-confidence duplicates ──
    let entityResolutionStats = { orgsScanned: 0, autoMerged: 0, scoresUpdated: 0 };
    try {
      const { resolveEntity, mergeOrganizations, computeIntelligenceScores } =
        await import('@/lib/intelligence/knowledge-graph');

      const orgs = await db.organization.findMany({
        select: { id: true, name: true, domain: true },
        take: 50,
      });
      let autoMerged = 0;

      for (const org of orgs) {
        try {
          const matches = await resolveEntity({ name: org.name });
          const highConfidence = matches.filter((m) => m.score >= 95 && m.nodeId !== org.id);
          for (const match of highConfidence) {
            await mergeOrganizations(org.id, match.nodeId);
            autoMerged++;
          }
        } catch {
          /* non-blocking */
        }
      }

      const scoresUpdated = await computeIntelligenceScores();
      entityResolutionStats = {
        orgsScanned: orgs.length,
        autoMerged,
        scoresUpdated,
      };

      logger.info('cron/job-processor: entity resolution complete', entityResolutionStats);
    } catch (erError) {
      logger.warn('cron/job-processor: entity resolution failed (non-blocking)', {
        error: erError instanceof Error ? erError.message : 'Unknown',
      });
    }

    // ── Signal Detection: Run across all active organizations ──
    let signalDetectionResult = { scanned: 0, signalsFound: 0 };
    try {
      const { runSignalDetectionForAll } = await import('@/lib/intelligence/signals');
      signalDetectionResult = await runSignalDetectionForAll();
      logger.info('cron/job-processor: signal detection complete', signalDetectionResult);
    } catch (sigError) {
      logger.warn('cron/job-processor: signal detection failed (non-blocking)', {
        error: sigError instanceof Error ? sigError.message : 'Unknown',
      });
    }

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
      entityResolutionStats,
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
      entityResolution: entityResolutionStats,
      signalDetection: signalDetectionResult,
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
