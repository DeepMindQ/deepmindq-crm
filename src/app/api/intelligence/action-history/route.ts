/**
 * GET /api/intelligence/action-history — Get action history for a company
 *
 * Intelligence API — History Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { companyIdSchema } from '@/lib/intelligence-api/validators';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError, utilityError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';

const actionHistoryQuerySchema = z.object({
  companyId: companyIdSchema,
  actionType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  let ctx: Awaited<ReturnType<typeof utilityGuard>>;
  try {
    ctx = utilityGuard(req, 'action-history');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const queryResult = actionHistoryQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return utilityError(ctx, 400, `Validation failed: ${queryResult.error.issues[0]?.message}`, 'VALIDATION_FAILED', Date.now() - startedAt);
    }
    const { companyId, actionType, limit = 10 } = queryResult.data;

    const where: Record<string, unknown> = { companyId };
    if (actionType) where.actionType = actionType;

    const history = await db.intelligenceActionHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        actionType: true,
        summary: true,
        confidence: true,
        signalCount: true,
        contactCount: true,
        evidenceIds: true,
        supersededAt: true,
        createdAt: true,
      },
    });

    const grouped = new Map<string, typeof history>();
    for (const entry of history) {
      const key = entry.actionType;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(entry);
    }

    return utilitySuccess(ctx, { total: history.length, history, byType: Object.fromEntries(grouped) }, 'action-history', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Failed to fetch action history', Date.now() - startedAt);
  }
}
