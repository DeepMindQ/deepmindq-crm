import { NextRequest, NextResponse } from 'next/server';
import { IntelligenceFusionEngine } from '@/lib/intelligence-fusion-engine';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// POST /api/fusion — Fuse external + internal intelligence for a company
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;
    if (!companyId) return apiError('companyId is required', 400);

    const result = await IntelligenceFusionEngine.fuse(companyId);
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

// GET /api/fusion?companyId=xxx — Get fusion status
export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    const status = await IntelligenceFusionEngine.getStatus(companyId);
    return apiSuccess(status);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
