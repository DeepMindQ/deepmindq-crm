/**
 * POST /api/cron/persistence-performance — Performance Observation Evidence
 * =====================================================================
 *
 * WI-18.2 Phase 3.5 — Cron endpoint for collecting Category 5:
 * Performance Observation data during the 7-day staging shadow
 * validation period.
 *
 * Collects:
 *   - Persistence write latency (per-store from health monitor)
 *   - Persistence queue depth (from failure queue)
 *   - DB connectivity check (SELECT 1 round-trip latency)
 *   - Cold start metrics (from cold-start-loader report)
 *   - Process memory usage (heapUsed, heapTotal, rss)
 *   - Persistence operation counts (from health monitor)
 *   - Recovery rate (from failure queue stats)
 *
 * Auth: CRON_SECRET bearer token (same pattern as /api/cron/persistence-evidence).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

interface PerformanceReport {
  timestamp: string;
  durationMs: number;
  persistence: {
    enabled: boolean;
    shadowMode: boolean;
  };
  dbLatencyMs: number;
  persistenceLatency: {
    store: string;
    lastWriteLatencyMs: number | null;
    totalWrites: number;
    totalFailures: number;
  }[];
  queueDepth: number;
  recoveryRate: string;
  coldStart: {
    status: string;
    completeness: number;
    startupDurationMs: number;
  } | null;
  processMemory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
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

  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    persistence: { enabled: isEnabled, shadowMode: isShadow },
    dbLatencyMs: -1,
    persistenceLatency: [],
    queueDepth: 0,
    recoveryRate: '100%',
    coldStart: null,
    processMemory: { heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 },
    errors: [],
  };

  try {
    // 1. Collect per-store persistence latency from health monitor
    try {
      const { getPersistenceHealthMonitor } = await import('@/lib/persistence/persistence-health-monitor');
      const monitor = getPersistenceHealthMonitor();
      const healthReport = monitor.generateHealthReport();

      report.persistenceLatency = healthReport.stores.map(s => ({
        store: s.store,
        lastWriteLatencyMs: s.totalWrites > 0 ? s.lastWriteLatencyMs : null,
        totalWrites: s.totalWrites,
        totalFailures: s.totalFailures,
      }));
    } catch (err) {
      report.errors.push(`Health monitor: ${err}`);
    }

    // 2. Collect failure queue depth and recovery rate
    try {
      const { getPersistenceFailureQueue } = await import('@/lib/persistence/persistence-failure-queue');
      const queue = getPersistenceFailureQueue();
      const depth = await queue.getQueueDepth();
      const stats = queue.getStats();

      report.queueDepth = depth;
      report.recoveryRate = stats.totalRetried > 0
        ? ((stats.totalRecovered / stats.totalRetried) * 100).toFixed(1) + '%'
        : '100%';
    } catch (err) {
      report.errors.push(`Failure queue: ${err}`);
    }

    // 3. Measure DB round-trip latency (SELECT 1)
    if (isEnabled) {
      try {
        const { Prisma } = require('@prisma/client');
        const prisma = new Prisma();

        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1 as _1`;
        report.dbLatencyMs = Date.now() - dbStart;

        await prisma.$disconnect();
      } catch (err) {
        report.errors.push(`DB latency check: ${err}`);
        report.dbLatencyMs = -1;
      }
    }

    // 4. Collect cold start metrics
    try {
      const { getPersistenceStartupReport } = await import('@/lib/persistence/cold-start-loader');
      const startupReport = getPersistenceStartupReport();

      report.coldStart = {
        status: startupReport.status,
        completeness: startupReport.overallCompleteness,
        startupDurationMs: startupReport.startupDurationMs,
      };
    } catch (err) {
      report.errors.push(`Cold start: ${err}`);
    }

    // 5. Collect process memory usage
    try {
      const mem = process.memoryUsage();
      report.processMemory = {
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
        rssMb: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      };
    } catch (err) {
      report.errors.push(`Process memory: ${err}`);
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
        error: 'Performance evidence collection failed',
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
