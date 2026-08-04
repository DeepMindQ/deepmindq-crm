/**
 * POST /api/cron/persistence-evidence — Shadow Mode Evidence Collection
 * ==================================================================
 *
 * WI-18.2 Phase 3.5 — Cron endpoint for collecting shadow mode evidence
 * during the 7-day staging validation period.
 *
 * Triggered daily by Vercel Cron. Collects:
 *   1. Persistence reliability metrics (writes, failures, retries, dead letters)
 *   2. Shadow reconciliation (Map vs DB comparison for all stores)
 *   3. Operational health snapshots
 *   4. Cold start metrics
 *   5. Performance observation (DB latency, process memory, per-store write latency)
 *
 * Auth: CRON_SECRET bearer token (same pattern as /api/cron/job-processor).
 *
 * Evidence is stored in:
 *   - PersistenceHealthSnapshot (per-store health)
 *   - ShadowModeReconciliation (Map vs DB comparison)
 *   - PersistenceOperationLog (audit trail)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

interface EvidenceReport {
  timestamp: string;
  durationMs: number;
  persistence: {
    enabled: boolean;
    shadowMode: boolean;
  };
  reliability: {
    totalWrites: number;
    totalFailures: number;
    failureRate: string;
    queueDepth: number;
    deadLetterCount: number;
    recoveryRate: string;
  };
  health: {
    overallHealth: string;
    unhealthyStores: string[];
    criticalExists: boolean;
    alerts: Array<{
      store: string;
      level: string;
      message: string;
      timestamp: string;
    }>;
  };
  startup: {
    status: string;
    completeness: number;
    durationMs: number;
  };
  reconciliation: Array<{
    store: string;
    mapCount: number;
    dbCount: number;
    missingFromDb: number;
    missingFromMap: number;
    mismatched: number;
    durationMs: number;
  }> | null;
  performance: {
    dbLatencyMs: number;
    processMemoryMb: { heapUsed: number; heapTotal: number; rss: number };
    perStoreLatency: { store: string; lastWriteLatencyMs: number | null; avgLatencyMs: number | null }[];
  };
  errors: string[];
}

export async function POST(request: Request) {
  const startTime = Date.now();

  // Auth check
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check persistence is enabled
  const isEnabled = process.env.USE_DB_PERSISTENCE === 'true';
  const isShadow = process.env.PERSISTENCE_SHADOW_MODE === 'true';

  if (!isEnabled) {
    return NextResponse.json({
      ok: true,
      message: 'Persistence disabled — no evidence to collect',
      timestamp: new Date().toISOString(),
    });
  }

  const report: EvidenceReport = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    persistence: { enabled: isEnabled, shadowMode: isShadow },
    reliability: { totalWrites: 0, totalFailures: 0, failureRate: '0%', queueDepth: 0, deadLetterCount: 0, recoveryRate: '100%' },
    health: { overallHealth: 'unknown', unhealthyStores: [], criticalExists: false, alerts: [] },
    startup: { status: 'unknown', completeness: 0, durationMs: 0 },
    reconciliation: null,
    performance: {
      dbLatencyMs: -1,
      processMemoryMb: { heapUsed: 0, heapTotal: 0, rss: 0 },
      perStoreLatency: [],
    },
    errors: [],
  };

  try {
    // 1. Collect health monitor evidence
    try {
      const { getPersistenceHealthMonitor } = await import('@/lib/persistence/persistence-health-monitor');
      const monitor = getPersistenceHealthMonitor();
      const healthReport = monitor.generateHealthReport();

      report.health = {
        overallHealth: healthReport.overallHealth,
        unhealthyStores: healthReport.stores.filter(s => !s.healthy).map(s => s.store),
        criticalExists: healthReport.criticalFailureExists,
        alerts: healthReport.alerts.slice(-20).map(a => ({
          store: a.store,
          level: a.level,
          message: a.message,
          timestamp: new Date(a.timestamp).toISOString(),
        })),
      };

      report.reliability.totalWrites = healthReport.totalWrites;
      report.reliability.totalFailures = healthReport.totalFailures;
      report.reliability.failureRate = healthReport.totalWrites > 0
        ? ((healthReport.totalFailures / healthReport.totalWrites) * 100).toFixed(2) + '%'
        : '0%';
    } catch (err) {
      report.errors.push(`Health monitor: ${err}`);
    }

    // 2. Collect failure queue evidence
    try {
      const { getPersistenceFailureQueue } = await import('@/lib/persistence/persistence-failure-queue');
      const queue = getPersistenceFailureQueue();
      const [depth, deadLetter] = await Promise.all([queue.getQueueDepth(), queue.getDeadLetterCount()]);
      const stats = queue.getStats();

      report.reliability.queueDepth = depth;
      report.reliability.deadLetterCount = deadLetter;
      report.reliability.recoveryRate = stats.totalRetried > 0
        ? ((stats.totalRecovered / stats.totalRetried) * 100).toFixed(1) + '%'
        : '100%';
    } catch (err) {
      report.errors.push(`Failure queue: ${err}`);
    }

    // 3. Collect startup evidence
    try {
      const { getPersistenceStartupReport } = await import('@/lib/persistence/cold-start-loader');
      const startupReport = getPersistenceStartupReport();

      report.startup = {
        status: startupReport.status,
        completeness: startupReport.overallCompleteness,
        durationMs: startupReport.startupDurationMs,
      };
    } catch (err) {
      report.errors.push(`Startup: ${err}`);
    }

    // 4. Collect shadow reconciliation evidence (only in shadow mode)
    if (isShadow) {
      try {
        const { reconcileAllStores } = await import('@/lib/persistence/shadow-mode-comparator');
        const reconciliationResults = await reconcileAllStores();

        report.reconciliation = reconciliationResults.map(r => ({
          store: r.store,
          mapCount: r.mapCount,
          dbCount: r.dbCount,
          missingFromDb: r.missingFromDb,
          missingFromMap: r.missingFromMap,
          mismatched: r.mismatchedEntries,
          durationMs: r.durationMs,
        }));
      } catch (err) {
        report.errors.push(`Reconciliation: ${err}`);
      }
    }

    // 5. Collect performance observation evidence
    try {
      // DB round-trip latency
      const { Prisma } = require('@prisma/client');
      const prisma = new Prisma();

      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1 as _1`;
      report.performance.dbLatencyMs = Date.now() - dbStart;

      await prisma.$disconnect();
    } catch (err) {
      report.errors.push(`Performance DB latency: ${err}`);
    }

    // Process memory usage
    try {
      const mem = process.memoryUsage();
      report.performance.processMemoryMb = {
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
        rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      };
    } catch (err) {
      report.errors.push(`Performance memory: ${err}`);
    }

    // Per-store write latency from health report (reuse section 1 data)
    try {
      const { getPersistenceHealthMonitor } = await import('@/lib/persistence/persistence-health-monitor');
      const monitor = getPersistenceHealthMonitor();
      const healthReport = monitor.generateHealthReport();

      report.performance.perStoreLatency = healthReport.stores.map(s => ({
        store: s.store,
        lastWriteLatencyMs: s.totalWrites > 0 ? s.lastWriteLatencyMs : null,
        avgLatencyMs: null, // Aggregate avg not tracked per-store; null indicates N/A
      }));
    } catch (err) {
      report.errors.push(`Performance per-store latency: ${err}`);
    }

    report.durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      report,
      collectedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Evidence collection failed',
        message: error instanceof Error ? error.message : String(error),
        partialReport: report,
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggering (with auth)
export async function GET(request: Request) {
  return POST(request);
}
