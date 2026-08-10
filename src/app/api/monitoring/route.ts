import { NextRequest, NextResponse } from 'next/server'
import { checkApiAuth } from '@/lib/api-auth'
import { metrics, getActiveAlerts, getAlertRules, collectSystemMetrics, evaluateAlerts } from '@/lib/monitoring'

export async function GET(request: NextRequest) {
  // P0.2: Defense-in-depth auth check.
  // Middleware already blocks unauthenticated access (monitoring removed from PUBLIC_PATH_PREFIXES).
  // This is the second layer — if middleware is bypassed or disabled, this still protects the endpoint.
  const { errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  collectSystemMetrics()
  evaluateAlerts()

  return NextResponse.json({
    metrics: metrics.getAggregates(),
    alerts: {
      active: getActiveAlerts(),
      rules: getAlertRules(),
    },
    system: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
    },
    timestamp: new Date().toISOString(),
  })
}
