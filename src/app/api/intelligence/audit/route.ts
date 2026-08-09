/**
 * GET /api/intelligence/audit
 *
 * M5 Phase 6 — Intelligence Audit Trail Endpoint
 *
 * Query the M5 audit trail (stored in Evidence model).
 *
 * Query params:
 *   action    — Filter by action type (e.g., 'enrichment', 'brief_generated')
 *   companyId — Filter by company
 *   since     — ISO date string, only events after this timestamp
 *   limit     — Max events to return (default: 50, max: 200)
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { requireAdminRole } from '@/lib/api-auth';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { queryAuditTrail } from '@/lib/audit-trail-service';

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // ── Admin-only: audit trail requires admin role ──
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'audit');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }
  const startedAt = Date.now();

  try {
    const sp = request.nextUrl.searchParams;

    const action = sp.get('action') || undefined;
    const companyId = sp.get('companyId') || undefined;
    const sinceStr = sp.get('since');
    const since = sinceStr ? new Date(sinceStr) : undefined;

    // Validate `since` date
    if (sinceStr && (isNaN(since!.getTime()) || since!.getFullYear() < 2020 || since!.getFullYear() > 2100)) {
      return utilityError(ctx, 400, 'Invalid "since" parameter. Use ISO 8601 date string.', 'INVALID_REQUEST', Date.now() - startedAt);
    }

    let limit = parseInt(sp.get('limit') || '50', 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;

    const events = await queryAuditTrail({
      action,
      companyId,
      since,
      limit,
    });

    return utilitySuccess(ctx, { events }, 'audit', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Audit trail query failed', Date.now() - startedAt);
  }
}
