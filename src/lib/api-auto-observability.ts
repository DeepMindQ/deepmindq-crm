/**
 * API Auto-Observability Bridge
 *
 * Bridges api-observability.ts in-memory buffer with monitoring.ts metrics collector.
 * Runs periodically to flush API metrics into the main monitoring system.
 * This eliminates the need to wrap individual route handlers with withApiObservability.
 */
import { metrics } from '@/lib/monitoring';
import { getApiMetrics } from '@/lib/api-observability';
import { registerTimer } from '@/lib/timer-registry';

/**
 * Starts a periodic bridge that flushes API observability buffer metrics
 * into the main monitoring MetricsCollector.
 *
 * @param intervalMs - Flush interval in milliseconds (default 30s)
 * @returns Cleanup function (also registered with timer-registry for shutdown)
 */
export function startApiMetricsBridge(intervalMs = 30000): () => void {
  const timer = setInterval(() => {
    try {
      const apiMetrics = getApiMetrics();

      // Flush to monitoring metrics collector
      metrics.record('api.request.total', apiMetrics.totalRequests);
      metrics.record('api.error.rate', apiMetrics.errorRate);
      metrics.record('api.latency.p50', apiMetrics.p50LatencyMs, {}, 'ms');
      metrics.record('api.latency.p95', apiMetrics.p95LatencyMs, {}, 'ms');
      metrics.record('api.latency.avg', apiMetrics.avgLatencyMs, {}, 'ms');
    } catch {
      // Non-blocking — never let the bridge break the app
    }
  }, intervalMs);

  // Don't prevent process exit
  if (timer.unref) timer.unref();

  // Register with timer-registry so clearAllTimers() cleans up on SIGTERM/SIGINT
  registerTimer(timer);

  return () => clearInterval(timer);
}
