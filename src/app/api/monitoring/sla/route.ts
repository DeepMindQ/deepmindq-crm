/**
 * GET /api/monitoring/sla — SLA Compliance Dashboard
 *
 * Returns per-route SLA compliance report with P50/P95/P99 latency,
 * breach counts, and compliance status.
 */

import { NextRequest } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { getRouteSLAReport, getSLABreachRoutes, getSLAThreshold } from '@/lib/sla-monitor'
import type { SLAThreshold } from '@/lib/sla-monitor'

export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  const report = getRouteSLAReport()
  const breachRoutes = getSLABreachRoutes(5, 3600000)
  const slaDefinitions: SLAThreshold[] = [
    { category: 'intelligence', pattern: /^\/api\/(intelligence|ai|knowledge)/, p99Ms: 3000, warningMs: 2400 },
    { category: 'search', pattern: /^\/api\/(search|knowledge\/search)/, p99Ms: 200, warningMs: 160 },
    { category: 'dashboard', pattern: /^\/api\/(dashboard|stats|analytics)/, p99Ms: 1000, warningMs: 800 },
    { category: 'ai_generation', pattern: /^\/api\/ai\/(enrich|score|buying|account-brief|chat)/, p99Ms: 10000, warningMs: 8000 },
    { category: 'crud', pattern: /^\/api\//, p99Ms: 500, warningMs: 400 },
  ]

  // Serialize RegExp to string for JSON output
  const definitions = slaDefinitions.map(d => ({
    category: d.category,
    pattern: d.pattern.source,
    p99Ms: d.p99Ms,
    warningMs: d.warningMs,
  }))

  const totalRoutes = report.length
  const compliantRoutes = report.filter(r => r.currentP99Compliant).length
  const totalBreaches = report.reduce((sum, r) => sum + r.breachCount, 0)

  return Response.json({
    summary: {
      totalRoutes,
      compliantRoutes,
      nonCompliantRoutes: totalRoutes - compliantRoutes,
      totalBreaches,
      alertRoutes: breachRoutes.length,
      overallCompliant: totalRoutes === 0 || compliantRoutes === totalRoutes,
    },
    definitions,
    routes: report,
    alerts: breachRoutes.map(r => ({
      route: r.route,
      category: r.category,
      breachCount: r.breachCount,
      currentP99Ms: r.p99Ms,
      slaThresholdMs: r.slaThreshold,
    })),
    timestamp: new Date().toISOString(),
  })
}
