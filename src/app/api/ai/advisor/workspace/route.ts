/**
 * POST /api/ai/advisor/workspace
 *
 * Persist advisor workspace state for a conversation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.conversationId || typeof body.conversationId !== 'string') {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 },
      );
    }

    if (!body.workspace || typeof body.workspace !== 'object') {
      return NextResponse.json(
        { error: 'workspace is required' },
        { status: 400 },
      );
    }

    await advisorConversationApi.saveWorkspace({
      conversationId: body.conversationId,
      workspace: body.workspace,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('advisor:workspace:save-failed', { error: String(error) });
    return NextResponse.json(
      { error: 'Failed to save workspace' },
      { status: 500 },
    );
  }
}
