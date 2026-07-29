// @ts-nocheck — References Prisma models/enums not in current schema. Remove after DB migration.
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger';

// GET /api/intelligence/action-history — Get action history for a company
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const actionType = searchParams.get('actionType')
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!companyId) return apiError('companyId required', 400)

    const where: any = { companyId }
    if (actionType) where.actionType = actionType

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
    })

    const grouped = new Map<string, typeof history>()
    for (const entry of history) {
      const key = entry.actionType
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(entry)
    }

    return apiSuccess({
      total: history.length,
      history,
      byType: Object.fromEntries(grouped),
    })
  } catch (err) {
    logger.error('[api/action-history] Error:', { error: err })
    return apiError('Failed to fetch action history')
  }
}
