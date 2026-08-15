import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const preferencesSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  role: z.string().max(50).optional(),
  companyName: z.string().max(200).optional(),
  industry: z.string().max(50).optional(),
  signals: z.record(z.string(), z.boolean()).optional(),
});

/**
 * POST /api/onboarding/preferences
 * Saves user onboarding preferences. Updates user name if provided.
 * Stores full preferences as an AuditLog entry for retrieval.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid preferences data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { fullName, role, companyName, industry, signals } = parsed.data;

    // Update user name if provided and different
    if (fullName && session?.id) {
      const existing = await db.user.findUnique({ where: { id: session.id } });
      if (existing && (!existing.name || existing.name === '')) {
        await db.user.update({
          where: { id: session.id },
          data: { name: fullName },
        });
      }
    }

    // Store full preferences as an audit log entry (retrievable later)
    // FIX B15: Create/link Organization for the user's company name
    let linkedOrgId: string | undefined;
    if (session?.id) {
      // Create Organization if company name provided and none exists yet
      if (companyName && companyName.trim()) {
        const trimmedName = companyName.trim();
        const existingOrg = await db.organization.findFirst({
          where: { name: trimmedName },
        });

        if (!existingOrg) {
          const newOrg = await db.organization.create({
            data: {
              name: trimmedName,
              industry: industry || null,
              source: 'manual',
            },
          });
          linkedOrgId = newOrg.id;
          logger.info('[onboarding] Created organization from onboarding', {
            orgId: newOrg.id,
            orgName: trimmedName,
          });
        } else {
          linkedOrgId = existingOrg.id;
          // Update industry if the org has none and user provided one
          if (industry && !existingOrg.industry) {
            await db.organization.update({
              where: { id: existingOrg.id },
              data: { industry },
            });
          }
        }
      }

      await db.auditLog.create({
        data: {
          userId: session.id,
          action: 'onboarding_completed',
          resource: 'user_preferences',
          details: JSON.stringify({
            fullName,
            role,
            companyName,
            industry,
            signals,
            organizationId: linkedOrgId,
            completedAt: new Date().toISOString(),
          }),
        },
      });
    }

    logger.info('[onboarding] Preferences saved', { userId: session?.id });

    return NextResponse.json({ success: true, message: 'Preferences saved' });
  } catch (error) {
    logger.error('[onboarding] Error saving preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}

/**
 * GET /api/onboarding/preferences
 * Returns whether onboarding is completed by checking audit logs.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    if (!session?.id) {
      return NextResponse.json({ completed: false });
    }

    const entry = await db.auditLog.findFirst({
      where: {
        userId: session.id,
        action: 'onboarding_completed',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (entry && entry.details) {
      const prefs = JSON.parse(entry.details);
      return NextResponse.json({ completed: true, preferences: prefs });
    }

    return NextResponse.json({ completed: false });
  } catch (error) {
    logger.error('[onboarding] Error fetching preferences', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}
