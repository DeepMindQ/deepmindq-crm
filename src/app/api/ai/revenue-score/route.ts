import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  utilityError,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';
import {
  scoreRevenueOpportunity,
  scoreRevenueOpportunities,
  scoreAllRevenueOpportunities,
} from '@/lib/scoring/revenue-opportunity-engine';

// ── Validation ──

const schema = z.object({
  companyId: z.string().min(1).optional(),
  companyIds: z.array(z.string().min(1)).optional(),
  scoreAll: z.boolean().optional(),
  limit: z.number().min(1).max(200).optional(),
});

// ── POST /api/ai/revenue-score ──

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  // ── Guard: rate limiting + correlation-id + response headers ──
  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'revenue-score');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return utilityError(ctx, 400, msg, 'VALIDATION_FAILED', Date.now() - startedAt);
    }

    const { companyId, companyIds, scoreAll: scoreAllFlag, limit = 50 } = parsed.data;

    // Single company
    if (companyId) {
      const result = await scoreRevenueOpportunity(companyId);
      return utilitySuccess(ctx, { score: result }, 'revenue-score', Date.now() - startedAt);
    }

    // Multiple companies
    if (companyIds && companyIds.length > 0) {
      const results = await scoreRevenueOpportunities(companyIds);
      return utilitySuccess(ctx, { scores: results, meta: { totalScored: results.length } }, 'revenue-score', Date.now() - startedAt);
    }

    // Score all
    if (scoreAllFlag) {
      const results = await scoreAllRevenueOpportunities(limit);
      return utilitySuccess(ctx, {
        scores: results,
        meta: {
          totalScored: results.length,
          critical: results.filter(r => r.priorityTier === 'critical').length,
          high: results.filter(r => r.priorityTier === 'high').length,
          medium: results.filter(r => r.priorityTier === 'medium').length,
          low: results.filter(r => r.priorityTier === 'low').length,
          nurture: results.filter(r => r.priorityTier === 'nurture').length,
        },
      }, 'revenue-score', Date.now() - startedAt);
    }

    return utilityError(ctx, 400, 'Provide companyId, companyIds, or scoreAll: true', 'INVALID_REQUEST', Date.now() - startedAt);
  } catch (error) {
    return utilityCatchError(
      ctx,
      error,
      500,
      'ENGINE_ERROR',
      'Revenue scoring failed',
      Date.now() - startedAt,
    );
  }
}
