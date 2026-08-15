import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess } from '@/lib/apiHelpers';
import {
  reasonAboutOrganization,
  storeInsights,
  runIntelligencePipeline,
} from '@/lib/intelligence/reasoning';

/**
 * POST /api/reasoning/[orgId]
 * Trigger AI reasoning for a specific organization.
 *
 * Query params:
 *   ?mode=pipeline  — Run full pipeline (signal → reasoning → briefing → scores)
 *   ?mode=reason    — Run reasoning only (default)
 */
export async function POST(
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
    const mode = searchParams.get('mode') || 'reason';

    if (mode === 'pipeline') {
      const result = await runIntelligencePipeline(orgId);
      return NextResponse.json(apiSuccess(result, { mode: 'pipeline', orgId }));
    }

    // Default: reasoning only
    const insights = await reasonAboutOrganization(orgId);
    const stored = await storeInsights(orgId, insights);

    return NextResponse.json(
      apiSuccess(
        {
          insightsGenerated: stored,
          insights: insights.map((r) => r.insight),
        },
        { mode: 'reason', orgId },
      ),
    );
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg, correlationId }, { status: 500 });
  }
}
