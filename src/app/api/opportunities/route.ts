import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from "@/lib/apiHelpers";
import { buildKeysetWhere, encodeCursor } from '@/lib/keyset-pagination';
import { createOpportunitySchema } from "@/lib/validations";
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const page = Math.max(1, safeInt(searchParams.get("page"), 1, 10));
    const pageSize = Math.min(100, Math.max(1, safeInt(searchParams.get("pageSize"), 20, 10)));
    const cursorParam = searchParams.get("cursor") || null;

    const where = companyId ? { companyId } : {};

    // Keyset pagination: when cursor is provided, use keyset WHERE; otherwise fall back to offset
    const cursor = cursorParam;
    const keysetWhere = cursor
      ? buildKeysetWhere({ cursor, sortBy: 'createdAt', sortOrder: 'desc', additionalCursorFields: { id: null } })
      : {};
    const skip = cursor ? undefined : (page - 1) * pageSize;
    const takeLimit = cursor ? pageSize + 1 : pageSize;

    const [opportunities, total] = await Promise.all([
      // P5.1: Explicit select to avoid SELECT * and heavy JSON fields
      db.opportunityRecommendation.findMany({
        where: { ...where, ...keysetWhere },
        select: {
          id: true,
          companyId: true,
          signalId: true,
          opportunityTitle: true,
          businessTrigger: true,
          whyNow: true,
          businessProblem: true,
          recommendedCapability: true,
          suggestedConversation: true,
          confidenceScore: true,
          freshnessScore: true,
          matchScore: true,
          opportunityScore: true,
          priority: true,
          status: true,
          rejectionReason: true,
          reviewedBy: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, rawName: true, domain: true, industry: true } },
        },
        orderBy: { createdAt: "desc" },
        ...(skip !== undefined ? { skip } : {}),
        take: takeLimit,
      }),
      db.opportunityRecommendation.count({ where }),
    ]);

    // Keyset: detect hasMore and trim extra item
    const hasMore = cursor ? opportunities.length > pageSize : false;
    if (hasMore) opportunities.pop();

    const nextCursor = hasMore && opportunities.length > 0
      ? encodeCursor({ createdAt: opportunities[opportunities.length - 1].createdAt, id: opportunities[opportunities.length - 1].id })
      : null;

    return apiSuccess({
      data: opportunities,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch opportunities:", { error: error });
    return apiError("Failed to fetch opportunities", 500);
  }
}

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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
        signalType: 'internal_memory',
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
    logger.error("Failed to create opportunity:", { error: error });
    return apiError("Failed to create opportunity", 500);
  }
}
