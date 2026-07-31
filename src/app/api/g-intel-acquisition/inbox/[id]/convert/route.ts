import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { convertApprovedItem } from '@/lib/intelligence-sources/human-intelligence';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Convert API

   POST /api/g-intel-acquisition/inbox/[id]/convert
   Response: { success, data: { inboxItem, intelligenceObject }, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await convertApprovedItem(id);

    return apiSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to convert inbox item';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}
