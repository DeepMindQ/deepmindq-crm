import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from "@/lib/apiHelpers";
import { createTimelineSchema } from "@/lib/validations";
import { TIMELINE_ACTIONS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get("limit"), 50, 10)));
    const companyId = searchParams.get("companyId");

    const where: Prisma.CompanyTimelineEventWhereInput = {};
    if (companyId) where.companyId = companyId;

    const entries = await db.companyTimelineEvent.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, rawName: true } },
      },
    });

    return apiSuccess(entries);
  } catch (error) {
    console.error("Failed to fetch timeline:", error);
    return apiError("Failed to fetch timeline", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = validateBody(createTimelineSchema, raw);
    if (parsed instanceof Response) {
      return parsed;
    }

    const { companyId, action, details } = parsed;

    // Validate action is in TIMELINE_ACTIONS (defense-in-depth; schema also enforces)
    if (!TIMELINE_ACTIONS.includes(action)) {
      return apiError(`Invalid action. Must be one of: ${TIMELINE_ACTIONS.join(", ")}`);
    }

    // companyId is required for CompanyTimelineEvent
    if (!companyId) {
      return apiError("companyId is required");
    }

    // Validate companyId FK
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    const entry = await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: sanitize(action),
        title: sanitize(action),
        description: details ? sanitize(details) : null,
      },
    });

    return apiSuccess(entry, 201);
  } catch (error) {
    console.error("Failed to create timeline entry:", error);
    return apiError("Failed to create timeline entry", 500);
  }
}
