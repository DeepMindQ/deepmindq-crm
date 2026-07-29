/**
 * POST /api/intelligence/collect-news
 *
 * ⚠️ DEPRECATED — Use /api/intelligence/collect-external instead.
 *
 * This endpoint is preserved for backward compatibility during the
 * Phase 2A transition. It delegates to the renamed collector module.
 */

import { NextResponse } from 'next/server';
import { collectIntelligenceForCompany, collectIntelligenceBatch } from '@/lib/intelligence-sources/external-intelligence-collector';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, companyIds, maxResultsPerQuery = 5 } = body;

    if (!companyId && (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0)) {
      return NextResponse.json(
        { error: 'Provide "companyId" (string) or "companyIds" (array of strings)' },
        { status: 400 }
      );
    }

    // Single company
    if (companyId) {
      const result = await collectIntelligenceForCompany(companyId, maxResultsPerQuery);
      return NextResponse.json({ result });
    }

    // Batch
    const results = await collectIntelligenceBatch(companyIds, maxResultsPerQuery);
    const summary = {
      totalCompanies: results.length,
      totalEvidenceCollected: results.reduce((s, r) => s + r.evidenceCollected, 0),
      totalSignalsCreated: results.reduce((s, r) => s + r.signalsCreated, 0),
      totalSignalsSkipped: results.reduce((s, r) => s + r.signalsSkipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      totalDuration: results.reduce((s, r) => s + r.duration, 0),
    };

    return NextResponse.json({ results, summary });
  } catch (error) {
    logger.error('[collect-news] DEPRECATED — Use /api/intelligence/collect-external. Error:', { error: error });
    return NextResponse.json(
      { error: 'News collection failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
