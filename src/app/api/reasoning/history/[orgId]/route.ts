import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { getReasoningHistory } from '@/lib/intelligence/reasoning';

/**
 * GET /api/reasoning/history/[orgId]
 * Get reasoning history (memory) for a specific organization.
 *
 * Query params:
 *   ?limit=20 — Max history entries to return
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { orgId } = await params;
    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json({ success: false, error: 'orgId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const history = await getReasoningHistory(orgId, {
      limit: isNaN(limit) ? 20 : limit,
    });

    return NextResponse.json(apiSuccess(history, { orgId, count: history.length }));
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
