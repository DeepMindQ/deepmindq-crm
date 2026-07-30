/**
 * POST /api/intelligence/monitor — Run autonomous monitoring checks
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Checks for alerts on one or many companies. Returns alert summaries
 * grouped by severity level.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { runMonitoringCheck, runMonitoringBatch } from '@/lib/intelligence-sources/autonomous-monitor';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'monitor');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const { companyId, companyIds } = body;

    if (companyId) {
      logger.info('[intelligence/monitor] Single check', { companyId });
      const alerts = await runMonitoringCheck(companyId);
      return Response.json({
        success: true,
        data: { companyId, alerts, alertCount: alerts.length },
        meta: { endpoint: 'monitor', durationMs: Date.now() - startedAt },
      });
    }

    if (companyIds && Array.isArray(companyIds)) {
      logger.info('[intelligence/monitor] Batch check', { count: companyIds.length });
      const results = await runMonitoringBatch(companyIds);
      const allAlerts = Array.from(results.values()).flat();
      return Response.json({
        success: true,
        data: {
          companies: Object.fromEntries(results),
          totalAlerts: allAlerts.length,
          alertSummary: {
            critical: allAlerts.filter(a => a.severity === 'critical').length,
            urgent: allAlerts.filter(a => a.severity === 'urgent').length,
            warning: allAlerts.filter(a => a.severity === 'warning').length,
            info: allAlerts.filter(a => a.severity === 'info').length,
          },
        },
        meta: { endpoint: 'monitor', durationMs: Date.now() - startedAt },
      });
    }

    return Response.json(
      { success: false, error: 'Provide companyId or companyIds', meta: { endpoint: 'monitor', durationMs: Date.now() - startedAt } },
      { status: 400 },
    );
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/monitor] Error', { error: message });
    return Response.json(
      { success: false, error: 'Monitoring check failed', details: message, meta: { endpoint: 'monitor', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
