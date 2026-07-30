/**
 * GET /api/intelligence/cross-account — Detect cross-account patterns
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { detectCrossAccountPatterns } from '@/lib/intelligence-sources/cross-account-intelligence';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function GET(request: NextRequest) {
  let correlationId;
  let responseHeaders;
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

  const startedAt = Date.now();

  try {
    const idsParam = request.nextUrl.searchParams.get('companyIds');
    if (!idsParam) {
      return Response.json(
        { success: false, error: 'companyIds required (comma-separated)' },
        { status: 400 },
      );
    }

    const companyIds = idsParam.split(',').filter(Boolean);
    if (companyIds.length < 2) {
      return Response.json(
        { success: false, error: 'At least 2 companyIds required' },
        { status: 400 },
      );
    }

    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, rawName: true, industry: true },
    });

    const allSignals = await db.companySignal.findMany({
      where: { companyId: { in: companyIds }, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 200,
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
    return Response.json({
      success: true,
      data: { companyCount: companies.length, signalCount: allSignals.length, patterns },
      meta: { endpoint: 'cross-account', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/cross-account] Error', { error: message });
    return Response.json(
      { success: false, error: 'Cross-account analysis failed', details: message, meta: { endpoint: 'cross-account', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
