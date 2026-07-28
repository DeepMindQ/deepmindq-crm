import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';

// ────────────────────────────────────────────────────────────────────────
// POST /api/intelligence/enrich
//
// Enrich a single company with AI intelligence:
// Web search → Signal extraction → Evidence → Research Card
// ────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json();

    if (!companyId || typeof companyId !== 'string') {
      return apiError('companyId is required', 400);
    }

    const result = await IntelligencePipeline.enrichCompany(companyId);

    if (!result.success) {
      return apiSuccess({
        ...result,
        enriched: false,
      });
    }

    return apiSuccess({
      ...result,
      enriched: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Enrichment failed';
    console.error('[intelligence/enrich]', msg);
    return apiError(msg);
  }
}
