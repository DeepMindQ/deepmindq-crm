import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, contactId, action, details } = body;

    if (!action || typeof action !== "string" || action.trim().length === 0) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    const entry = await db.timelineEntry.create({
      data: {
        companyId: companyId || null,
        contactId: contactId || null,
        action: action.trim(),
        details: details?.trim() || null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create timeline entry:", error);
    return NextResponse.json(
      { error: "Failed to create timeline entry" },
      { status: 500 }
    );
  }
}