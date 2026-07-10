import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    const where = contactId ? { contactId } : {};

    const drafts = await db.draft.findMany({
      where,
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error("Failed to fetch drafts:", error);
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}