import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { getFreshnessStatus, getCompaniesNeedingRefresh, batchUpdateFreshness } from '@/lib/intelligence-sources/freshness-manager'

// GET /api/intelligence/refresh — Get freshness status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const batch = searchParams.get('batch')

    if (companyId) {
      const status = await getFreshnessStatus(companyId)
      if (!status) return apiError('Company not found', 404)
      return apiSuccess(status)
    }

    if (batch === 'true') {
      const needingRefresh = await getCompaniesNeedingRefresh()
      return apiSuccess({ companies: needingRefresh, count: needingRefresh.length })
    }

    return apiError('Provide companyId or batch=true', 400)
  } catch (err) {
    console.error('[api/intelligence/refresh] Error:', err)
    return apiError('Freshness check failed')
  }
}

// POST /api/intelligence/refresh — Trigger intelligence refresh
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId, batchUpdate } = body

    if (batchUpdate) {
      const updated = await batchUpdateFreshness()
      return apiSuccess({ updated })
    }

    if (companyId) {
      const { updateFreshnessAfterCollection } = await import('@/lib/intelligence-sources/freshness-manager')
      await updateFreshnessAfterCollection(companyId)
      const status = await getFreshnessStatus(companyId)
      return apiSuccess(status)
    }

    return apiError('Provide companyId or batchUpdate: true', 400)
  } catch (err) {
    console.error('[api/intelligence/refresh] Error:', err)
    return apiError('Intelligence refresh failed')
  }
}
