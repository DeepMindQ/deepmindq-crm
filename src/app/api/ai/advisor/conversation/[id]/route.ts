/**
 * GET /api/ai/advisor/conversation/[id]
 *
 * Retrieve a full conversation with all messages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const conversation = await advisorConversationApi.getConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('advisor:conversation:get-failed', { id, error: String(error) });
    return NextResponse.json(
      { error: 'Failed to retrieve conversation' },
      { status: 500 },
    );
  }
}
