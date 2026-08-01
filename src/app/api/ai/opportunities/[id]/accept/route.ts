import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════════════════
   Ticket 9 — Accept Opportunity

   Per ARCHITECTURE.md exit criteria:
   "Accept creates Pursuit record"

   POST /api/ai/opportunities/[id]/accept
   Body (optional): { feedbackDecision?, feedbackReason? }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.length < 1) {
      return apiError('Opportunity ID is required', 400);
    }

    // Parse optional feedback body
    let body: { feedbackDecision?: string; feedbackReason?: string } = {};
    try {
      const raw = await request.json();
      if (raw && typeof raw === 'object') {
        body = raw as typeof body;
      }
    } catch {
      // No body or invalid JSON — that's fine, feedback is optional
    }

    // 1. Fetch the opportunity
    const opportunity = await db.opportunityRecommendation.findUnique({
      where: { id },
      include: {
        company: { select: { id: true } },
      },
    });

    if (!opportunity) {
      return apiError('Opportunity not found', 404);
    }

    if (opportunity.status === 'accepted') {
      return apiError('Opportunity is already accepted', 409);
    }

    // 2. Update opportunity status to 'accepted'
    const [updatedOpp] = await db.$transaction([
      db.opportunityRecommendation.update({
        where: { id },
        data: {
          status: 'accepted',
          reviewedAt: new Date(),
          reviewedBy: 'current_user', // TODO: wire to auth session
        },
      }),

      // 3. Create Pursuit record (exit criteria: "Accept creates Pursuit record")
      db.pursuit.create({
        data: {
          opportunityId: id,
          companyId: opportunity.companyId,
          priority: opportunity.priority,
          status: 'active',
          nextAction: `Pursue ${opportunity.opportunityTitle}`,
          nextActionAt: new Date(),
          notes: `Accepted from opportunity recommendation. Trigger: ${opportunity.businessTrigger}. Why now: ${opportunity.whyNow}`,
        },
      }),
    ]);

    // 4. Create RecommendationFeedback if feedback provided
    if (body.feedbackDecision) {
      await db.recommendationFeedback.create({
        data: {
          recommendationId: id,
          companyId: opportunity.companyId,
          userDecision: body.feedbackDecision,
          feedbackReason: body.feedbackReason ?? undefined,
        },
      });
    }

    return apiSuccess({
      opportunity: updatedOpp,
      message: 'Opportunity accepted and pursuit created',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept opportunity';
    return apiError(message, 500);
  }
}
