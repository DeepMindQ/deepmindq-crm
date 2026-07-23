// @ts-nocheck
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from "@/lib/apiHelpers";
import { createTimelineSchema } from "@/lib/validations";
import { TIMELINE_ACTIONS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get("limit"), 50, 10)));
    const companyId = searchParams.get("companyId");
    const contactId = searchParams.get("contactId");

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (contactId) where.contactId = contactId;

    const entries = await db.companyTimelineEvent.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
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

    const { companyId, contactId, action, details } = parsed;

    // Validate action is in TIMELINE_ACTIONS (defense-in-depth; schema also enforces)
    if (!TIMELINE_ACTIONS.includes(action)) {
      return apiError(`Invalid action. Must be one of: ${TIMELINE_ACTIONS.join(", ")}`);
    }

    // Validate companyId FK if provided
    if (companyId) {
      const company = await db.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return apiError("Company not found", 404);
      }
    }

    // Validate contactId FK if provided
    if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: { select: { id: true } } },
      });
      if (!contact) {
        return apiError("Contact not found", 404);
      }

      // H24: If both companyId AND contactId provided, contact must belong to that company
      if (companyId && contact.company?.id !== companyId) {
        return apiError("Contact does not belong to the specified company");
      }
    }

    const entry = await db.companyTimelineEvent.create({
      data: {
        companyId: companyId ?? null,
        contactId: contactId ?? null,
        action: sanitize(action),
        details: details ? sanitize(details) : null,
      },
    });

    return apiSuccess(entry, 201);
  } catch (error) {
    console.error("Failed to create timeline entry:", error);
    return apiError("Failed to create timeline entry", 500);
  }
}