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
import { resolveAllContradictions } from '@/lib/scoring-contradiction-resolver';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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
    const rawCompanyId = request.nextUrl.searchParams.get('companyId');
    const parsed = companyIdSchema.safeParse(rawCompanyId);
    if (!parsed.success) {
      return utilityError(ctx, 400, 'Invalid companyId format', 'INVALID_REQUEST', Date.now() - startedAt);
    }
    const companyId = parsed.data;

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, signalType: true, title: true, description: true, severity: true, createdAt: true, signalDate: true, confidence: true },
    });

    const correlations = detectCorrelations(signals);

    // Phase 3 Item 4.5: Run contradiction resolver when correlations detected
    // Correlations indicate multiple interacting signals — check for contradictions
    let contradictionResolution: Awaited<ReturnType<typeof resolveAllContradictions>> | null = null;
    if (correlations.length > 0 && signals.length >= 2) {
      try {
        contradictionResolution = await resolveAllContradictions(companyId);
        logger.info(`[correlations] Resolved contradictions for ${companyId}: ${contradictionResolution.resolutionRate * 100}% resolution rate`);
      } catch (err) {
        logger.warn(`[correlations] Contradiction resolution failed for ${companyId}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return utilitySuccess(ctx, { companyId, correlations, signalCount: signals.length, contradictionResolution }, 'correlations', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Correlation analysis failed', Date.now() - startedAt);
  }
}
