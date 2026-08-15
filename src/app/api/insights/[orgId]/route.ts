import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import { getInsightsForOrganization } from '@/lib/intelligence/reasoning';

/**
 * GET /api/insights/[orgId]
 * Fetch active insights for an organization.
 *
 * Query params:
 *   ?limit=20              — Max insights to return
 *   ?category=opportunity  — Filter by category
 *   ?status=active         — Filter by status
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
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;

    const insights = await getInsightsForOrganization(orgId, {
      limit: isNaN(limit) ? 20 : limit,
      category,
      status,
    });

    return NextResponse.json(apiSuccess(insights, { orgId, count: insights.length }));
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
