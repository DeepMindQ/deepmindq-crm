import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/opportunities/rejection-insights

   Track C-5: Aggregated rejection feedback for scoring improvement.

   Returns:
     - byReason: count of each rejection reason
     - bySignalType: rejection count per signal type
     - byCapability: rejection count per recommended capability
     - recentRejections: last 20 rejected opportunities with feedback
     - topRejectedCapabilities: capabilities with highest rejection rate
   ═══════════════════════════════════════════════════════════════ */

export async function GET(_request: NextRequest) {
  try {
    const rejected = await db.opportunityRecommendation.findMany({
      where: { status: 'rejected' },
      select: {
        rejectionReason: true,
        rejectionFeedback: true,
        opportunityScore: true,
        matchScore: true,
        confidenceScore: true,
        reviewedAt: true,
        signal: {
          select: { signalType: true, impact: true, severity: true },
        },
        capabilityMatch: {
          select: { capabilityId: true },
        },
        company: {
          select: { id: true, rawName: true, industry: true },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 500,
    });

    if (rejected.length === 0) {
      return apiSuccess({
        totalRejected: 0,
        byReason: {},
        bySignalType: {},
        recentRejections: [],
        insights: [],
      });
    }

    // Aggregate by rejection reason
    const byReason: Record<string, number> = {};
    for (const r of rejected) {
      const reason = r.rejectionReason || 'unspecified';
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    // Aggregate by signal type
    const bySignalType: Record<string, number> = {};
    for (const r of rejected) {
      const st = r.signal?.signalType || 'unknown';
      bySignalType[st] = (bySignalType[st] || 0) + 1;
    }

    // Collect capability IDs that were rejected
    const capIds = [...new Set(rejected.map(r => r.capabilityMatch.capabilityId))];
    const capabilityTitles = new Map<string, string>();
    if (capIds.length > 0) {
      const caps = await db.capabilityAsset.findMany({
        where: { id: { in: capIds } },
        select: { id: true, title: true },
      });
      for (const c of caps) capabilityTitles.set(c.id, c.title);
    }

    // Aggregate by capability
    const byCapability: Record<string, number> = {};
    for (const r of rejected) {
      const title = capabilityTitles.get(r.capabilityMatch.capabilityId) || 'Unknown';
      byCapability[title] = (byCapability[title] || 0) + 1;
    }

    // Average scores for rejected opportunities
    const avgOpportunityScore = Math.round(
      rejected.reduce((sum, r) => sum + (r.opportunityScore || 0), 0) / rejected.length
    );
    const avgMatchScore = Math.round(
      rejected.reduce((sum, r) => sum + (r.matchScore || 0) * 100, 0) / rejected.length
    );
    const avgConfidence = Math.round(
      rejected.reduce((sum, r) => sum + (r.confidenceScore || 0) * 100, 0) / rejected.length
    );

    // Generate insights
    const insights: string[] = [];

    // Check if most rejections are from low-confidence opportunities
    if (avgConfidence < 40) {
      insights.push('Most rejections come from low-confidence signals. Consider raising the minimum confidence threshold for opportunity generation.');
    }

    // Check if a specific rejection reason dominates
    const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];
    if (topReason && topReason[1] > rejected.length * 0.5) {
      const reasonInsights: Record<string, string> = {
        WRONG_TIMING: 'Timing is the primary rejection reason. Consider adding a "cool-down" period before re-suggesting opportunities for recently rejected companies.',
        NO_BUDGET: 'Budget constraints dominate rejections. Consider filtering out companies without recent funding signals or known budget constraints.',
        NOT_RELEVANT: 'Relevance is the primary concern. The capability matching algorithm may need tuning — review keywords and problem statements.',
        LOW_CONFIDENCE: 'Low confidence drives rejections. Increase minimum evidence quality threshold before generating opportunities.',
        EXISTING_RELATIONSHIP: 'Many rejections cite existing relationships. Cross-reference with CRM data to avoid suggesting companies already engaged.',
      };
      if (reasonInsights[topReason[0]]) {
        insights.push(reasonInsights[topReason[0]]);
      }
    }

    // Check if specific capabilities are frequently rejected
    const topCapability = Object.entries(byCapability).sort((a, b) => b[1] - a[1])[0];
    if (topCapability && topCapability[1] > 3) {
      insights.push(`"${topCapability[0]}" has been rejected ${topCapability[1]} times. Review capability positioning or targeting criteria.`);
    }

    // Recent rejections with feedback (last 20)
    const recentRejections = rejected.slice(0, 20).map(r => ({
      company: r.company.rawName,
      industry: r.company.industry,
      signalType: r.signal?.signalType,
      capabilityTitle: capabilityTitles.get(r.capabilityMatch.capabilityId) || 'Unknown',
      rejectionReason: r.rejectionReason,
      rejectionFeedback: r.rejectionFeedback,
      opportunityScore: r.opportunityScore,
      matchScorePercent: Math.round((r.matchScore || 0) * 100),
      confidencePercent: Math.round((r.confidenceScore || 0) * 100),
      reviewedAt: r.reviewedAt,
    }));

    return apiSuccess({
      totalRejected: rejected.length,
      byReason,
      bySignalType,
      byCapability,
      averageScores: {
        opportunityScore: avgOpportunityScore,
        matchScore: avgMatchScore,
        confidence: avgConfidence,
      },
      insights,
      recentRejections,
    });
  } catch (error) {
    console.error('[rejection-insights] GET error:', error);
    return apiError('Failed to fetch rejection insights');
  }
}