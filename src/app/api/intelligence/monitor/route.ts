import { NextResponse } from 'next/server';
import { runMonitoringCheck, runMonitoringBatch } from '@/lib/intelligence-sources/autonomous-monitor';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, companyIds } = body;

    if (companyId) {
      const alerts = await runMonitoringCheck(companyId);
      return NextResponse.json({ companyId, alerts, alertCount: alerts.length });
    }

    if (companyIds && Array.isArray(companyIds)) {
      const results = await runMonitoringBatch(companyIds);
      const allAlerts = Array.from(results.values()).flat();
      return NextResponse.json({
        companies: Object.fromEntries(results),
        totalAlerts: allAlerts.length,
        alertSummary: {
          critical: allAlerts.filter(a => a.severity === 'critical').length,
          urgent: allAlerts.filter(a => a.severity === 'urgent').length,
          warning: allAlerts.filter(a => a.severity === 'warning').length,
          info: allAlerts.filter(a => a.severity === 'info').length,
        },
      });
    }

    return NextResponse.json({ error: 'Provide companyId or companyIds' }, { status: 400 });
  } catch (error) {
    logger.error('[monitor] Error:', { error: error });
    return NextResponse.json({ error: 'Monitoring check failed' }, { status: 500 });
  }
}
