import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

const AUDIT_LOG_RETENTION_DAYS = 90;

/**
 * GET /api/cron/data-retention — Enforce data retention policies.
 *
 * Scans the persistence layer for expired records and purges them in
 * accordance with configured retention policies:
 * - AuditLog records older than 90 days are deleted.
 * - Expired sessions (where expiresAt < now) are deleted.
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header
 *                where CRON_SECRET matches the server-side env var.
 *
 * Recommended schedule: Daily (overnight window preferred).
 */
export async function GET(request: NextRequest) {
  // ── Auth gate ──
  if (!validateCronSecret(request)) {
    logger.warn('cron/data-retention: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/data-retention: started');

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUDIT_LOG_RETENTION_DAYS);

    // Purge old audit logs
    const auditLogsPurged = await db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    // Purge expired sessions
    const sessionsPurged = await db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const purged = {
      signals: 0,
      auditLogs: auditLogsPurged.count,
      sessions: sessionsPurged.count,
    };

    const durationMs = Date.now() - start;
    logger.info('cron/data-retention: completed', { purged, durationMs });

    return NextResponse.json({ purged, durationMs });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/data-retention: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
