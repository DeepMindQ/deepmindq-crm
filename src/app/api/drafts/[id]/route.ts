import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { subject, body: draftBody, status, rejectReason } = body;

    const existing = await db.draft.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (subject !== undefined) {
      updateData.subject = subject;
    }
    if (draftBody !== undefined) {
      updateData.body = draftBody;
    }
    if (status !== undefined) {
      const allowedStatuses = ["draft", "sent", "rejected"];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${allowedStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (rejectReason !== undefined) {
      updateData.rejectReason = rejectReason;
    }

    const updated = await db.draft.update({
      where: { id },
      data: updateData,
      include: { contact: true },
    });

    // Create a timeline entry when draft is sent
    if (status === "sent" && existing.status !== "sent" && updated.contact?.companyId) {
      await db.timelineEntry.create({
        data: {
          contactId: updated.contactId,
          companyId: updated.contact.companyId,
          action: "email_sent",
          details: `Draft email "${updated.subject || "(no subject)"}" was sent to ${updated.contact.name}`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
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

    const existing = await db.draft.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await db.draft.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete draft:", error);
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    );
  }
}