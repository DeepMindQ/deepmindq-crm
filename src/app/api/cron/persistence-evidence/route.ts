import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

/**
 * GET /api/cron/persistence-evidence — Collect evidence metrics.
 *
 * Queries the database for recent activity counts to measure evidence
 * collection health:
 * - Signals detected in the last hour.
 * - Evidence records created in the last hour.
 * - Audit logs created in the last hour.
 * - Insights generated in the last hour.
 *
 * These counts serve as evidence that the intelligence pipeline is actively
 * collecting and persisting data.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Every 15–30 minutes.
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/persistence-evidence: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/persistence-evidence: started');

  try {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const [recentSignals, recentEvidence, recentAuditLogs, recentInsights] = await Promise.all([
      db.signal.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      db.evidence.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      db.auditLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      db.insight.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
    ]);

    const evidenceCollected = recentSignals + recentEvidence;

    const durationMs = Date.now() - start;
    logger.info('cron/persistence-evidence: completed', {
      evidenceCollected,
      recentSignals,
      recentEvidence,
      recentAuditLogs,
      recentInsights,
      durationMs,
    });

    return NextResponse.json({
      evidenceCollected,
      durationMs,
      metrics: {
        signalsLastHour: recentSignals,
        evidenceLastHour: recentEvidence,
        auditLogsLastHour: recentAuditLogs,
        insightsLastHour: recentInsights,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/persistence-evidence: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
