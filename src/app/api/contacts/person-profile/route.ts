/**
 * Person Intelligence Profile API (Wave 5.1)
 *
 * GET /api/contacts/person-profile?contactId=xxx — Single contact profile
 * GET /api/contacts/person-profile?companyId=xxx — All contacts for company
 * POST /api/contacts/person-profile — Trigger profile generation
 *
 * Returns the full Person Intelligence Profile with evidence-backed scores,
 * detected priorities, engagement predictions, and recommended conversations.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { buildPersonProfile, buildCompanyPersonProfiles } from '@/lib/person-intelligence-engine';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (contactId) {
      const profile = await buildPersonProfile(contactId);
      return apiSuccess({ profile });
    }

    if (companyId) {
      const profiles = await buildCompanyPersonProfiles(companyId, limit);
      return apiSuccess({
        profiles,
        total: profiles.length,
        summary: {
          critical: profiles.filter(p => p.priorityTier === 'critical').length,
          high: profiles.filter(p => p.priorityTier === 'high').length,
          medium: profiles.filter(p => p.priorityTier === 'medium').length,
          low: profiles.filter(p => p.priorityTier === 'low').length,
          nurture: profiles.filter(p => p.priorityTier === 'nurture').length,
          avgScore: profiles.length > 0 ? Math.round(profiles.reduce((s, p) => s + p.personScore, 0) / profiles.length) : 0,
        },
      });
    }

    return apiError('Provide contactId or companyId', 400);
  } catch (error) {
    logger.error('[contacts/person-profile] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, error instanceof Error && message.includes('not found') ? 404 : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, companyId } = body;

    if (contactId) {
      const profile = await buildPersonProfile(contactId);
      return apiSuccess({ profile, message: `Profile generated for contact ${profile.name}` });
    }

    if (companyId) {
      const profiles = await buildCompanyPersonProfiles(companyId);
      return apiSuccess({
        profiles,
        total: profiles.length,
        message: `Generated ${profiles.length} person profiles`,
      });
    }

    return apiError('Provide contactId or companyId', 400);
  } catch (error) {
    logger.error('[contacts/person-profile] POST Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, 500);
  }
}
