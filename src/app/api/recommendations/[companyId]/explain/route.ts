import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';

/**
 * GET /api/recommendations/[companyId]/explain
 * Returns recommendations for a specific organization with explainability data:
 * - What signals triggered the recommendation
 * - Evidence backing it
 * - Confidence breakdown
 *
 * Q10 FIX: Explainability endpoint for recommendation transparency
 */
async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 });
  }

  const insights = await db.insight.findMany({
    where: {
      organizationId: companyId,
      status: 'active',
      recommendation: { not: null },
    },
    orderBy: { confidenceScore: 'desc' },
    take: 10,
    include: {
      organization: { select: { id: true, name: true, domain: true, industry: true } },
      signal: {
        include: {
          evidence: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });

  // Build explainability context
  const org = await db.organization.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      intelligenceScore: true,
    },
  });

  const orgSignalCount = await db.signal.count({
    where: { organizationId: companyId },
  });

  return apiSuccess({
    organization: org,
    signalCount: orgSignalCount,
    recommendations: insights.map((i) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      narrative: i.narrative,
      recommendation: i.recommendation,
      suggestedMessage: i.suggestedMessage,
      confidence: i.confidence,
      confidenceScore: i.confidenceScore,
      reasoningMethod: i.reasoningMethod,
      modelUsed: i.modelUsed,
      triggeringSignal: i.signal
        ? {
            id: i.signal.id,
            type: i.signal.signalType,
            severity: i.signal.severity,
            title: i.signal.title,
            evidence: i.signal.evidence.map((e) => ({
              id: e.id,
              claim: e.claim,
              reliability: e.reliability,
              sourceType: e.sourceType,
            })),
          }
        : null,
    })),
  });
}

export const GET = withErrorHandler(_getHandler);
