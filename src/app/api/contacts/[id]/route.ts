import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
        },
        timeline: {
          orderBy: { createdAt: "desc" },
          include: {
            company: { select: { id: true, name: true } },
          },
        },
        healthChecks: {
          orderBy: { checkedAt: "desc" },
        },
        drafts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Failed to fetch contact:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const allowedFields = [
      "name",
      "email",
      "jobTitle",
      "roleBucket",
      "linkedinUrl",
      "phone",
      "location",
      "status",
      "emailHealth",
      "emailHealthScore",
      "lastContactedAt",
      "lastValidatedAt",
    ];

    const VALID_STATUSES = ["new", "active", "archived"];
    const VALID_EMAIL_HEALTH = ["valid", "risky", "invalid", "unknown"];

    // Validate status if provided
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate emailHealth if provided
    if (body.emailHealth !== undefined && !VALID_EMAIL_HEALTH.includes(body.emailHealth)) {
      return NextResponse.json(
        { error: `Invalid emailHealth. Must be one of: ${VALID_EMAIL_HEALTH.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate emailHealthScore if provided
    if (body.emailHealthScore !== undefined) {
      if (typeof body.emailHealthScore !== "number" || !Number.isInteger(body.emailHealthScore) || body.emailHealthScore < 0 || body.emailHealthScore > 100) {
        return NextResponse.json(
          { error: "emailHealthScore must be an integer between 0 and 100" },
          { status: 400 }
        );
      }
    }

    // Validate email format if provided
    if (body.email !== undefined && body.email !== null) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Trim string fields
        if (typeof body[field] === "string") {
          data[field] = (body[field] as string).trim();
        } else {
          data[field] = body[field];
        }
      }
    }

    const updated = await db.contact.update({
      where: { id },
      data,
    });

    await db.timelineEntry.create({
      data: {
        companyId: contact.companyId,
        contactId: id,
        action: "contact_updated",
        details: `Contact "${updated.name}" was updated`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
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

    return NextResponse.json(archived);
  } catch (error) {
    console.error("Failed to archive contact:", error);
    return NextResponse.json(
      { error: "Failed to archive contact" },
      { status: 500 }
    );
  }
}