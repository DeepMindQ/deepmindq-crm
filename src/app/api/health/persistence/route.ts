/**
 * GET /api/health/persistence — Persistence Engine Operational Health
 * =================================================================
 *
 * WI-18.2 Phase 3.5 — Provides real-time persistence health data
 * for the 7-day staging shadow validation period.
 *
 * Returns:
 *   - Feature flag state
 *   - Per-store health (success/failure counts, latency, consecutive failures)
 *   - Failure queue stats (depth, dead-letter count, recovery rate)
 *   - Cold start status (last startup report)
 *   - Overall persistence health assessment
 *
 * Used by:
 *   - Staging monitoring dashboards
 *   - Cron evidence collection (Phase 3.5 reports)
 *   - Operational health checks during shadow period
 *
 * Auth: None — persistence health is operational telemetry (no secrets).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Feature flag state
    const flags = {
      useDbPersistence: process.env.USE_DB_PERSISTENCE === 'true',
      shadowMode: process.env.PERSISTENCE_SHADOW_MODE === 'true',
      requireFullLoad: process.env.PERSISTENCE_REQUIRE_FULL_LOAD !== 'false',
      maxLoadTimeMs: parseInt(process.env.PERSISTENCE_MAX_LOAD_TIME_MS || '60000', 10),
      degradedThreshold: parseFloat(process.env.PERSISTENCE_DEGRADED_THRESHOLD || '0.8'),
    };

    // Import persistence modules dynamically to avoid cold-start cost when disabled
    let healthData: Record<string, unknown> = {};
    let queueData: Record<string, unknown> = {};
    let startupData: Record<string, unknown> = {};

    if (flags.useDbPersistence) {
      try {
        const { getPersistenceHealthMonitor } =
          await import('@/lib/persistence/persistence-health-monitor');
        const monitor = getPersistenceHealthMonitor();
        const report = monitor.generateHealthReport();

        healthData = {
          overallHealth: report.overallHealth,
          totalWrites: report.totalWrites,
          totalFailures: report.totalFailures,
          unhealthyCount: report.unhealthyCount,
          criticalFailureExists: report.criticalFailureExists,
          recentAlerts: report.alerts.slice(-20).map((a) => ({
            store: a.store,
            level: a.level,
            consecutiveFailures: a.consecutiveFailures,
            message: a.message,
            timestamp: new Date(a.timestamp).toISOString(),
          })),
          stores: report.stores.map((s) => ({
            store: s.store,
            healthy: s.healthy,
            totalWrites: s.totalWrites,
            totalFailures: s.totalFailures,
            consecutiveFailures: s.consecutiveFailures,
            lastWriteLatencyMs: s.lastWriteLatencyMs,
            lastWriteAt: s.lastWriteAt ? new Date(s.lastWriteAt).toISOString() : null,
          })),
        };
      } catch (err) {
        healthData = { error: 'Failed to load health monitor', message: String(err) };
      }

      try {
        const { getPersistenceFailureQueue } =
          await import('@/lib/persistence/persistence-failure-queue');
        const queue = getPersistenceFailureQueue();
        const [queueDepth, deadLetterCount] = await Promise.all([
          queue.getQueueDepth(),
          queue.getDeadLetterCount(),
        ]);
        const stats = queue.getStats();

        queueData = {
          queueDepth,
          deadLetterCount,
          totalEnqueued: stats.totalEnqueued,
          totalRetried: stats.totalRetried,
          totalRecovered: stats.totalRecovered,
          totalDeadLettered: stats.totalDeadLettered,
          lastProcessAt: stats.lastProcessAt ? new Date(stats.lastProcessAt).toISOString() : null,
          recoveryRate:
            stats.totalRetried > 0
              ? ((stats.totalRecovered / stats.totalRetried) * 100).toFixed(1) + '%'
              : '100%',
        };
      } catch (err) {
        queueData = { error: 'Failed to load failure queue', message: String(err) };
      }

      try {
        const { getPersistenceStartupReport, getPersistenceStartupStatus, isPersistenceDegraded } =
          await import('@/lib/persistence/cold-start-loader');

        startupData = {
          startupStatus: getPersistenceStartupStatus(),
          degraded: isPersistenceDegraded(),
          ...getPersistenceStartupReport(),
        };
      } catch (err) {
        startupData = { error: 'Failed to load startup data', message: String(err) };
      }
    }

    const responseDurationMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: flags.useDbPersistence ? 'active' : 'disabled',
        mode: flags.shadowMode ? 'shadow' : flags.useDbPersistence ? 'full' : 'off',
        timestamp: new Date().toISOString(),
        responseDurationMs,

        flags,
        health: healthData,
        queue: queueData,
        startup: startupData,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Persistence health check failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
