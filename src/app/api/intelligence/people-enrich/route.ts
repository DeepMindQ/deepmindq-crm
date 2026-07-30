/**
 * POST /api/intelligence/people-enrich — Enrich contact profiles
 *
 * Intelligence API — External Intelligence Endpoint
 *
 * Accepts a contactId or companyId to enrich profiles using
 * web search + governedAICall for people enrichment.
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { enrichContactProfile, enrichCompanyContacts } from '@/lib/intelligence-sources/people-enrichment/engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

const peopleEnrichBodySchema = z.object({
  contactId: z.string().min(1).optional(),
  companyId: companyIdSchema.optional(),
}).refine(d => d.contactId || d.companyId, {
  message: 'Provide contactId or companyId',
});

export async function POST(req: NextRequest) {
  let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(req, 'people-enrich');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const parsed = peopleEnrichBodySchema.safeParse(body);
    if (!parsed.success) {
      return utilityError(ctx, 400, `Validation failed: ${parsed.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { contactId, companyId } = parsed.data;

    if (contactId) {
      logger.info('[intelligence/people-enrich] Enriching contact', { contactId });
      const result = await enrichContactProfile(contactId);
      return utilitySuccess(ctx, result, 'people-enrich', Date.now() - startedAt);
    }

    if (companyId) {
      logger.info('[intelligence/people-enrich] Enriching company contacts', { companyId });
      const results = await enrichCompanyContacts(companyId);
      return utilitySuccess(ctx, { results, count: results.length }, 'people-enrich', Date.now() - startedAt);
    }

    // Unreachable — refine guarantees contactId or companyId is present
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'People enrichment failed', Date.now() - startedAt);
  }
}
