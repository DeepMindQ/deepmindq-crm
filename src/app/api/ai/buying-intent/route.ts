import { NextRequest, NextResponse } from 'next/server';
import { scoreBuyingIntent } from '@/lib/scoring/buying-intent-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const result = await scoreBuyingIntent(companyId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[buying-intent] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to score buying intent' }, { status: 500 });
  }
}
