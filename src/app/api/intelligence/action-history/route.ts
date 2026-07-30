/**
 * GET /api/intelligence/action-history — Get action history for a company
 *
 * Intelligence API — History Endpoint
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const actionType = searchParams.get('actionType');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!companyId) {
      return Response.json(
        { success: false, error: 'companyId required', meta: { endpoint: 'action-history', durationMs: Date.now() - startedAt } },
        { status: 400 },
      );
    }

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

    return Response.json({
      success: true,
      data: { total: history.length, history, byType: Object.fromEntries(grouped) },
      meta: { endpoint: 'action-history', durationMs: Date.now() - startedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[intelligence/action-history] Error', { error: message });
    return Response.json(
      { success: false, error: 'Failed to fetch action history', details: message, meta: { endpoint: 'action-history', durationMs: Date.now() - startedAt } },
      { status: 502 },
    );
  }
}
