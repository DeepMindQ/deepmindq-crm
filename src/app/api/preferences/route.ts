import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody } from "@/lib/apiHelpers";
import { updatePreferencesSchema } from "@/lib/validations";

// SystemSetting is a key-value store model.

export async function GET() {
  try {
    // SystemSetting is a key-value store; preferences are stored under a special key.
    // Find the preferences record by key.
    const prefs = await db.systemSetting.findFirst({
      where: { key: 'user_preferences' },
    });

    if (!prefs) {
      // Return empty defaults
      return apiSuccess({ key: 'user_preferences', value: '{}' });
    }

    return apiSuccess(prefs);
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

    const valueJson = JSON.stringify(parsed);

    // H5: Use upsert to fix race condition
    const existing = await db.systemSetting.findFirst({
      where: { key: 'user_preferences' },
    });

    if (existing) {
      const result = await db.systemSetting.update({
        where: { id: existing.id },
        data: { value: valueJson },
      });

      return apiSuccess(result);
    } else {
      const result = await db.systemSetting.create({
        data: {
          key: 'user_preferences',
          value: valueJson,
        },
      });

      return apiSuccess(result);
    }
  } catch {
    return apiError("Failed to update preferences");
  }
}
