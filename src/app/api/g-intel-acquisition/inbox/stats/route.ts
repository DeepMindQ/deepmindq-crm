import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { getInboxStats } from '@/lib/intelligence-sources/human-intelligence';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Stats API

   GET /api/g-intel-acquisition/inbox/stats
   Response: { success, data: InboxStats, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const stats = await getInboxStats();
    return apiSuccess(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inbox stats';
    return apiError(message, 500);
  }
}
