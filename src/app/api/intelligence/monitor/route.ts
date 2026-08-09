/**
 * /api/intelligence/monitor — Autonomous Monitoring API
 *
 * POST — Run live monitoring checks (existing, unchanged)
 * GET  — Read persisted alerts from DB (WI-3)
 * PATCH — Alert lifecycle: acknowledge / resolve / dismiss (WI-3)
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMonitoringCheck, runMonitoringBatch } from '@/lib/intelligence-sources/autonomous-monitor';
import { getAlerts, getAlertSummary, acknowledgeAlert, resolveAlert, dismissAlert } from '@/lib/intelligence-sources/intelligence-alerts';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { checkApiAuth } from '@/lib/api-auth';

// ─── POST: Live Monitoring (existing, unchanged) ───────────────

const monitorBodySchema = z.object({
  companyId: companyIdSchema.optional(),
  companyIds: z.array(companyIdSchema).min(1).optional(),
}).refine(d => d.companyId || (d.companyIds && d.companyIds.length > 0), {
  message: 'Provide companyId or companyIds',
});

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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

// ─── GET: Read Persisted Alerts (WI-3) ───────────────────────

/**
 * GET /api/intelligence/monitor
 *
 * Query params:
 *   status     — Filter by status: active, acknowledged, resolved, dismissed (default: active)
 *   severity   — Filter by severity: critical, urgent, high, warning, medium, info, low
 *   companyId  — Filter by company ID
 *   alertType  — Filter by alert type (e.g. fresh_critical_signal, health_degraded)
 *   page       — Page number (default: 1)
 *   limit      — Items per page (default: 20, max: 100)
 *   includeSummary — Include alert summary (default: true)
 *
 * Reads persisted alerts from the IntelligenceAlert table via intelligence-alerts.ts.
 * Lightweight DB read — does NOT run detection engines.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get('status') || 'active',
      severity: searchParams.get('severity') || undefined,
      companyId: searchParams.get('companyId') || undefined,
      alertType: searchParams.get('alertType') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: Math.min(100, parseInt(searchParams.get('limit') || '20', 10)),
    };

    const includeSummary = searchParams.get('includeSummary') !== 'false';

    const { alerts, total } = await getAlerts(filters);

    const response: Record<string, unknown> = {
      alerts,
      total,
      page: filters.page,
      limit: filters.limit,
    };

    if (includeSummary) {
      const summary = await getAlertSummary();
      response.summary = summary;
    }

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[intelligence/monitor] GET failed:', { error: err });
    return NextResponse.json(
      { error: 'Failed to retrieve alerts', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 502 },
    );
  }
}

// ─── PATCH: Alert Lifecycle Management (WI-3) ───────────────

const patchBodySchema = z.object({
  alertId: z.string().min(1),
  action: z.enum(['acknowledge', 'resolve', 'dismiss']),
  notes: z.string().optional(),
});

/**
 * PATCH /api/intelligence/monitor
 *
 * Body: { alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss', notes?: string }
 *
 * Manages alert lifecycle through intelligence-alerts.ts functions.
 *   acknowledge → sets status to 'acknowledged', records acknowledgedBy + acknowledgedAt
 *   resolve     → sets status to 'resolved', records resolvedBy + resolvedAt + notes
 *   dismiss     → sets status to 'dismissed', records resolvedBy + resolvedAt
 */
export async function PATCH(request: NextRequest) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Validation failed: ${parsed.error.issues[0]?.message}` },
        { status: 400 },
      );
    }

    const { alertId, action, notes } = parsed.data;
    const userId = 'current-user'; // Placeholder until auth system is enforced

    let updatedAlert;
    switch (action) {
      case 'acknowledge':
        updatedAlert = await acknowledgeAlert(alertId, userId);
        break;
      case 'resolve':
        updatedAlert = await resolveAlert(alertId, userId, notes);
        break;
      case 'dismiss':
        updatedAlert = await dismissAlert(alertId, userId);
        break;
    }

    return NextResponse.json({ alert: updatedAlert });
  } catch (err) {
    logger.error('[intelligence/monitor] PATCH failed:', { error: err });
    return NextResponse.json(
      { error: 'Failed to update alert', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: err instanceof Error && err.message.includes('not found') ? 404 : 400 },
    );
  }
}
