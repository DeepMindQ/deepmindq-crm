/**
 * GET /api/intelligence/predictions — Generate predictions from signals
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { generatePredictions } from '@/lib/intelligence-sources/predictive-intelligence';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return Response.json(
        { success: false, error: 'companyId is required' },
        { status: 400 },
      );
    }

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });

    const predictions = generatePredictions(signals);
    return Response.json({
      success: true,
      data: { companyId, predictions, signalsAnalyzed: signals.length },
      meta: { endpoint: 'predictions', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/predictions] Error', { error: message });
    return Response.json(
      { success: false, error: 'Prediction analysis failed', details: message, meta: { endpoint: 'predictions', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
