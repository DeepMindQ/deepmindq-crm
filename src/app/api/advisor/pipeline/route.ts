import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { runIntelligencePipeline } from '@/lib/intelligence/reasoning';
import { logger } from '@/lib/logger';

const pipelinePostSchema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = pipelinePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { organizationId } = parsed.data;

    logger.info('[PIPELINE] Running intelligence pipeline', { organizationId });

    const result = await runIntelligencePipeline(organizationId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[PIPELINE] Pipeline failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Intelligence pipeline failed' }, { status: 500 });
  }
}
