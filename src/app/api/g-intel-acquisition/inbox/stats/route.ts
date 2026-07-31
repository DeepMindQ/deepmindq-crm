import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { getInboxStats } from '@/lib/intelligence-sources/human-intelligence';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Stats API

   GET /api/g-intel-acquisition/inbox/stats
   Response: { success, data: InboxStats, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function GET() {
  try {
    const stats = await getInboxStats();
    return apiSuccess(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inbox stats';
    return apiError(message, 500);
  }
}
