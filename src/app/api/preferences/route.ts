import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, validateBody } from "@/lib/apiHelpers";
import { updatePreferencesSchema } from "@/lib/validations";
import { checkApiAuth } from '@/lib/api-auth';

// SystemSetting is a key-value store model.

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    // SystemSetting is a key-value store; preferences are stored under a special key.
    // Find the preferences record by key.
    const prefs = await db.systemSetting.findUnique({
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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();

    // Validate with Zod schema
    const parsed = validateBody(updatePreferencesSchema, body);
    if (parsed instanceof Response) {
      return parsed;
    }

    const valueJson = JSON.stringify(parsed);

    // Use upsert to prevent race condition on concurrent writes
    const result = await db.systemSetting.upsert({
      where: { key: 'user_preferences' },
      update: { value: valueJson },
      create: {
        key: 'user_preferences',
        value: valueJson,
      },
    });

    return apiSuccess(result);
  } catch {
    return apiError("Failed to update preferences");
  }
}
