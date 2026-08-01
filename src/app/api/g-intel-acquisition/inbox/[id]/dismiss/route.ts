import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { dismissInboxItem } from '@/lib/intelligence-sources/human-intelligence';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Dismiss API

   POST /api/g-intel-acquisition/inbox/[id]/dismiss
   Body: { reviewerId: string }
   Response: { success, data: HumanIntelligenceInbox, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;
    const body = await request.json();
    const { reviewerId } = body;

    if (!reviewerId || typeof reviewerId !== 'string') {
      return apiError('Missing or invalid "reviewerId".', 400);
    }

    const updated = await dismissInboxItem(id, reviewerId);

    return apiSuccess(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dismiss inbox item';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}
