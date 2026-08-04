/**
 * WI-18.4 Phase 4 Hardening — Database Performance Monitor
 *
 * Tracks per-query and aggregate database performance metrics:
 *   - p50, p95, p99 latency percentiles
 *   - Slow query detection with configurable threshold
 *   - Query count per API request
 *   - Most expensive queries by average duration
 *   - Average database latency
 *
 * INTEGRATION:
 *   - Wired into db.ts via Prisma $use middleware
 *   - Exposes getDbPerformanceStats() for observability endpoints
 *   - Targets: p95 < 200ms for normal queries, p99 < 500ms for critical APIs
 */

import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QueryMetric {
  model: string;
  action: string;
  durationMs: number;
  timestamp: number;
  requestId?: string;
}

export interface DbPerformanceStats {
  totalQueries: number;
  queriesInWindow: number;
  windowDurationMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  slowQueryCount: number;
  slowQueryThresholdMs: number;
  topSlowQueries: Array<{
    model: string;
    action: string;
    avgDurationMs: number;
    count: number;
    maxDurationMs: number;
  }>;
  queriesPerSecond: number;
}

// ─── Configuration ───────────────────────────────────────────────────────

const SLOW_QUERY_THRESHOLD_MS = 200;
const METRIC_WINDOW_MS = 60_000; // 1-minute rolling window
const MAX_BUFFER_SIZE = 10_000;
const MAX_TOP_QUERIES = 10;

// ─── Metric Storage ────────────────────────────────────────────────────────

const metricsBuffer: QueryMetric[] = [];
let totalQueriesAllTime = 0;

// Per-request query counter (set by middleware)
let currentRequestId: string | undefined;
let currentRequestQueryCount = 0;

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Record a single query metric.
 * Called by the Prisma middleware in db.ts.
 */
export function recordDbQuery(
  model: string,
  action: string,
  durationMs: number,
): void {
  const metric: QueryMetric = {
    model,
    action,
    durationMs,
    timestamp: Date.now(),
    requestId: currentRequestId,
  };

  metricsBuffer.push(metric);
  totalQueriesAllTime++;

  // Trim old entries
  while (metricsBuffer.length > MAX_BUFFER_SIZE) {
    metricsBuffer.shift();
  }

  // Slow query alert
  if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(
      `[DB-PERF] Slow query: ${model}.${action} took ${durationMs.toFixed(1)}ms ` +
      `(threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)`,
    );
  }
}

/**
 * Start tracking queries for a request.
 * Call at the start of an API handler.
 */
export function startRequestQueryTracking(requestId: string): void {
  currentRequestId = requestId;
  currentRequestQueryCount = 0;
}

/**
 * End tracking and return query count for the request.
 */
export function endRequestQueryTracking(): number {
  const count = currentRequestQueryCount;
  currentRequestId = undefined;
  currentRequestQueryCount = 0;
  return count;
}

/**
 * Increment the per-request query counter.
 */
export function incrementRequestQueryCount(): void {
  currentRequestQueryCount++;
}

/**
 * Get the current request's query count (live).
 */
export function getCurrentRequestQueryCount(): number {
  return currentRequestQueryCount;
}

/**
 * Get comprehensive database performance statistics.
 * Computes p50/p95/p99 from the rolling metric window.
 */
export function getDbPerformanceStats(): DbPerformanceStats {
  // Filter to current window
  const now = Date.now();
  const windowStart = now - METRIC_WINDOW_MS;

  // Use binary search to find window start (metrics are sorted by timestamp)
  let windowStartIdx = 0;
  for (let i = metricsBuffer.length - 1; i >= 0; i--) {
    if (metricsBuffer[i].timestamp < windowStart) {
      windowStartIdx = i + 1;
      break;
    }
  }

  const windowMetrics = metricsBuffer.slice(windowStartIdx);
  const queriesInWindow = windowMetrics.length;

  if (queriesInWindow === 0) {
    return {
      totalQueries: totalQueriesAllTime,
      queriesInWindow: 0,
      windowDurationMs: METRIC_WINDOW_MS,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      slowQueryCount: 0,
      slowQueryThresholdMs: SLOW_QUERY_THRESHOLD_MS,
      topSlowQueries: [],
      queriesPerSecond: 0,
    };
  }

  // Extract and sort durations
  const durations = windowMetrics.map(m => m.durationMs).sort((a, b) => a - b);

  // Percentile calculation
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Slow query analysis
  const slowQueries = windowMetrics.filter(m => m.durationMs > SLOW_QUERY_THRESHOLD_MS);

  // Group slow queries by model.action for top-N
  const slowQueryGroups = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  for (const sq of slowQueries) {
    const key = `${sq.model}.${sq.action}`;
    const existing = slowQueryGroups.get(key);
    if (existing) {
      existing.count++;
      existing.totalMs += sq.durationMs;
      existing.maxMs = Math.max(existing.maxMs, sq.durationMs);
    } else {
      slowQueryGroups.set(key, {
        count: 1,
        totalMs: sq.durationMs,
        maxMs: sq.durationMs,
      });
    }
  }

  const topSlowQueries = [...slowQueryGroups.entries()]
    .map(([key, stats]) => ({
      model: key.split('.')[0],
      action: key.split('.')[1],
      avgDurationMs: Math.round(stats.totalMs / stats.count),
      count: stats.count,
      maxDurationMs: Math.round(stats.maxMs),
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, MAX_TOP_QUERIES);

  return {
    totalQueries: totalQueriesAllTime,
    queriesInWindow,
    windowDurationMs: METRIC_WINDOW_MS,
    avgLatencyMs: Math.round(avg),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    slowQueryCount: slowQueries.length,
    slowQueryThresholdMs: SLOW_QUERY_THRESHOLD_MS,
    topSlowQueries,
    queriesPerSecond: Math.round((queriesInWindow / METRIC_WINDOW_MS) * 1000),
  };
}

/**
 * Validate latency targets.
 * Returns warnings for any exceeded targets.
 */
export function validateLatencyTargets(): string[] {
  const stats = getDbPerformanceStats();
  const warnings: string[] = [];

  if (stats.queriesInWindow === 0) return warnings;

  if (stats.p95LatencyMs > 200) {
    warnings.push(
      `p95 latency ${stats.p95LatencyMs}ms exceeds 200ms target ` +
      `(current avg: ${stats.avgLatencyMs}ms, slow queries: ${stats.slowQueryCount})`,
    );
  }

  if (stats.p99LatencyMs > 500) {
    warnings.push(
      `p99 latency ${stats.p99LatencyMs}ms exceeds 500ms target ` +
      `(current avg: ${stats.avgLatencyMs}ms, slow queries: ${stats.slowQueryCount})`,
    );
  }

  return warnings;
}

/**
 * Reset all metrics (useful for testing or periodic reporting).
 */
export function resetDbPerformanceMetrics(): void {
  metricsBuffer.length = 0;
  totalQueriesAllTime = 0;
}
