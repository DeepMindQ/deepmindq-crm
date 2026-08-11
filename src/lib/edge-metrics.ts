/**
 * DeepMindQ — Edge-Safe Metrics Collector
 *
 * Lightweight metrics for Edge Runtime (middleware.ts).
 * No Node.js APIs, no Prisma, no database — pure in-memory collection.
 *
 * The full monitoring.ts module imports db, perf_hooks, Sentry, etc.,
 * which are incompatible with Edge Runtime. This module provides the
 * same MetricsCollector interface for edge contexts.
 */

// ── Metric Types ──
interface MetricPoint {
  name: string
  value: number
  timestamp: number
  tags: Record<string, string>
  unit: string
}

// ── Edge-Safe Metrics Collector ──
class EdgeMetricsCollector {
  private metrics: MetricPoint[] = []
  private readonly maxPoints = 10000
  private aggregates = new Map<string, { sum: number; count: number; min: number; max: number; last: number }>()

  record(name: string, value: number, tags: Record<string, string> = {}, unit = ''): void {
    const point: MetricPoint = { name, value, timestamp: Date.now(), tags, unit }
    this.metrics.push(point)
    if (this.metrics.length > this.maxPoints) this.metrics.shift()

    // Update aggregates
    const agg = this.aggregates.get(name) || { sum: 0, count: 0, min: Infinity, max: -Infinity, last: 0 }
    agg.sum += value
    agg.count++
    agg.min = Math.min(agg.min, value)
    agg.max = Math.max(agg.max, value)
    agg.last = value
    this.aggregates.set(name, agg)
  }

  getAggregates(): Record<string, { avg: number; min: number; max: number; count: number; sum: number; last: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number; sum: number; last: number }> = {}
    for (const [name, agg] of this.aggregates) {
      result[name] = { avg: agg.sum / agg.count, min: agg.min, max: agg.max, count: agg.count, sum: agg.sum, last: agg.last }
    }
    return result
  }

  getRecent(name: string, durationMs = 60000): MetricPoint[] {
    const cutoff = Date.now() - durationMs
    return this.metrics.filter(m => m.name === name && m.timestamp >= cutoff)
  }

  clear(): void {
    this.metrics = []
    this.aggregates.clear()
  }
}

/**
 * Edge-safe metrics instance.
 * Drop-in replacement for the full monitoring.ts metrics export.
 * Safe for use in Edge Runtime (middleware.ts).
 */
export const metrics = new EdgeMetricsCollector()
