/**
 * POST /api/engines/actions
 *
 * Action Engine API — generates recommended next actions for an account.
 *
 * Input (POST body):
 *   { companyId: string, contactId?: string, opportunityId?: string, skipNarrative?: boolean }
 *
 * Output:
 *   { result: ActionResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ActionEngine } from '@/lib/engines/action-engine';
import { getCurrentSession, requireAuth } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const session = await getCurrentSession();
    const body = await req.json();
    const { companyId, contactId, opportunityId, skipNarrative } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    logger.info(`[api/engines/actions] recommending for ${companyId} by user ${session?.id ?? 'unknown'}`);
    const result = await ActionEngine.recommend({
      companyId,
      contactId,
      opportunityId,
      skipNarrative,
    });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error(`[api/engines/actions] error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
