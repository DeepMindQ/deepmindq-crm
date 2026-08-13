import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { getGraphStats, computeIntelligenceScores } from '@/lib/intelligence/knowledge-graph';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

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
