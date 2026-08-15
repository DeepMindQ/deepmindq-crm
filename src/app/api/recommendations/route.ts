import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

// ── Status Mapping ──────────────────────────────────────
// Recommendation-facing statuses → Insight DB statuses
const REC_TO_DB: Record<string, string> = {
  pending: 'active',
  accepted: 'acted_upon',
  dismissed: 'dismissed',
  expired: 'expired',
};

const DB_TO_REC: Record<string, string> = {
  active: 'pending',
  acted_upon: 'accepted',
  dismissed: 'dismissed',
  expired: 'expired',
};

// ── Query Schema ─────────────────────────────────────────
const recommendationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'dismissed', 'expired']).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /api/recommendations
 *
 * Fetch recommendation insights with optional filters.
 * Returns recommendations list and aggregate stats.
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = recommendationsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { status, type, limit } = parsed.data;

    // Build where clause — always filter to recommendation insights
    const where: Record<string, unknown> = {
      category: 'recommendation',
    };
    if (status) {
      where.status = REC_TO_DB[status];
    }
    if (type) {
      where.reasoningMethod = type;
    }

    const [recommendations, totalCount, acceptedCount, dismissedCount, pendingCount] =
      await Promise.all([
        db.insight.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: {
            organization: { select: { name: true, domain: true, industry: true } },
            signal: { select: { id: true, title: true, signalType: true } },
          },
        }),
        db.insight.count({ where: { category: 'recommendation' } }),
        db.insight.count({ where: { category: 'recommendation', status: 'acted_upon' } }),
        db.insight.count({ where: { category: 'recommendation', status: 'dismissed' } }),
        db.insight.count({ where: { category: 'recommendation', status: 'active' } }),
      ]);

    const mappedRecommendations = recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      narrative: r.narrative,
      recommendation: r.recommendation,
      suggestedMessage: r.suggestedMessage,
      confidence: r.confidence,
      confidenceScore: r.confidenceScore,
      status: DB_TO_REC[r.status] || r.status,
      evidenceIds: r.evidenceIds,
      signalIds: r.signalIds,
      reasoningMethod: r.reasoningMethod,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      organization: r.organization,
      signal: r.signal,
    }));

    return NextResponse.json({
      data: {
        recommendations: mappedRecommendations,
        stats: {
          total: totalCount,
          accepted: acceptedCount,
          dismissed: dismissedCount,
          pending: pendingCount,
        },
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
