import { NextRequest, NextResponse } from 'next/server';
import { EnterpriseReasoningEngine } from '@/lib/enterprise-reasoning-engine';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';

// POST /api/reasoning — Build reasoning context for a company
export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { companyId } = body;
    if (!companyId) return apiError('companyId is required', 400);

    const result = await EnterpriseReasoningEngine.build(companyId);
    return apiSuccess(result);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}

// GET /api/reasoning?companyId=xxx — Get reasoning context
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    const context = await EnterpriseReasoningEngine.getContext(companyId);
    if (!context) return apiSuccess({ exists: false });
    return apiSuccess(context);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 500);
  }
}
