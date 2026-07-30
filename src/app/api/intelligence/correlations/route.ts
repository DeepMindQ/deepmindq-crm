/**
 * GET /api/intelligence/correlations — Detect signal correlations for a company
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { detectCorrelations } from '@/lib/intelligence-sources/cross-signal-correlation';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(request, 'correlations');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return utilityError(ctx, 400, 'companyId is required', 'INVALID_REQUEST', Date.now() - startedAt);
    }

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, signalType: true, title: true, description: true, severity: true, createdAt: true, signalDate: true, confidence: true },
    });

    const correlations = detectCorrelations(signals);
    return utilitySuccess(ctx, { companyId, correlations, signalCount: signals.length }, 'correlations', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Correlation analysis failed', Date.now() - startedAt);
  }
}
