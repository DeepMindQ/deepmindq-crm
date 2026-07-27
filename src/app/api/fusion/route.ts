import { NextRequest, NextResponse } from 'next/server';
import { FusionEngine } from '@/lib/fusion-engine';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// POST /api/fusion — Fuse external + internal intelligence for a company
// External Intelligence (signals, evidence) × Internal Intelligence (capabilities, case studies)
// = Opportunity Intelligence (what to sell, who to target, what to say)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, signalIds, capabilityIds } = body;
    if (!companyId) return apiError('companyId is required', 400);

    const result = await FusionEngine.fuse({
      companyId,
      signalIds,
      capabilityIds,
    });
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

// GET /api/fusion?companyId=xxx — Get fusion results for a company
export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    const results = await FusionEngine.getFusions(companyId);
    return apiSuccess({ companyId, fusions: results, totalFusions: results.length });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
