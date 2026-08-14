/**
 * GET /api/health/metrics — Prometheus-compatible Metrics Exporter
 * ════════════════════════════════════════════════════════════════
 *
 * Exposes DeepMindQ platform metrics in Prometheus text format.
 * No auth required (standard for Prometheus scrapes).
 * Content-Type: text/plain per Prometheus spec.
 *
 * Each metric source is wrapped in try/catch so a failure in one
 * source never breaks the entire endpoint.
 */

import { metrics as monitoringMetrics, collectSystemMetrics } from '@/lib/monitoring';
import { getApiMetrics } from '@/lib/api-observability';
import { ModelRouter } from '@/lib/engines/model-router';

export const dynamic = 'force-dynamic';

// ── Prometheus Helpers ─────────────────────────────────────────

/** Build a Prometheus HELP + TYPE + value block */
function metricHelpTypeValue(
  name: string,
  help: string,
  type: 'counter' | 'gauge' | 'histogram' | 'summary',
  value: number,
): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}`;
}

function safeNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  return fallback;
}

export async function GET() {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# DeepMindQ Platform Metrics');
  lines.push(`# Scraped at ${now}`);
  lines.push('');

  // ── Platform liveness ───────────────────────────────────────
  lines.push(
    metricHelpTypeValue(
      'deepmindq_up',
      'Whether the DeepMindQ platform is up (1 = up)',
      'gauge',
      1,
    ),
  );
  lines.push('');

  lines.push(
    metricHelpTypeValue(
      'deepmindq_uptime_seconds',
      'Process uptime in seconds',
      'gauge',
      process.uptime(),
    ),
  );
  lines.push('');

  // ── System metrics (from monitoring.ts) ────────────────────
  try {
    collectSystemMetrics();
    const agg = monitoringMetrics.getAggregates();

    const memUsed = safeNumber(agg['system.memory.rss']?.last, 0);
    // Convert MB → bytes (the monitoring record stores MB)
    const memBytes = Math.round(memUsed * 1024 * 1024);
    lines.push(
      metricHelpTypeValue(
        'deepmindq_memory_usage_bytes',
        'Process RSS memory usage in bytes',
        'gauge',
        memBytes,
      ),
    );
    lines.push('');

    // GC collections — approximated from monitoring aggregates if present
    const gcCount = safeNumber(agg['system.gc.collections']?.last, 0);
    lines.push(
      metricHelpTypeValue(
        'deepmindq_gc_collections_total',
        'Total GC collections since startup',
        'counter',
        gcCount,
      ),
    );
    lines.push('');
  } catch (err) {
    lines.push(
      `# ERROR collecting system metrics: ${err instanceof Error ? err.message : String(err)}`,
    );
    lines.push('deepmindq_memory_usage_bytes 0');
    lines.push('deepmindq_gc_collections_total 0');
    lines.push('');
  }

  // ── HTTP metrics (from api-observability.ts) ────────────────
  try {
    const apiMetrics = getApiMetrics();

    lines.push(
      metricHelpTypeValue(
        'deepmindq_http_requests_total',
        'Total HTTP requests since startup',
        'counter',
        safeNumber(apiMetrics.totalRequests),
      ),
    );
    lines.push('');

    const errorCount =
      apiMetrics.totalRequests > 0
        ? Math.round(apiMetrics.errorRate * apiMetrics.totalRequests)
        : 0;
    lines.push(
      metricHelpTypeValue(
        'deepmindq_http_errors_total',
        'Total HTTP error responses (4xx + 5xx) since startup',
        'counter',
        errorCount,
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_http_request_duration_p50_ms',
        'HTTP request duration P50 in milliseconds',
        'gauge',
        safeNumber(apiMetrics.p50LatencyMs),
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_http_request_duration_p95_ms',
        'HTTP request duration P95 in milliseconds',
        'gauge',
        safeNumber(apiMetrics.p95LatencyMs),
      ),
    );
    lines.push('');
  } catch (err) {
    lines.push(
      `# ERROR collecting HTTP metrics: ${err instanceof Error ? err.message : String(err)}`,
    );
    lines.push('deepmindq_http_requests_total 0');
    lines.push('deepmindq_http_errors_total 0');
    lines.push('deepmindq_http_request_duration_p50_ms 0');
    lines.push('deepmindq_http_request_duration_p95_ms 0');
    lines.push('');
  }

  // ── DB metrics (from database-enterprise-monitor.ts) ───────
  try {
    const { getDatabaseHealthReport } = await import('@/lib/database-enterprise-monitor');
    const report = await getDatabaseHealthReport();

    // Pool metrics from persistence adapter (if available)
    let activeConnections = 0;
    let maxConnections = 0;
    try {
      const { getPersistenceAdapter } =
        await import('@/lib/persistence/intelligence-persistence-adapter');
      const poolMetrics = await getPersistenceAdapter().getPoolMetrics();
      if (poolMetrics) {
        activeConnections = poolMetrics.activeConnections;
        maxConnections = poolMetrics.totalConnections;
      }
    } catch {
      // Pool metrics not available — use report performance stats
    }

    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_connections_active',
        'Active database connections',
        'gauge',
        safeNumber(activeConnections),
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_connections_max',
        'Maximum database connections in pool',
        'gauge',
        safeNumber(maxConnections),
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_query_latency_p95_ms',
        'Database query P95 latency in milliseconds',
        'gauge',
        safeNumber(report.performanceStats.p95LatencyMs),
      ),
    );
    lines.push('');
  } catch (err) {
    lines.push(
      `# ERROR collecting DB metrics: ${err instanceof Error ? err.message : String(err)}`,
    );
    lines.push('deepmindq_db_connections_active 0');
    lines.push('deepmindq_db_connections_max 0');
    lines.push('deepmindq_db_query_latency_p95_ms 0');
    lines.push('');
  }

  // ── AI Provider metrics (from ModelRouter) ─────────────────
  try {
    const perfStats = ModelRouter.getPerformanceStats();

    let totalCalls = 0;
    let totalErrors = 0;
    let circuitBreakerOpen = 0;

    for (const provider of perfStats) {
      totalCalls += provider.totalCalls;
      totalErrors += provider.failedCalls;
      if (provider.circuitOpen) circuitBreakerOpen++;
    }

    lines.push(
      metricHelpTypeValue(
        'deepmindq_ai_provider_calls_total',
        'Total AI provider LLM calls since startup',
        'counter',
        totalCalls,
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_ai_provider_errors_total',
        'Total AI provider call failures since startup',
        'counter',
        totalErrors,
      ),
    );
    lines.push('');

    lines.push(
      metricHelpTypeValue(
        'deepmindq_ai_provider_circuit_breaker_open',
        'Number of AI providers with circuit breaker currently open',
        'gauge',
        circuitBreakerOpen,
      ),
    );
    lines.push('');
  } catch (err) {
    lines.push(
      `# ERROR collecting AI provider metrics: ${err instanceof Error ? err.message : String(err)}`,
    );
    lines.push('deepmindq_ai_provider_calls_total 0');
    lines.push('deepmindq_ai_provider_errors_total 0');
    lines.push('deepmindq_ai_provider_circuit_breaker_open 0');
    lines.push('');
  }

  // ── Event Loop Lag (from monitoring aggregates) ──
  try {
    const agg = monitoringMetrics.getAggregates();
    const eventLoopLag = safeNumber(agg['system.event_loop_lag']?.last, 0);
    lines.push(
      metricHelpTypeValue(
        'deepmindq_event_loop_lag_ms',
        'Event loop lag in milliseconds',
        'gauge',
        eventLoopLag,
      ),
    );
    lines.push('');
  } catch {
    /* ignore */
  }

  // ── DB Query Performance (from database-performance-monitor) ──
  try {
    const { getDbPerformanceStats } = await import('@/lib/database-performance-monitor');
    const dbPerf = getDbPerformanceStats();
    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_queries_per_second',
        'Database queries per second',
        'gauge',
        safeNumber(dbPerf.queriesPerSecond),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_query_latency_p50_ms',
        'Database query P50 latency in milliseconds',
        'gauge',
        safeNumber(dbPerf.p50LatencyMs),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_query_latency_p99_ms',
        'Database query P99 latency in milliseconds',
        'gauge',
        safeNumber(dbPerf.p99LatencyMs),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_db_slow_queries_total',
        'Total slow database queries in current window',
        'gauge',
        safeNumber(dbPerf.slowQueryCount),
      ),
    );
    lines.push('');
  } catch {
    /* ignore */
  }

  // ── Memory Health (from memory-resource-monitor) ──
  try {
    const { getMemoryHealth } = await import('@/lib/memory-resource-monitor');
    const memHealth = getMemoryHealth();
    lines.push(
      metricHelpTypeValue(
        'deepmindq_heap_usage_percent',
        'Heap usage percentage',
        'gauge',
        safeNumber(memHealth.heapUsagePercentage),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_memory_growth_rate_mb_per_min',
        'Memory growth rate in MB per minute',
        'gauge',
        safeNumber(memHealth.memoryGrowthRateMbPerMin),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_ai_active_contexts',
        'Number of active AI processing contexts',
        'gauge',
        safeNumber(memHealth.aiContextStats.activeContexts),
      ),
    );
    lines.push('');
  } catch {
    /* ignore */
  }

  // ── Incident Metrics ──
  try {
    const { incidentManager } = await import('@/lib/incident-manager');
    const summary = incidentManager.getSummary();
    lines.push(
      metricHelpTypeValue(
        'deepmindq_incidents_active',
        'Number of active incidents',
        'gauge',
        safeNumber(summary.active),
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_incidents_sla_breached',
        'Number of incidents with breached SLA',
        'gauge',
        safeNumber(summary.slaBreached),
      ),
    );
    lines.push('');
  } catch {
    /* ignore */
  }

  // ── SLA Breach Metrics (from sla-monitor.ts) ──
  try {
    const { getRouteSLAReport, getRawRouteStats, getSLAThreshold } =
      await import('@/lib/sla-monitor');
    const slaReport = getRouteSLAReport();
    for (const route of slaReport) {
      const routeLabel = route.route.replace(/"/g, '\\"');
      const categoryLabel = route.category;
      lines.push(
        `# HELP deepmindq_api_sla_breach_total Total SLA breaches per route\n# TYPE deepmindq_api_sla_breach_total counter\ndeepmindq_api_sla_breach_total{route="${routeLabel}",category="${categoryLabel}"} ${route.breachCount}`,
      );
      lines.push(
        `# HELP deepmindq_api_sla_p99_ms Current P99 latency per route\n# TYPE deepmindq_api_sla_p99_ms gauge\ndeepmindq_api_sla_p99_ms{route="${routeLabel}",category="${categoryLabel}"} ${route.p99Ms}`,
      );
      lines.push(
        `# HELP deepmindq_api_sla_threshold_ms SLA P99 threshold per route\n# TYPE deepmindq_api_sla_threshold_ms gauge\ndeepmindq_api_sla_threshold_ms{route="${routeLabel}",category="${categoryLabel}"} ${route.slaThreshold}`,
      );
      lines.push(
        `# HELP deepmindq_api_sla_compliant Whether route P99 is within SLA (1=compliant, 0=breached)\n# TYPE deepmindq_api_sla_compliant gauge\ndeepmindq_api_sla_compliant{route="${routeLabel}",category="${categoryLabel}"} ${route.currentP99Compliant ? 1 : 0}`,
      );
    }
    if (slaReport.length > 0) {
      lines.push('');
    }
  } catch {
    /* ignore */
  }

  // ── Raw process memory (fallback if monitoring aggregates empty) ─
  try {
    const mem = process.memoryUsage();
    // Only emit if we didn't already emit from monitoring (avoid duplicates)
    const agg = monitoringMetrics.getAggregates();
    if (!agg['system.memory.rss']) {
      lines.push(
        metricHelpTypeValue(
          'deepmindq_memory_usage_bytes',
          'Process RSS memory usage in bytes',
          'gauge',
          mem.rss,
        ),
      );
      lines.push('');
    }
  } catch {
    // ignore
  }

  // ── Intelligence Cache Metrics ──
  try {
    const { getCacheStats } = await import('@/lib/intelligence-cache');
    const cacheStats = getCacheStats();
    lines.push(
      metricHelpTypeValue(
        'deepmindq_intelligence_cache_memory_entries',
        'Number of entries in the in-memory intelligence cache',
        'gauge',
        cacheStats.memoryEntries,
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_intelligence_cache_memory_max_entries',
        'Maximum capacity of the in-memory intelligence cache',
        'gauge',
        cacheStats.memoryMaxEntries,
      ),
    );
    lines.push('');
    lines.push(
      metricHelpTypeValue(
        'deepmindq_intelligence_cache_redis_available',
        'Whether Redis is available for intelligence caching (1 = available)',
        'gauge',
        cacheStats.redisAvailable ? 1 : 0,
      ),
    );
    lines.push('');
  } catch {
    lines.push('# ERROR collecting intelligence cache metrics');
    lines.push('deepmindq_intelligence_cache_memory_entries 0');
    lines.push('deepmindq_intelligence_cache_memory_max_entries 0');
    lines.push('deepmindq_intelligence_cache_redis_available 0');
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
