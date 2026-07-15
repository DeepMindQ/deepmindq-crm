import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody, sanitizeFields } from "@/lib/apiHelpers";
import { updateContactSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contact = await db.contact.findUnique({
      where: { id },
      include: {
        company: true,
        notes: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        timeline: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            company: { select: { id: true, name: true } },
          },
        },
        healthChecks: {
          orderBy: { checkedAt: "desc" },
          take: 20,
        },
        drafts: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!contact) {
      return apiError("Contact not found", 404);
    }

    return apiSuccess(contact);
  } catch (error) {
    console.error("Failed to fetch contact:", error);
    return apiError("Failed to fetch contact", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) {
      return apiError("Contact not found", 404);
    }

    // Validate body with Zod schema
    const data = validateBody(updateContactSchema, body);
    if (data instanceof Response) return data;

    // Validate emailHealthScore if provided (not in schema)
    if (body.emailHealthScore !== undefined) {
      if (
        typeof body.emailHealthScore !== "number" ||
        !Number.isInteger(body.emailHealthScore) ||
        body.emailHealthScore < 0 ||
        body.emailHealthScore > 100
      ) {
        return apiError("emailHealthScore must be an integer between 0 and 100", 400);
      }
    }

    // Validate emailHealth if provided (not in schema)
    const VALID_EMAIL_HEALTH = ["valid", "risky", "invalid", "unknown"];
    if (body.emailHealth !== undefined && !VALID_EMAIL_HEALTH.includes(body.emailHealth)) {
      return apiError(
        `Invalid emailHealth. Must be one of: ${VALID_EMAIL_HEALTH.join(", ")}`,
        400
      );
    }

    // Sanitize string fields
    const sanitized = sanitizeFields(
      { ...data } as unknown as Record<string, unknown>,
      ["name", "email", "jobTitle", "linkedinUrl", "phone", "location"]
    );

    // Merge schema-validated data with extra validated fields
    const updateData: Record<string, unknown> = { ...sanitized };
    if (body.emailHealthScore !== undefined) {
      updateData.emailHealthScore = body.emailHealthScore;
    }
    if (body.emailHealth !== undefined) {
      updateData.emailHealth = body.emailHealth;
    }

    // Remove empty strings that should be null
    for (const field of ["email", "linkedinUrl"]) {
      if (updateData[field] === "") {
        updateData[field] = null;
      }
    }

    const updated = await db.contact.update({
      where: { id },
      data: updateData,
    });

    await db.timelineEntry.create({
      data: {
        companyId: contact.companyId,
        contactId: id,
        action: "contact_updated",
        details: `Contact "${updated.name}" was updated`,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return apiError("Failed to update contact", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contact = await db.contact.findUnique({ where: { id } });
    if (!contact) {
      return apiError("Contact not found", 404);
    }

    // Check if already archived
    if (contact.archivedAt !== null) {
      return apiError("Contact is already archived", 409);
    }

    const archived = await db.contact.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await db.timelineEntry.create({
      data: {
        companyId: contact.companyId,
        contactId: id,
        action: "contact_archived",
        details: `Contact "${contact.name}" was archived`,
      },
    });

    return apiSuccess(archived);
  } catch (error) {
    console.error("Failed to archive contact:", error);
    return apiError("Failed to archive contact", 500);
  }
}