import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { runScheduledReasoning } from '@/lib/intelligence/reasoning';

/**
 * POST /api/reasoning/scheduled
 * Trigger scheduled reasoning for all orgs that haven't been reasoned about recently.
 * Designed to be called from a cron job.
 */
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const result = await runScheduledReasoning();
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
