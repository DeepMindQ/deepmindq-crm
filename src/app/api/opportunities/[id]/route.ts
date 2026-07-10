import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const opp = await db.opportunity.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!opp) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(opp);
  } catch (error) {
    console.error("Failed to fetch opportunity:", error);
    return NextResponse.json(
      { error: "Failed to fetch opportunity" },
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

    const existing = await db.opportunity.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const allowed = ["title", "description", "targetContactId", "status", "nextAction"];
    const data: Record<string, unknown> = {};
    for (const field of allowed) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const updated = await db.opportunity.update({
      where: { id },
      data,
      include: { company: true },
    });

    // Only create TimelineEntry if status actually changed
    if (data.status !== undefined && data.status !== existing.status) {
      await db.timelineEntry.create({
        data: {
          companyId: existing.companyId,
          action: "opportunity_updated",
          details: `Opportunity "${updated.title}" status changed from "${existing.status}" to "${updated.status}"`,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update opportunity:", error);
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    await db.opportunity.delete({ where: { id } });

    await db.timelineEntry.create({
      data: {
        companyId: existing.companyId,
        action: "opportunity_deleted",
        details: `Opportunity "${existing.title}" deleted`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete opportunity:", error);
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 }
    );
  }
}