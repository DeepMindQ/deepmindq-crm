import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { batchDismissInboxItems } from '@/lib/intelligence-sources/human-intelligence';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox Batch Dismiss API

   POST /api/g-intel-acquisition/inbox/batch-dismiss
   Body: { ids: string[], reviewerId: string }
   Response: { success, data: { dismissed, failed, errors }, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { ids, reviewerId } = body;

    if (!reviewerId || typeof reviewerId !== 'string') {
      return apiError('Missing or invalid "reviewerId". Must be a non-empty string.', 400);
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError('Missing or empty "ids". Must be a non-empty array of inbox item ids.', 400);
    }
    if (ids.length > 100) {
      return apiError('Batch dismiss limited to 100 items per request.', 400);
    }

    const result = await batchDismissInboxItems(ids, reviewerId);

    return apiSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to batch dismiss inbox items';
    return apiError(message, 500);
  }
}
