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

    const { companyId, title, description, status, nextAction } = parsed;

    // Validate company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    // Ensure prerequisite records exist for FK requirements
    const [signal, capability] = await Promise.all([
      db.companySignal.findFirst({ where: { companyId } }),
      db.capabilityAsset.findFirst({ where: { isActive: true } }),
    ]);

    const signalId = signal?.id ?? (await db.companySignal.create({
      data: {
        companyId,
        signalType: 'manual',
        title: `Manual opportunity: ${title}`,
        severity: 'low',
        impact: 'low',
      },
    })).id;

    const capabilityId = capability?.id ?? (await db.capabilityAsset.create({
      data: {
        title: `Manual: ${title}`,
        summary: description ?? '',
        category: 'other',
      },
    })).id;

    const capabilityMatch = await db.signalCapabilityMatch.findFirst({
      where: { signalId, capabilityId },
    }) ?? await db.signalCapabilityMatch.create({
      data: {
        companyId,
        signalId,
        capabilityId,
        reason: `Manual opportunity created`,
      },
    });

    const opportunity = await db.opportunityRecommendation.create({
      data: {
        companyId,
        signalId,
        capabilityMatchId: capabilityMatch.id,
        opportunityTitle: sanitize(title),
        businessProblem: description ? sanitize(description) : '',
        recommendedCapability: 'Manual opportunity',
        suggestedConversation: nextAction ? sanitize(nextAction) : '',
        status: status ?? "researching",
        whyNow: 'Manually created opportunity',
        businessTrigger: 'manual',
      },
      include: { company: true },
    });

    await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: "opportunity_created",
        title: "Opportunity created",
        description: `New opportunity "${opportunity.opportunityTitle}" created for "${company.rawName}"`,
      },
    });

    return apiSuccess(opportunity, 201);
  } catch (error) {
    console.error("Failed to create opportunity:", error);
    return apiError("Failed to create opportunity", 500);
  }
}
