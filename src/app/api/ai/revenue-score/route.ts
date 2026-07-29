import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
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
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { companyId, companyIds, scoreAll: scoreAllFlag, limit = 50 } = parsed.data;

    // Single company
    if (companyId) {
      const result = await scoreRevenueOpportunity(companyId);
      return NextResponse.json({ success: true, score: result });
    }

    // Multiple companies
    if (companyIds && companyIds.length > 0) {
      const results = await scoreRevenueOpportunities(companyIds);
      return NextResponse.json({
        success: true,
        scores: results,
        meta: { totalScored: results.length },
      });
    }

    // Score all
    if (scoreAllFlag) {
      const results = await scoreAllRevenueOpportunities(limit);
      return NextResponse.json({
        success: true,
        scores: results,
        meta: {
          totalScored: results.length,
          critical: results.filter(r => r.priorityTier === 'critical').length,
          high: results.filter(r => r.priorityTier === 'high').length,
          medium: results.filter(r => r.priorityTier === 'medium').length,
          low: results.filter(r => r.priorityTier === 'low').length,
          nurture: results.filter(r => r.priorityTier === 'nurture').length,
        },
      });
    }

    return NextResponse.json(
      { error: 'Provide companyId, companyIds, or scoreAll: true' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('[ai/revenue-score] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
