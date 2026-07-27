/**
 * POST /api/engines/conversation
 *
 * Conversation Engine API — generates evidence-backed meeting briefings.
 *
 * Input (POST body):
 *   { companyId: string, contactId?: string, opportunityId?: string, briefingType?: string, skipNarrative?: boolean }
 *
 * Output:
 *   { briefing: ConversationResult }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationEngine } from '@/lib/engines/conversation-engine';
import type { BriefingType } from '@/lib/engines/conversation-engine';
import { getCurrentSession, requireAuth } from '@/lib/session';
import { logger } from '@/lib/logger';

const VALID_BRIEFING_TYPES: BriefingType[] = [
  'meeting_prep', 'executive_brief', 'conversation_plan', 'outreach_prepare',
];

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const session = await getCurrentSession();
    const body = await req.json();
    const { companyId, contactId, opportunityId, briefingType, skipNarrative } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    if (briefingType && !VALID_BRIEFING_TYPES.includes(briefingType)) {
      return NextResponse.json({
        error: `Invalid briefingType. Use: ${VALID_BRIEFING_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    logger.info(`[api/engines/conversation] briefing for ${companyId} type=${briefingType || 'meeting_prep'} by user ${session?.id ?? 'unknown'}`);
    const result = await ConversationEngine.brief({
      companyId,
      contactId,
      opportunityId,
      briefingType: briefingType || 'meeting_prep',
      skipNarrative,
    });

    return NextResponse.json({ briefing: result });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error(`[api/engines/conversation] error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
