import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { reviewInboxItem } from '@/lib/intelligence-sources/human-intelligence';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Review API

   POST /api/g-intel-acquisition/inbox/[id]/review
   Body: { action: 'approve' | 'reject', reviewerId: string, notes?: string }
   Response: { success, data: HumanIntelligenceInbox, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reviewerId, notes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return apiError('Missing or invalid "action". Must be "approve" or "reject".', 400);
    }
    if (!reviewerId || typeof reviewerId !== 'string') {
      return apiError('Missing or invalid "reviewerId".', 400);
    }

    const updated = await reviewInboxItem(
      id,
      action as 'approve' | 'reject',
      reviewerId,
      notes,
    );

    return apiSuccess(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to review inbox item';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}
