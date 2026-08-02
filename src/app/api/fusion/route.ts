import { NextRequest, NextResponse } from 'next/server';
import { FusionEngine } from '@/lib/fusion-engine';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

// POST /api/fusion — Fuse external + internal intelligence for a company
// External Intelligence (signals, evidence) × Internal Intelligence (capabilities, case studies)
// = Opportunity Intelligence (what to sell, who to target, what to say)
export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

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
    logger.error(`[fusion] operation failed: ${err instanceof Error ? err.message : err}`);
    return apiError('Internal error', 500);
  }
}

// GET /api/fusion?companyId=xxx — Get fusion results for a company
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    const results = await FusionEngine.getFusions(companyId);
    return apiSuccess({ companyId, fusions: results, totalFusions: results.length });
  } catch (err) {
    logger.error(`[fusion/trigger] operation failed: ${err instanceof Error ? err.message : err}`);
    return apiError('Internal error', 500);
  }
}
