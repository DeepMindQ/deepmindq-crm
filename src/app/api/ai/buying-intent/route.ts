import { NextRequest, NextResponse } from 'next/server';
import { scoreBuyingIntent } from '@/lib/scoring/buying-intent-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { validateBody } from '@/lib/apiHelpers';
import { aiBuyingIntentSchema } from '@/lib/validation-schemas';
import { withApiLogging } from '@/lib/api-logging-middleware';

async function postHandler(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const rawBody = await request.json();
    const parsed = validateBody(aiBuyingIntentSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { companyId } = parsed;

    const result = await scoreBuyingIntent(companyId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[buying-intent] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to score buying intent' }, { status: 500 });
  }
}

export const POST = withApiLogging(postHandler, '/api/ai/buying-intent');
