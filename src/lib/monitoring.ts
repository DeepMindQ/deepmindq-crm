/**
 * DeepMindQ — Monitoring & Alerting System
 *
 * Structured logging, metrics collection, and alert routing.
 * Designed for production deployment with minimal overhead.
 */

import { performance } from 'perf_hooks'

// ── Metric Types ──
interface MetricPoint {
  name: string
  value: number
  timestamp: number
  tags: Record<string, string>
  unit: string
}

interface AlertRule {
  id: string
  name: string
  metric: string
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  threshold: number
  windowMs: number
  severity: 'info' | 'warning' | 'critical'
  cooldownMs: number
  enabled: boolean
  lastTriggered?: number
  notificationChannels: ('log' | 'email' | 'slack')[]
}

interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: 'info' | 'warning' | 'critical'
  metric: string
  value: number
  threshold: number
  message: string
  timestamp: string
}

// ── Metrics Collector ──
class MetricsCollector {
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
    const result: Record<string, any> = {}
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

export const metrics = new MetricsCollector()

// ── Timer Helper ──
export function timer(label: string, tags: Record<string, string> = {}): () => void {
  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    metrics.record(`${label}.duration`, duration, tags, 'ms')
    metrics.record(`${label}.count`, 1, tags)
  }
}

// ── Alert Rules ──
const ALERT_RULES: AlertRule[] = [
  { id: 'high-response-time', name: 'High Response Time', metric: 'api.request.duration', condition: 'gt', threshold: 5000, windowMs: 60000, severity: 'warning', cooldownMs: 300000, enabled: true, notificationChannels: ['log', 'slack'] },
  { id: 'error-rate', name: 'High Error Rate', metric: 'api.error.count', condition: 'gt', threshold: 10, windowMs: 60000, severity: 'critical', cooldownMs: 120000, enabled: true, notificationChannels: ['log', 'email', 'slack'] },
  { id: 'db-query-time', name: 'Slow Database Query', metric: 'db.query.duration', condition: 'gt', threshold: 2000, windowMs: 60000, severity: 'warning', cooldownMs: 300000, enabled: true, notificationChannels: ['log'] },
  { id: 'memory-usage', name: 'High Memory Usage', metric: 'system.memory.percent', condition: 'gt', threshold: 85, windowMs: 30000, severity: 'critical', cooldownMs: 60000, enabled: true, notificationChannels: ['log', 'email', 'slack'] },
  { id: 'ai-latency', name: 'High AI Latency', metric: 'ai.request.duration', condition: 'gt', threshold: 10000, windowMs: 60000, severity: 'warning', cooldownMs: 300000, enabled: true, notificationChannels: ['log'] },
]

// ── Alert Manager ──
const activeAlerts: Alert[] = []

export function evaluateAlerts(): Alert[] {
  const triggered: Alert[] = []
  for (const rule of ALERT_RULES) {
    if (!rule.enabled) continue
    if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) continue

    const agg = metrics.getAggregates()[rule.metric]
    if (!agg) continue

    const value = agg.last
    let isTriggered = false
    switch (rule.condition) {
      case 'gt': isTriggered = value > rule.threshold; break
      case 'lt': isTriggered = value < rule.threshold; break
      case 'gte': isTriggered = value >= rule.threshold; break
      case 'lte': isTriggered = value <= rule.threshold; break
      case 'eq': isTriggered = value === rule.threshold; break
    }

    if (isTriggered) {
      rule.lastTriggered = Date.now()
      const alert: Alert = {
        id: `alert_${Date.now()}_${rule.id}`,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
        message: `${rule.name}: ${rule.metric} = ${value} (${rule.condition} ${rule.threshold})`,
        timestamp: new Date().toISOString(),
      }
      activeAlerts.push(alert)
      triggered.push(alert)

      // Log alert
      console.log(`[ALERT] [${rule.severity.toUpperCase()}] ${alert.message}`)
    }
  }
  return triggered
}

export function getActiveAlerts(): Alert[] {
  return activeAlerts.filter(a => Date.now() - new Date(a.timestamp).getTime() < 3600000)
}

export function getAlertRules(): AlertRule[] {
  return ALERT_RULES
}

// ── System Metrics Collector ──
export function collectSystemMetrics(): void {
  const mem = process.memoryUsage()
  metrics.record('system.memory.rss', mem.rss / 1024 / 1024, {}, 'MB')
  metrics.record('system.memory.heap', mem.heapUsed / 1024 / 1024, {}, 'MB')
  metrics.record('system.memory.percent', Math.round((mem.heapUsed / mem.heapTotal) * 100), {}, '%')
  metrics.record('system.uptime', process.uptime(), {}, 'seconds')

  // CPU usage estimation via event loop lag
  const start = Date.now()
  setImmediate(() => {
    const lag = Date.now() - start
    metrics.record('system.event_loop_lag', lag, {}, 'ms')
  })
}
