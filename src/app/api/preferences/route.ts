import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// UserPreferences is a singleton model — there should be exactly one row.
// findFirst handles both fresh installs and already-seeded databases
// (which may have a cuid-generated id).

export async function GET() {
  try {
    let prefs = await db.userPreferences.findFirst();

    if (!prefs) {
      prefs = await db.userPreferences.create({ data: {} });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const allowedFields = [
      "tone",
      "emailLength",
      "openerStyle",
      "signOff",
      "avoidPhrases",
      "exampleEmail",
      "ctaStyle",
      "aiProvider",
      "aiModel",
      "aiApiKey",
      "scoringWeights",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const existing = await db.userPreferences.findFirst();

    let result;
    if (existing) {
      result = await db.userPreferences.update({
        where: { id: existing.id },
        data,
      });
    } else {
      result = await db.userPreferences.create({ data });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}