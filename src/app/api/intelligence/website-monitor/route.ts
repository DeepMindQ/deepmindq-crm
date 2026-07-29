import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { monitorCompanyWebsite } from '@/lib/intelligence-sources/website-monitor/engine'
import { logger } from '@/lib/logger';

// POST /api/intelligence/website-monitor — Detect website changes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId } = body

    if (!companyId) return apiError('companyId required', 400)

    const results = await monitorCompanyWebsite(companyId)
    const changesDetected = results.filter(r => r.hasChanged)
    
    return apiSuccess({
      pagesMonitored: results.length,
      changesDetected: changesDetected.length,
      results,
    })
  } catch (err) {
    logger.error('[api/website-monitor] Error:', { error: err })
    return apiError('Website monitoring failed')
  }
}
