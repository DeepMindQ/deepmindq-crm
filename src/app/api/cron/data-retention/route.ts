import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';

/**
 * GET /api/cron/data-retention — Purge old data to prevent unbounded growth.
 *
 * Now includes ingestion data cleanup (#7):
 *   - Delete DataIngestion records older than 90 days (completed/failed only)
 *   - Delete orphaned DataIngestionRow records
 *   - Delete physical files from uploads/ingestion/
 *   - Existing: AuditLog (90 days) + expired Sessions
 *
 * Authentication: Requires `Authorization: Bearer <CRON_SECRET>` header.
 * Recommended schedule: Daily at 02:00.
 */
const RETENTION_DAYS = 90;

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    logger.warn('cron/data-retention: unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  logger.info('cron/data-retention: started');

  const results: Record<string, number> = {};

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoff.toISOString();

    // ── Existing: AuditLog retention (90 days) ──
    const auditResult = await db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    results.auditLogsDeleted = auditResult.count;

    // ── Existing: Expired sessions ──
    const sessionResult = await db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    results.expiredSessionsDeleted = sessionResult.count;

    // ── NEW: Ingestion retention (#7) ──
    // Step 1: Find old completed/failed ingestions
    const oldIngestions = await db.dataIngestion.findMany({
      where: {
        status: { in: ['completed', 'failed'] },
        uploadedAt: { lt: cutoff },
      },
      select: { id: true, storedFilePath: true },
    });

    results.oldIngestionsFound = oldIngestions.length;

    if (oldIngestions.length > 0) {
      const oldIds = oldIngestions.map((i) => i.id);

      // Step 2: Delete ingestion rows (cascade would handle this, but explicit for clarity)
      const rowsResult = await db.dataIngestionRow.deleteMany({
        where: { ingestionId: { in: oldIds } },
      });
      results.ingestionRowsDeleted = rowsResult.count;

      // Step 3: Delete ingestion records
      const ingestionsResult = await db.dataIngestion.deleteMany({
        where: { id: { in: oldIds } },
      });
      results.ingestionsDeleted = ingestionsResult.count;

      // Step 4: Delete physical files from disk
      let filesDeleted = 0;
      for (const ingestion of oldIngestions) {
        if (ingestion.storedFilePath) {
          try {
            await unlink(ingestion.storedFilePath);
            filesDeleted++;
          } catch {
            // File may not exist — ignore
          }
        }
      }
      results.physicalFilesDeleted = filesDeleted;
    }

    // Step 5: Clean orphaned ingestion rows (rows without a parent ingestion)
    const orphanRows = await db.dataIngestionRow.findMany({
      select: { ingestionId: true },
      distinct: ['ingestionId'],
    });
    let orphanCleanupCount = 0;
    for (const row of orphanRows) {
      const exists = await db.dataIngestion.findUnique({ where: { id: row.ingestionId } });
      if (!exists) {
        const del = await db.dataIngestionRow.deleteMany({
          where: { ingestionId: row.ingestionId },
        });
        orphanCleanupCount += del.count;
      }
    }
    results.orphanRowsCleaned = orphanCleanupCount;

    // ── Signal Expiry: Expire old detected signals (90 days) ──
    const expiredSignals = await db.signal.updateMany({
      where: {
        status: 'detected',
        detectedAt: { lt: cutoff },
      },
      data: { status: 'expired' },
    });
    results.expiredSignals = expiredSignals.count;

    const durationMs = Date.now() - start;
    logger.info('cron/data-retention: completed', { results, durationMs });

    return NextResponse.json({
      processed: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoffISO,
      durationMs,
      results,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    logger.error('cron/data-retention: failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
