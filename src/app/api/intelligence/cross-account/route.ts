/**
 * GET /api/intelligence/cross-account — Detect cross-account patterns
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { detectCrossAccountPatterns } from '@/lib/intelligence-sources/cross-account-intelligence';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { checkApiAuth } from '@/lib/api-auth';

const companyIdsParamSchema = z.string().min(1).refine(
  (val) => val.split(',').filter(Boolean).length >= 2,
  'At least 2 companyIds required'
);

export async function GET(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const ctx = utilityGuard(request, 'cross-account');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const ctx = { correlationId, responseHeaders };
  const startedAt = Date.now();

  try {
    const idsParam = request.nextUrl.searchParams.get('companyIds');
    const parsed = companyIdsParamSchema.safeParse(idsParam);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    const companyIds = idsParam!.split(',').filter(Boolean);

    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, rawName: true, industry: true },
    });

    const allSignals = await db.companySignal.findMany({
      where: { companyId: { in: companyIds }, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 200,
      select: { companyId: true, signalType: true, title: true, createdAt: true, confidence: true },
    });

    const companyMap = new Map(companies.map(c => [c.id, c]));
    const accountSignals = allSignals.map(s => ({
      companyId: s.companyId,
      companyName: companyMap.get(s.companyId)?.rawName || 'Unknown',
      industry: companyMap.get(s.companyId)?.industry || null,
      signalType: s.signalType,
      title: s.title,
      createdAt: s.createdAt,
      confidence: s.confidence,
    }));

    const patterns = detectCrossAccountPatterns(accountSignals);
    const data = { companyCount: companies.length, signalCount: allSignals.length, patterns };
    return utilitySuccess(ctx, data, 'cross-account', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Cross-account analysis failed', Date.now() - startedAt);
  }
}
