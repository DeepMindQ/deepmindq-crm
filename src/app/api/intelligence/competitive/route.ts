import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { collectCompetitiveIntel, runCompetitiveScan } from '@/lib/intelligence-sources/competitive-intel/engine'
import { logger } from '@/lib/logger';

// POST /api/intelligence/competitive — Collect competitive intelligence
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { competitorName, fullScan } = body

    if (fullScan) {
      const results = await runCompetitiveScan()
      return apiSuccess({ events: results, totalEvents: results.length })
    }

    if (competitorName) {
      const results = await collectCompetitiveIntel(competitorName)
      return apiSuccess({ events: results, totalEvents: results.length })
    }

    return apiError('Provide competitorName or fullScan: true', 400)
  } catch (err) {
    logger.error('[api/competitive] Error:', { error: err })
    return apiError('Competitive intelligence collection failed')
  }
}
