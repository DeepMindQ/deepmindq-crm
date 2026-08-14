import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { getGraphStats, computeIntelligenceScores } from '@/lib/intelligence/knowledge-graph';

const statsQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = statsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 });
    }
    const refresh = parsed.data.refresh === 'true';

    if (refresh) {
      await computeIntelligenceScores();
    }

    const stats = await getGraphStats();
    return NextResponse.json({ data: stats });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to fetch graph stats' },
      { status: 500 }
    );
  }
}
