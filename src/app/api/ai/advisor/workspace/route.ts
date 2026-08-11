/**
 * POST /api/ai/advisor/workspace
 *
 * Persist advisor workspace state for a conversation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { validateBody } from '@/lib/apiHelpers';
import { advisorConversationApi } from '@/lib/advisor/advisor-persistence';
import { aiAdvisorWorkspaceSaveSchema } from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  // ── Auth guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const rawBody = await request.json();
    const parsed = validateBody(aiAdvisorWorkspaceSaveSchema, rawBody);
    if (parsed instanceof Response) return parsed;
    const { conversationId, workspace } = parsed;

    await advisorConversationApi.saveWorkspace({
      conversationId,
      workspace: workspace as unknown as Parameters<typeof advisorConversationApi.saveWorkspace>[0]['workspace'],
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
