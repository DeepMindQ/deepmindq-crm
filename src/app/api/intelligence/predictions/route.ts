/**
 * GET /api/intelligence/predictions — Generate predictions from signals
 *
 * Intelligence API — Analytical Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { db } from '@/lib/db';
import { generatePredictions } from '@/lib/intelligence-sources/predictive-intelligence';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

const predictionsQuerySchema = z.object({
  companyId: companyIdSchema,
});

export async function GET(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(request, 'predictions');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const queryResult = predictionsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!queryResult.success) {
      return utilityError(ctx, 400, `Validation failed: ${queryResult.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId } = queryResult.data;

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, signalType: true, title: true, description: true, createdAt: true, signalDate: true, confidence: true, severity: true },
    });

    const predictions = generatePredictions(signals);
    return utilitySuccess(ctx, { companyId, predictions, signalsAnalyzed: signals.length }, 'predictions', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Prediction analysis failed', Date.now() - startedAt);
  }
}
