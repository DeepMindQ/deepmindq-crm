import { NextRequest, NextResponse } from 'next/server';
import { scoreOpportunity, scoreAllOpportunities } from '@/lib/scoring/opportunity-probability-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { opportunityId, scoreAll } = body;

    if (scoreAll) {
      const results = await scoreAllOpportunities();
      return NextResponse.json({ opportunities: results });
    }

    if (opportunityId) {
      const result = await scoreOpportunity(opportunityId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Provide opportunityId or scoreAll: true' }, { status: 400 });
  } catch (error) {
    logger.error('[score-opportunities] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to score opportunities' }, { status: 500 });
  }
}
