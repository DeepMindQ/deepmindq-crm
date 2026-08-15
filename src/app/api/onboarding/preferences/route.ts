import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const preferencesSchema = z.object({
  fullName: z.string().optional(),
  role: z.string().optional(),
  company: z.string().optional(),
  industry: z.string().optional(),
  signals: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid preferences data' }, { status: 400 });
    }

    const prefs = parsed.data;

    // Update user name if provided
    if (prefs.fullName && session?.id) {
      await db.user.update({
        where: { id: session.id },
        data: { name: prefs.fullName },
      });
    }

    // Store preferences in AuditLog as JSON
    await db.auditLog.create({
      data: {
        action: 'onboarding_preferences_saved',
        resource: 'User',
        details: JSON.stringify(prefs),
        userId: session?.id ?? null,
      },
    });

    logger.info('[Onboarding] Preferences saved', { userId: session?.id });

    return NextResponse.json({ success: true, message: 'Preferences saved successfully' });
  } catch (error) {
    logger.error('[Onboarding] Error saving preferences:', { error });
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
