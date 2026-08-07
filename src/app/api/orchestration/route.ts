import { NextRequest, NextResponse } from 'next/server';
import { MultiAgentOrchestrator } from '@/lib/multi-agent-orchestrator';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

// POST /api/orchestration — Run full multi-agent orchestration
export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { companyId, triggerType } = body;
    if (!companyId) return apiError('companyId is required', 400);

    const result = await MultiAgentOrchestrator.orchestrate(companyId, triggerType);
    return apiSuccess(result);
  } catch (err) {
    logger.error(`[orchestration] operation failed: ${err instanceof Error ? err.message : err}`);
    return apiError('Internal error', 500);
  }
}

// GET /api/orchestration?companyId=xxx — Get orchestration history
export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

const companyId = new URL(request.url).searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter required', 400);

  try {
    const history = await MultiAgentOrchestrator.getHistory(companyId);
    return apiSuccess(history);
  } catch (err) {
    logger.error(`[orchestration] operation failed: ${err instanceof Error ? err.message : err}`);
    return apiError('Internal error', 500);
  }
}
