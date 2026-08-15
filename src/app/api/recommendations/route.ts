import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';

/**
 * GET /api/recommendations
 * Lists actionable recommendations from insights.
 * Queries Insights where status='active' and recommendation is not null.
 *
 * Q6 FIX: Replaces non-existent /api/recommendations endpoint
 * that api-client.ts references.
 *
 * Query params:
 *   ?limit=20           — Max results
 *   ?status=active      — Filter by status
 *   ?sortBy=confidence   — Sort by confidence|recent
 *   ?category=opportunity — Filter by category
 */
async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const status = searchParams.get('status') || 'active';
  const sortBy = searchParams.get('sortBy') || 'recent';
  const category = searchParams.get('category') || undefined;

  const where: Record<string, unknown> = {
    status,
    recommendation: { not: null },
  };
  if (category) where.category = category;

  const orderBy =
    sortBy === 'confidence' ? { confidenceScore: 'desc' as const } : { createdAt: 'desc' as const };

  const insights = await db.insight.findMany({
    where,
    orderBy,
    take: Math.min(isNaN(limit) ? 20 : limit, 50),
    include: {
      organization: { select: { id: true, name: true, domain: true, industry: true } },
      signal: { select: { id: true, signalType: true, severity: true } },
    },
  });

  // Compute aggregate stats
  const [total, accepted, dismissed] = await Promise.all([
    db.insight.count({ where: { recommendation: { not: null } } }),
    db.insight.count({ where: { recommendation: { not: null }, status: 'accepted' } }),
    db.insight.count({ where: { recommendation: { not: null }, status: 'dismissed' } }),
  ]);

  return apiSuccess(
    insights.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      organizationName: i.organization.name,
      organizationDomain: i.organization.domain,
      organizationIndustry: i.organization.industry,
      signalType: i.signal?.signalType,
      signalSeverity: i.signal?.severity,
      category: i.category,
      title: i.title,
      narrative: i.narrative,
      recommendation: i.recommendation,
      suggestedMessage: i.suggestedMessage,
      confidence: i.confidence,
      confidenceScore: i.confidenceScore,
      reasoningMethod: i.reasoningMethod,
      modelUsed: i.modelUsed,
      status: i.status,
      createdAt: i.createdAt,
    })),
    {
      count: insights.length,
      stats: {
        total,
        accepted,
        dismissed,
        acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        dismissalRate: total > 0 ? Math.round((dismissed / total) * 100) : 0,
      },
    },
  );
}

export const GET = withErrorHandler(_getHandler);
