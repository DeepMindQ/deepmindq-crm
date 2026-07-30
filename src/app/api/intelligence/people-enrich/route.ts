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
import { enrichContactProfile, enrichCompanyContacts } from '@/lib/intelligence-sources/people-enrichment/engine';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(req: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(req, 'people-enrich');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await req.json();
    const { contactId, companyId } = body;

    if (contactId) {
      logger.info('[intelligence/people-enrich] Enriching contact', { contactId });
      const result = await enrichContactProfile(contactId);
      return Response.json({
        success: true,
        data: result,
        meta: { endpoint: 'people-enrich', durationMs: Date.now() - startedAt },
      });
    }

    if (companyId) {
      logger.info('[intelligence/people-enrich] Enriching company contacts', { companyId });
      const results = await enrichCompanyContacts(companyId);
      return Response.json({
        success: true,
        data: { results, count: results.length },
        meta: { endpoint: 'people-enrich', durationMs: Date.now() - startedAt },
      });
    }

    return Response.json(
      { success: false, error: 'Provide contactId or companyId', meta: { endpoint: 'people-enrich', durationMs: Date.now() - startedAt } },
      { status: 400 },
    );
  } catch (err) {
    const message = scrubError(err instanceof Error ? err.message : String(err));
    logger.error('[intelligence/people-enrich] Error', { error: message });
    return Response.json(
      { success: false, error: 'People enrichment failed', details: message, meta: { endpoint: 'people-enrich', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
