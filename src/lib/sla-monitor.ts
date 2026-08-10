/**
 * P5.3 — Response Time SLA Monitor
 *
 * Tracks per-route response times and alerts when SLA thresholds are breached.
 * Lightweight, Map-based, in-memory only (no DB writes).
 * Edge Runtime compatible (no Node.js APIs).
 *
 * SLA Categories:
 *   - Intelligence queries: < 3s (P99)
 *   - CRUD operations: < 500ms (P99)
 *   - Search: < 200ms (P99)
 *   - Dashboard: < 1s (P99)
 *   - AI generation: < 10s (P99)
 */

import { logger } from '@/lib/logger'

// ── SLA Definitions ──

export interface SLAThreshold {
  category: string
  pattern: RegExp
  p99Ms: number
  warningMs: number
}

const SLA_DEFINITIONS: SLAThreshold[] = [
  { category: 'intelligence', pattern: /^\/api\/(intelligence|ai|knowledge)/, p99Ms: 3000, warningMs: 2400 },
  { category: 'search',       pattern: /^\/api\/(search|knowledge\/search)/, p99Ms: 200, warningMs: 160 },
  { category: 'dashboard',    pattern: /^\/api\/(dashboard|stats|analytics)/, p99Ms: 1000, warningMs: 800 },
  { category: 'ai_generation', pattern: /^\/api\/ai\/(enrich|score|buying|account-brief|chat)/, p99Ms: 10000, warningMs: 8000 },
  { category: 'crud',         pattern: /^\/api\//, p99Ms: 500, warningMs: 400 },  // Default for all API routes
]

// ── Per-Route Stats ──

export interface RouteLatencyStats {
  count: number
  totalMs: number
  maxMs: number
  samples: number[]       // Last 100 samples for p99 calculation
  slaBreaches: number     // Number of times p99 was exceeded
  lastBreachAt: number | null // Timestamp
}

const MAX_SAMPLES = 100
const routeStats: Map<string, RouteLatencyStats> = new Map()

// ── Core Functions ──

/** Find the most specific matching SLA threshold for a given path. */
export function getSLAThreshold(path: string): SLAThreshold {
  for (const sla of SLA_DEFINITIONS) {
    if (sla.pattern.test(path)) return sla
  }
  return SLA_DEFINITIONS[SLA_DEFINITIONS.length - 1] // Default CRUD
}

/**
 * Normalize a route path by replacing dynamic segments with :id placeholders.
 * E.g. /api/companies/abc → /api/companies/:id
 */
function normalizeRoute(path: string): string {
  return path.replace(/\/\d+[^/]*$/g, '/:id')
}

/**
 * Record a route latency sample.  Normalizes the path, updates rolling stats,
 * and logs a warning on SLA breach.
 */
export function recordRouteLatency(path: string, durationMs: number): void {
  const key = normalizeRoute(path)
  let stats = routeStats.get(key)
  if (!stats) {
    stats = { count: 0, totalMs: 0, maxMs: 0, samples: [], slaBreaches: 0, lastBreachAt: null }
    routeStats.set(key, stats)
  }

  stats.count++
  stats.totalMs += durationMs
  stats.maxMs = Math.max(stats.maxMs, durationMs)

  // Rolling window of last 100 samples
  stats.samples.push(durationMs)
  if (stats.samples.length > MAX_SAMPLES) stats.samples.shift()

  // Check SLA breach
  const sla = getSLAThreshold(path)
  if (durationMs > sla.p99Ms) {
    stats.slaBreaches++
    stats.lastBreachAt = Date.now()
    logger.warn(`[sla] Route ${key} exceeded SLA: ${durationMs}ms > ${sla.p99Ms}ms (${sla.category})`)
  }
}

// ── Report Generation ──

export interface SLARouteReport {
  route: string
  category: string
  p50Ms: number
  p95Ms: number
  p99Ms: number
  avgMs: number
  maxMs: number
  slaThreshold: number
  currentP99Compliant: boolean
  breachCount: number
  sampleCount: number
}

/**
 * Returns a sorted SLA compliance report for all routes that have samples.
 * Sorted by breach count descending (worst offenders first).
 */
export function getRouteSLAReport(): SLARouteReport[] {
  const report: SLARouteReport[] = []
  for (const [route, stats] of routeStats.entries()) {
    if (stats.samples.length === 0) continue

    const sorted = [...stats.samples].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    const avg = stats.totalMs / stats.count
    const sla = getSLAThreshold(route)

    report.push({
      route,
      category: sla.category,
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
      p99Ms: Math.round(p99),
      avgMs: Math.round(avg),
      maxMs: stats.maxMs,
      slaThreshold: sla.p99Ms,
      currentP99Compliant: p99 <= sla.p99Ms,
      breachCount: stats.slaBreaches,
      sampleCount: stats.samples.length,
    })
  }

  return report.sort((a, b) => b.breachCount - a.breachCount)
}

/**
 * Returns routes that have breached SLA > 5 times in the last hour.
 * Used by monitoring.ts for alert evaluation.
 */
export function getSLABreachRoutes(breachThreshold = 5, windowMs = 3600000): SLARouteReport[] {
  const report = getRouteSLAReport()
  const cutoff = Date.now() - windowMs
  return report.filter(r => {
    const stats = routeStats.get(r.route)
    if (!stats) return false
    return (
      stats.slaBreaches >= breachThreshold &&
      stats.lastBreachAt !== null &&
      stats.lastBreachAt >= cutoff
    )
  })
}

/** Reset all in-memory SLA stats (useful for testing). */
export function resetSLAStats(): void {
  routeStats.clear()
}

/** Get the raw stats map (for Prometheus metric export). */
export function getRawRouteStats(): ReadonlyMap<string, RouteLatencyStats> {
  return routeStats
}
