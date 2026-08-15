/**
 * Monitoring — Process Metrics Collector
 *
 * Collects real Node.js process metrics for Prometheus export.
 * Used by /api/health/metrics endpoint.
 */

import { PrismaDiagnostics } from '@/lib/db';

interface MetricAggregate {
  last?: number;
  sum?: number;
  count?: number;
}

interface MetricEntry {
  value: number;
  timestamp: number;
}

// In-memory metric storage
const metricsStore = new Map<string, MetricEntry[]>();

const MAX_METRICS_PER_KEY = 100;

function recordMetric(key: string, value: number): void {
  const entries = metricsStore.get(key) || [];
  entries.push({ value, timestamp: Date.now() });
  if (entries.length > MAX_METRICS_PER_KEY) {
    entries.splice(0, entries.length - MAX_METRICS_PER_KEY);
  }
  metricsStore.set(key, entries);
}

export const metrics = {
  getAggregates(): Record<string, MetricAggregate> {
    const result: Record<string, MetricAggregate> = {};

    // Memory usage (RSS in MB)
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      result['process_memory_rss_mb'] = {
        last: Math.round(mem.rss / 1024 / 1024),
      };
      result['process_memory_heap_used_mb'] = {
        last: Math.round(mem.heapUsed / 1024 / 1024),
      };
      result['process_memory_heap_total_mb'] = {
        last: Math.round(mem.heapTotal / 1024 / 1024),
      };
    }

    // Database query counts
    const dbDiag = PrismaDiagnostics.snapshot();
    result['db_total_queries'] = { last: dbDiag.totalQueries };
    result['db_slow_queries'] = { last: dbDiag.slowQueries };

    // Event loop lag (approximate)
    if (typeof process !== 'undefined') {
      const start = Date.now();
      // Use setImmediate to measure event loop lag
      setImmediate(() => {
        recordMetric('event_loop_lag_ms', Date.now() - start);
      });
    }

    // Custom recorded metrics
    for (const [key, entries] of metricsStore.entries()) {
      if (entries.length > 0) {
        const last = entries[entries.length - 1].value;
        const sum = entries.reduce((acc, e) => acc + e.value, 0);
        result[key] = { last, sum, count: entries.length };
      }
    }

    return result;
  },

  record(key: string, value: number): void {
    recordMetric(key, value);
  },
};

export function collectSystemMetrics(): void {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    recordMetric('memory_rss_mb', Math.round(mem.rss / 1024 / 1024));
    recordMetric('memory_heap_used_mb', Math.round(mem.heapUsed / 1024 / 1024));
    recordMetric('memory_heap_total_mb', Math.round(mem.heapTotal / 1024 / 1024));
  }

  // Uptime
  if (typeof process !== 'undefined' && process.uptime) {
    recordMetric('process_uptime_seconds', Math.round(process.uptime()));
  }
}
