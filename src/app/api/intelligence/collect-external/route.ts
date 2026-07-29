/**
 * POST /api/intelligence/collect-external
 *
 * Phase 2A: External Intelligence Collection trigger endpoint.
 *
 * Accepts a companyId (or array of companyIds) and runs the external
 * intelligence collection pipeline. Returns collection results with counts.
 *
 * No UI changes required — this is a backend-only pipeline.
 *
 * This replaces the deprecated /api/intelligence/collect-news endpoint.
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
    logger.error('[collect-external] Error:', { error: error });
    return NextResponse.json(
      { error: 'Intelligence collection failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
