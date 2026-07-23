// @ts-nocheck
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from "@/lib/apiHelpers";
import { createOpportunitySchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const page = Math.max(1, safeInt(searchParams.get("page"), 1, 10));
    const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 20, 10)));

    const where = companyId ? { companyId } : {};

    const [opportunities, total] = await Promise.all([
      db.opportunityRecommendation.findMany({
        where,
        include: { company: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.opportunityRecommendation.count({ where }),
    ]);

    return apiSuccess({
      data: opportunities,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch opportunities:", error);
    return apiError("Failed to fetch opportunities", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = validateBody(createOpportunitySchema, raw);
    if (parsed instanceof Response) {
      return parsed;
    }

    const { companyId, title, description, targetContactId, status, nextAction } = parsed;

    // Validate company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    // Validate targetContactId FK if provided
    if (targetContactId) {
      const contact = await db.contact.findUnique({ where: { id: targetContactId } });
      if (!contact) {
        return apiError("Target contact not found", 404);
      }
    }

    const opportunity = await db.opportunityRecommendation.create({
      data: {
        companyId,
        title: sanitize(title),
        description: description ? sanitize(description) : null,
        targetContactId: targetContactId ?? null,
        status: status ?? "researching",
        nextAction: nextAction ? sanitize(nextAction) : null,
      },
      include: { company: true },
    });

    await db.companyTimelineEvent.create({
      data: {
        companyId,
        action: "opportunity_created",
        details: `New opportunity "${opportunity.title}" created for "${company.name}"`,
      },
    });

    return apiSuccess(opportunity, 201);
  } catch (error) {
    console.error("Failed to create opportunity:", error);
    return apiError("Failed to create opportunity", 500);
  }
}