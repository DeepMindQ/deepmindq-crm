import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, safeInt } from "@/lib/apiHelpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const page = Math.max(1, safeInt(searchParams.get("page"), 1, 10));
    const pageSize = Math.min(50, Math.max(1, safeInt(searchParams.get("pageSize"), 50, 10)));

    const where = contactId ? { contactId } : {};

    const [drafts, total] = await Promise.all([
      db.draft.findMany({
        where,
        include: { contact: true },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.draft.count({ where }),
    ]);

    return apiSuccess({
      data: drafts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch drafts:", error);
    return apiError("Failed to fetch drafts", 500);
  }
}