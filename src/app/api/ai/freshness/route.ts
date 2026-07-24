/**
 * POST /api/ai/freshness — Run freshness scan and return results
 * GET  /api/ai/freshness — Get freshness statistics
 *
 * Wave 8B: Signal lifecycle management endpoint.
 */

import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { runFreshnessScan, getFreshnessStats } from '@/lib/intelligence-sources/freshness-decay'

export async function POST() {
  try {
    const result = await runFreshnessScan()
    return apiSuccess({ scanCompleted: true, timestamp: new Date().toISOString(), ...result })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Freshness scan failed', 500)
  }
}

export async function GET() {
  try {
    const stats = await getFreshnessStats()
    return apiSuccess({ timestamp: new Date().toISOString(), ...stats })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to get freshness stats', 500)
  }
}
