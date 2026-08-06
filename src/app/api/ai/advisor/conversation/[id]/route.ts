/**
 * GET /api/ai/advisor/conversation/[id]
 *
 * Retrieve a full conversation with all messages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Auth guard ──
  const { session, errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const conversation = await advisorConversationApi.getConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    // ── User isolation: reject if conversation belongs to another user ──
    if (conversation.userId && conversation.userId !== session!.id) {
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
