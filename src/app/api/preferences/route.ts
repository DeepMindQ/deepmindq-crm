import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody } from "@/lib/apiHelpers";
import { updatePreferencesSchema } from "@/lib/validations";

// UserPreferences is a singleton model — there should be exactly one row.

export async function GET() {
  try {
    let prefs = await db.userPreferences.findFirst();

    if (!prefs) {
      prefs = await db.userPreferences.create({ data: {} });
    }

    // C4: Omit aiApiKey from the response to prevent API key leak
    const { aiApiKey: _omitted, ...safePrefs } = prefs;

    return apiSuccess(safePrefs);
  } catch {
    return apiError("Failed to fetch preferences");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const parsed = validateBody(updatePreferencesSchema, body);
    if (parsed instanceof Response) {
      return parsed;
    }

    const updateData: Record<string, unknown> = { ...parsed };

    // H5: Use upsert to fix race condition — find the existing record first
    const existing = await db.userPreferences.findFirst();

    const result = await db.userPreferences.upsert({
      where: { id: existing?.id || '_singleton_' },
      update: updateData,
      create: { id: existing?.id || '_singleton_', ...updateData },
    });

    // C4: Omit aiApiKey from the response
    const { aiApiKey: _omitted, ...safeResult } = result;

    return apiSuccess(safeResult);
  } catch {
    return apiError("Failed to update preferences");
  }
}