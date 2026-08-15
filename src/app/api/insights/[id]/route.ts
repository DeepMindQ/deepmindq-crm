import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { apiSuccess } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/insights/[id]
 * Accept or dismiss an insight/recommendation.
 * Persists the action to the database with timestamp and reason.
 *
 * Q7/Q8 FIX: Recommendation acceptance/dismissal now persisted to DB
 *
 * Body: { action: 'accept' | 'dismiss', reason?: string }
 */
const insightPatchSchema = z.object({
  action: z.enum(['accept', 'dismiss']),
  reason: z.string().optional(),
});

async function _patchHandler(request: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const pathParts = request.url.split('/');
  const id = pathParts[pathParts.length - 1];
  const body = await request.json();
  const parsed = insightPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action, reason } = parsed.data;

  // Verify insight exists
  const insight = await db.insight.findUnique({ where: { id } });
  if (!insight) {
    return NextResponse.json({ success: false, error: 'Insight not found' }, { status: 404 });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'dismissed';

  const updated = await db.insight.update({
    where: { id },
    data: {
      status: newStatus,
      dismissedReason:
        reason ||
        (action === 'accept'
          ? `Accepted by ${session?.id || 'user'}`
          : `Dismissed by ${session?.id || 'user'}`),
    },
  });

  logger.info(`[INSIGHT] ${action}d`, {
    insightId: id,
    action,
    userId: session?.id,
    reason,
  });

  return apiSuccess({
    id: updated.id,
    status: updated.status,
    action,
  });
}

export { _patchHandler as PATCH };
