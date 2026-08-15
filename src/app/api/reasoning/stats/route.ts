import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { getReasoningStats } from '@/lib/intelligence/reasoning';

/**
 * GET /api/reasoning/stats
 * Get global reasoning engine statistics.
 * Used for monitoring and health dashboards.
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const stats = await getReasoningStats();
    return NextResponse.json(apiSuccess(stats));
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
