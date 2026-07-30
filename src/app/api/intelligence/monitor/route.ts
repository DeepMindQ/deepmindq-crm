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
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';

const monitorBodySchema = z.object({
  companyId: companyIdSchema.optional(),
  companyIds: z.array(companyIdSchema).min(1).optional(),
}).refine(d => d.companyId || (d.companyIds && d.companyIds.length > 0), {
  message: 'Provide companyId or companyIds',
});

export async function POST(request: NextRequest) {
  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'monitor');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json();
    const parsed = monitorBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId, companyIds } = parsed.data;

    if (companyId) {
      logger.info('[intelligence/monitor] Single check', { companyId });
      const alerts = await runMonitoringCheck(companyId);
      return utilitySuccess(ctx, { companyId, alerts, alertCount: alerts.length }, 'monitor', Date.now() - startedAt);
    }

    if (companyIds && Array.isArray(companyIds)) {
      logger.info('[intelligence/monitor] Batch check', { count: companyIds.length });
      const results = await runMonitoringBatch(companyIds);
      const allAlerts = Array.from(results.values()).flat();
      return utilitySuccess(ctx, {
        companies: Object.fromEntries(results),
        totalAlerts: allAlerts.length,
        alertSummary: {
          critical: allAlerts.filter(a => a.severity === 'critical').length,
          urgent: allAlerts.filter(a => a.severity === 'urgent').length,
          warning: allAlerts.filter(a => a.severity === 'warning').length,
          info: allAlerts.filter(a => a.severity === 'info').length,
        },
      }, 'monitor', Date.now() - startedAt);
    }

    // Zod refine guarantees companyId or companyIds is present, but handle edge case
    return utilityError(ctx, 400, 'Provide companyId or companyIds', 'VALIDATION_FAILED', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Monitoring check failed', Date.now() - startedAt);
  }
}
