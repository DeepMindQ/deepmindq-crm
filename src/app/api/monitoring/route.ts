import { NextResponse } from 'next/server'
import { metrics, getActiveAlerts, getAlertRules, collectSystemMetrics, evaluateAlerts } from '@/lib/monitoring'

export async function GET() {
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
