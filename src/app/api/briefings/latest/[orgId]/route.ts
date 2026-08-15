import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { getLatestBriefing } from '@/lib/intelligence/reasoning';

/**
 * GET /api/briefings/latest/[orgId]
 * Fetch the latest active briefing for an organization.
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

    const briefing = await getLatestBriefing(orgId);

    if (!briefing) {
      return NextResponse.json(apiSuccess(null, { orgId, message: 'No active briefing found' }));
    }

    return NextResponse.json(apiSuccess(briefing, { orgId }));
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
