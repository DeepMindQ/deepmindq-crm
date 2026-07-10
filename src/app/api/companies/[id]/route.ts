import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitizeFields, safeInt } from "@/lib/apiHelpers";
import { updateCompanySchema } from "@/lib/validations";
import { DATA_FRESHNESS_VALUES } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await db.company.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        researchCard: true,
        opportunities: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        timeline: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            contact: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!company) {
      return apiError("Company not found", 404);
    }

    return apiSuccess(company);
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return apiError("Failed to fetch company", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    // Validate extra fields not covered by the schema
    if (body.dataFreshness !== undefined) {
      if (!DATA_FRESHNESS_VALUES.includes(body.dataFreshness)) {
        return apiError(
          `Invalid dataFreshness. Must be one of: ${DATA_FRESHNESS_VALUES.join(", ")}`,
          400
        );
      }
    }

    if (body.intelligenceScore !== undefined) {
      if (
        typeof body.intelligenceScore !== "number" ||
        !Number.isInteger(body.intelligenceScore) ||
        body.intelligenceScore < 0 ||
        body.intelligenceScore > 100
      ) {
        return apiError("intelligenceScore must be an integer between 0 and 100", 400);
      }
    }

    // Validate body with Zod schema (covers name, domain, website, linkedinUrl, industry, employeeSize, country, location, status)
    const data = validateBody(updateCompanySchema, body);
    if (data instanceof Response) return data;

    // Sanitize string fields
    const sanitized = sanitizeFields(
      { ...data } as unknown as Record<string, unknown>,
      ["name", "domain", "website", "linkedinUrl", "industry", "country", "location"]
    );

    // Merge schema-validated data with extra validated fields
    const updateData: Record<string, unknown> = { ...sanitized };
    if (body.dataFreshness !== undefined) {
      updateData.dataFreshness = body.dataFreshness;
    }
    if (body.intelligenceScore !== undefined) {
      updateData.intelligenceScore = body.intelligenceScore;
    }

    // Remove undefined / empty string fields that should be null
    for (const field of ["domain", "website", "linkedinUrl", "industry", "country", "location"]) {
      if (updateData[field] === "") {
        updateData[field] = null;
      }
    }

    const updated = await db.company.update({
      where: { id },
      data: updateData,
    });

    await db.timelineEntry.create({
      data: {
        companyId: id,
        action: "company_updated",
        details: `Company "${updated.name}" was updated`,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Failed to update company:", error);
    return apiError("Failed to update company", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return apiError("Company not found", 404);
    }

    const archived = await db.company.update({
      where: { id },
      data: { status: "archived" },
    });

    await db.timelineEntry.create({
      data: {
        companyId: id,
        action: "company_archived",
        details: `Company "${company.name}" was archived`,
      },
    });

    return apiSuccess(archived);
  } catch (error) {
    console.error("Failed to archive company:", error);
    return apiError("Failed to archive company", 500);
  }
}