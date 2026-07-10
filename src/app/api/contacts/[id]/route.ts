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

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
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