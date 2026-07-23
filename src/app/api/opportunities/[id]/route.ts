import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess, validateBody, sanitize } from "@/lib/apiHelpers";
import { updateOpportunitySchema } from "@/lib/validations";
import { OPPORTUNITY_STATUSES } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const opp = await db.opportunityRecommendation.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!opp) {
      return apiError("Opportunity not found", 404);
    }
    return apiSuccess(opp);
  } catch (error) {
    console.error("Failed to fetch opportunity:", error);
    return apiError("Failed to fetch opportunity", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = await request.json();
    const parsed = validateBody(updateOpportunitySchema, raw);
    if (parsed instanceof Response) {
      return parsed;
    }

    const existing = await db.opportunityRecommendation.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!existing) {
      return apiError("Opportunity not found", 404);
    }

    const data: Prisma.OpportunityRecommendationUpdateInput = {};

    if (parsed.title !== undefined) {
      data.opportunityTitle = sanitize(parsed.title);
    }
    if (parsed.description !== undefined) {
      data.businessProblem = parsed.description ? sanitize(parsed.description) : '';
    }
    if (parsed.status !== undefined) {
      if (!OPPORTUNITY_STATUSES.includes(parsed.status)) {
        return apiError(`Invalid status. Must be one of: ${OPPORTUNITY_STATUSES.join(", ")}`);
      }
      data.status = parsed.status;
    }
    if (parsed.nextAction !== undefined) {
      data.suggestedConversation = parsed.nextAction ? sanitize(parsed.nextAction) : '';
    }

    const updated = await db.opportunityRecommendation.update({
      where: { id },
      data,
      include: { company: true },
    });

    // Only create TimelineEntry if status actually changed
    if (parsed.status !== undefined && parsed.status !== existing.status) {
      await db.companyTimelineEvent.create({
        data: {
          companyId: existing.companyId,
          eventType: "opportunity_updated",
          title: "Opportunity updated",
          description: `Opportunity "${updated.opportunityTitle}" status changed from "${existing.status}" to "${updated.status}"`,
        },
      });
    }

    return apiSuccess(updated);
  } catch (error) {
    console.error("Failed to update opportunity:", error);
    return apiError("Failed to update opportunity", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.opportunityRecommendation.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Opportunity not found", 404);
    }

    await db.opportunityRecommendation.delete({ where: { id } });

    await db.companyTimelineEvent.create({
      data: {
        companyId: existing.companyId,
        eventType: "opportunity_updated",
        title: "Opportunity deleted",
        description: `Opportunity "${existing.opportunityTitle}" deleted`,
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Failed to delete opportunity:", error);
    return apiError("Failed to delete opportunity", 500);
  }
}
