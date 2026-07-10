import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
    const companyId = searchParams.get("companyId");
    const contactId = searchParams.get("contactId");

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (contactId) where.contactId = contactId;

    const entries = await db.timelineEntry.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch timeline:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}

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