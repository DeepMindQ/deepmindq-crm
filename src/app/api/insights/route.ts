import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';

/**
 * GET /api/insights
 * Fetch recent insights across all organizations with recommendations and messages.
 * Q12 FIX: Surfaces Insight.recommendation and Insight.suggestedMessage for the UI.
 *
 * Query params:
 *   ?limit=20        — Max insights to return
 *   ?category=opportunity — Filter by category
 *   ?hasRecommendation=true — Only insights that have recommendations
 */
async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const category = searchParams.get('category') || undefined;
  const hasRecommendation = searchParams.get('hasRecommendation') === 'true';

  const where: Record<string, unknown> = { status: 'active' };
  if (category) where.category = category;
  if (hasRecommendation) where.recommendation = { not: null };

  const insights = await db.insight.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(isNaN(limit) ? 20 : limit, 50),
    include: {
      organization: { select: { id: true, name: true, domain: true } },
      signal: { select: { id: true, signalType: true, severity: true } },
    },
  });

  return apiSuccess(
    insights.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      organizationName: i.organization.name,
      organizationDomain: i.organization.domain,
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
      createdAt: i.createdAt,
    })),
    { count: insights.length },
  );
}

export const GET = withErrorHandler(_getHandler);
