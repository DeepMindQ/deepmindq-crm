import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════════════════
   Ticket 9 — Reject Opportunity

   Per ARCHITECTURE.md exit criteria:
   "Reject with reason updates OpportunityRecommendation"

   POST /api/ai/opportunities/[id]/reject
   Body: { reason: string, feedback?: string, feedbackDecision?: string }
   ═══════════════════════════════════════════════════════════════ */

const VALID_REJECTION_REASONS = [
  'WRONG_TIMING',
  'EXISTING_RELATIONSHIP',
  'NOT_RELEVANT',
  'LOW_CONFIDENCE',
  'NO_BUDGET',
  'OTHER',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.length < 1) {
      return apiError('Opportunity ID is required', 400);
    }

    // Parse required body
    let body: {
      reason?: string;
      feedback?: string;
      feedbackDecision?: string;
    } = {};
    try {
      body = await request.json();
    } catch {
      return apiError('Request body must include at least a rejection reason', 400);
    }

    if (!body.reason || !VALID_REJECTION_REASONS.includes(body.reason)) {
      return apiError(
        `Rejection reason is required and must be one of: ${VALID_REJECTION_REASONS.join(', ')}`,
        400,
      );
    }

    // 1. Fetch the opportunity
    const opportunity = await db.opportunityRecommendation.findUnique({
      where: { id },
    });

    if (!opportunity) {
      return apiError('Opportunity not found', 404);
    }

    if (opportunity.status === 'rejected') {
      return apiError('Opportunity is already rejected', 409);
    }

    // 2. Update opportunity status + rejection reason
    const updatedOpp = await db.opportunityRecommendation.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: body.reason,
        rejectionFeedback: body.feedback ?? undefined,
        reviewedAt: new Date(),
        reviewedBy: session!.id,
      },
    });

    // 3. Create RecommendationFeedback (integration test: "Feedback stored in RecommendationFeedback")
    await db.recommendationFeedback.create({
      data: {
        recommendationId: id,
        companyId: opportunity.companyId,
        userDecision: body.feedbackDecision ?? 'incorrect',
        feedbackReason: `${body.reason}: ${body.feedback ?? 'No additional feedback'}`,
      },
    });

    return apiSuccess({
      opportunity: updatedOpp,
      message: 'Opportunity rejected',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject opportunity';
    return apiError(message, 500);
  }
}
