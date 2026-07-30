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

export async function GET(request: NextRequest) {
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
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/cross-account] Error', { error: message });
    return Response.json(
      { success: false, error: 'Cross-account analysis failed', details: message, meta: { endpoint: 'cross-account', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
