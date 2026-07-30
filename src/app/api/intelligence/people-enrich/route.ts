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

export async function POST(req: NextRequest) {
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
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/people-enrich] Error', { error: message });
    return Response.json(
      { success: false, error: 'People enrichment failed', details: message, meta: { endpoint: 'people-enrich', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
