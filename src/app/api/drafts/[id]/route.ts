import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, rejectReason } = body;

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const allowedStatuses = ["draft", "sent", "rejected"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await db.draft.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "rejected" && rejectReason) {
      updateData.rejectReason = rejectReason;
    }

    const updated = await db.draft.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update draft:", error);
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    );
  }
}