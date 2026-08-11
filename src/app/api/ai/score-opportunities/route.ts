import { NextRequest, NextResponse } from 'next/server';
import { scoreOpportunity, scoreAllOpportunities } from '@/lib/scoring/opportunity-probability-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { validateRequest } from '@/lib/with-validation';
import { genericBodySchema } from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const validated = await validateRequest(request, genericBodySchema);
    if (validated instanceof Response) return validated;
    const body = validated.data as { opportunityId?: string; scoreAll?: boolean };
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
