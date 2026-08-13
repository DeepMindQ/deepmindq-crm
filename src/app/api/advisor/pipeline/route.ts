import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { runIntelligencePipeline } from '@/lib/intelligence/reasoning';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    logger.info('[PIPELINE] Running intelligence pipeline', { organizationId });

    const result = await runIntelligencePipeline(organizationId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[PIPELINE] Pipeline failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Intelligence pipeline failed' }, { status: 500 });
  }
}
