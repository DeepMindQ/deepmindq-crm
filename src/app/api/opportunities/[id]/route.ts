import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitize } from "@/lib/apiHelpers";
import { updateOpportunitySchema } from "@/lib/validations";
import { OPPORTUNITY_STATUSES } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const opp = await db.opportunity.findUnique({
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

    const existing = await db.opportunity.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!existing) {
      return apiError("Opportunity not found", 404);
    }

    const data: Record<string, unknown> = {};

    if (parsed.title !== undefined) data.title = sanitize(parsed.title);
    if (parsed.description !== undefined) data.description = parsed.description ? sanitize(parsed.description) : undefined;
    if (parsed.targetContactId !== undefined) {
      if (parsed.targetContactId !== null) {
        const contact = await db.contact.findUnique({ where: { id: parsed.targetContactId } });
        if (!contact) {
          return apiError("Target contact not found", 404);
        }
      }
      data.targetContactId = parsed.targetContactId;
    }
    if (parsed.status !== undefined) {
      if (!OPPORTUNITY_STATUSES.includes(parsed.status)) {
        return apiError(`Invalid status. Must be one of: ${OPPORTUNITY_STATUSES.join(", ")}`);
      }
      data.status = parsed.status;
    }
    if (parsed.nextAction !== undefined) {
      data.nextAction = parsed.nextAction ? sanitize(parsed.nextAction) : null;
    }

    const updated = await db.opportunity.update({
      where: { id },
      data,
      include: { company: true },
    });

    // Only create TimelineEntry if status actually changed
    if (data.status !== undefined && data.status !== existing.status) {
      await db.timelineEntry.create({
        data: {
          companyId: existing.companyId,
          action: "opportunity_updated",
          details: `Opportunity "${updated.title}" status changed from "${existing.status}" to "${updated.status}"`,
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

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Opportunity not found", 404);
    }

    await db.opportunity.delete({ where: { id } });

    await db.timelineEntry.create({
      data: {
        companyId: existing.companyId,
        action: "opportunity_updated",
        details: `Opportunity "${existing.title}" deleted`,
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Failed to delete opportunity:", error);
    return apiError("Failed to delete opportunity", 500);
  }
}