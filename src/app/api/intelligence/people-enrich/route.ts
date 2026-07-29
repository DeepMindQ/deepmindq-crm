import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { enrichContactProfile, enrichCompanyContacts } from '@/lib/intelligence-sources/people-enrichment/engine'
import { logger } from '@/lib/logger';

// POST /api/intelligence/people-enrich — Enrich contact profiles
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactId, companyId } = body

    if (contactId) {
      const result = await enrichContactProfile(contactId)
      return apiSuccess(result)
    }

    if (companyId) {
      const results = await enrichCompanyContacts(companyId)
      return apiSuccess({ results, count: results.length })
    }

    return apiError('Provide contactId or companyId', 400)
  } catch (err) {
    logger.error('[api/people-enrich] Error:', { error: err })
    return apiError('People enrichment failed')
  }
}
