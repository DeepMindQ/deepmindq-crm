/**
 * GET /api/cron/data-retention — Automated Data Archival & Retention
 * ══════════════════════════════════════════════════════════════
 *
 * Called by Vercel Cron daily (5 AM) to enforce data retention policies.
 *
 * Phase 7.4 Upgrade: Now uses configurable RetentionPolicy engine
 * instead of hardcoded retention days. Falls back to legacy hardcoded
 * behavior if the retention policy engine is unavailable.
 *
 * Cleanup flow:
 *   1. Seed default retention policies (if not already configured)
 *   2. Execute configurable retention cleanup via RetentionPolicyEngine
 *   3. Clear expired in-memory cache entries (best-effort)
 *   4. Log summary of deleted counts
 *
 * Auth: CRON_SECRET bearer token (same pattern as /api/cron/job-processor).
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();
  const errors: string[] = [];

  // ── 1. Execute configurable retention cleanup (P7.4) ──────────
  let retentionResult: Record<string, unknown> | null = null;
  try {
    const { seedRetentionPolicies, executeRetentionCleanup } = await import('@/lib/retention-policy-engine');
    // Seed defaults on first run (idempotent upsert)
    await seedRetentionPolicies();
    // Execute cleanup based on configured policies
    const result = await executeRetentionCleanup();
    retentionResult = result as unknown as Record<string, unknown>;
    logger.info('[cron/data-retention] Configurable retention cleanup complete', retentionResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Retention engine: ${msg}`);
    logger.warn('[cron/data-retention] Retention engine failed, attempting legacy cleanup:', { error: msg });

    // ── Legacy Fallback: Hardcoded cleanup ──────────────────────
    try {
      const { db } = await import('@/lib/db');
      const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - NINETY_DAYS_MS);

      const [auditResult, usageResult, signalResult] = await Promise.all([
        db.aIGenerationAudit.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((): { count: number } => ({ count: 0 })),
        db.aIUsageLog.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch((): { count: number } => ({ count: 0 })),
        db.companySignal.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }).catch((): { count: number } => ({ count: 0 })),
      ]);

      retentionResult = {
        totalDeleted: auditResult.count + usageResult.count + signalResult.count,
        entityResults: {
          signals: { deleted: signalResult.count },
          audit_logs: { deleted: auditResult.count },
          usage_logs: { deleted: usageResult.count },
        },
        legacy: true,
      };
    } catch (legacyErr) {
      const legacyMsg = legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
      errors.push(`Legacy cleanup: ${legacyMsg}`);
    }
  }

  // ── 2. Clear expired in-memory cache entries (best-effort) ───────
  try {
    const { dashboardCache, signalCache, notificationCache } =
      await import('@/lib/cache-manager');
    const shortTtlCaches = [
      { name: 'dashboard', cache: dashboardCache },
      { name: 'signal', cache: signalCache },
      { name: 'notification', cache: notificationCache },
    ];
    for (const { cache } of shortTtlCaches) {
      cache.clear();
    }
    logger.info('[cron/data-retention] Cleared short-TTL in-memory caches');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Cache cleanup: ${msg}`);
    logger.warn('[cron/data-retention] Cache cleanup failed:', { error: msg });
  }

  const duration = Date.now() - startTime;

  logger.info(`[cron/data-retention] Complete in ${duration}ms`, {
    totalDeleted: retentionResult ? (retentionResult.totalDeleted as number) : 0,
    errors: errors.length,
  });

  return NextResponse.json({
    ok: true,
    retention: retentionResult,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
