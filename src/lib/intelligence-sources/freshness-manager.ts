/**
 * Phase 9: Intelligence Freshness Manager
 *
 * Tracks and manages intelligence freshness for every company.
 * Provides user-facing staleness indicators and manages refresh cycles.
 */

import { db } from '@/lib/db'

export interface FreshnessStatus {
  companyId: string
  companyName: string
  degradationLevel: 'fresh' | 'aging' | 'stale' | 'critical'
  freshnessScore: number
  lastRefreshAt: Date | null
  signalCount: number
  evidenceCount: number
  daysSinceRefresh: number | null
  nextRefreshAt: Date | null
}

const FRESHNESS_THRESHOLDS = {
  fresh: 0.7,    // < 3 days old
  aging: 0.4,    // 3-7 days old
  stale: 0.2,    // 7-14 days old
  critical: 0,   // > 14 days old
}

/**
 * Get freshness status for a single company
 */
export async function getFreshnessStatus(companyId: string): Promise<FreshnessStatus | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  })
  if (!company) return null

  const freshness = await db.companyIntelligenceFreshness.findUnique({
    where: { companyId },
  })

  const signalCount = await db.signal.count({ where: { companyId, status: 'active' } })
  const evidenceCount = await db.evidence.count({ where: { companyId, status: { in: ['active', 'aging'] } } })

  const lastRefresh = freshness?.lastRefreshAt || null
  const daysSince = lastRefresh ? Math.floor((Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24)) : null

  const score = freshness?.freshnessScore ?? 0
  let degradationLevel: 'fresh' | 'aging' | 'stale' | 'critical' = 'critical'
  if (score >= FRESHNESS_THRESHOLDS.fresh) degradationLevel = 'fresh'
  else if (score >= FRESHNESS_THRESHOLDS.aging) degradationLevel = 'aging'
  else if (score >= FRESHNESS_THRESHOLDS.stale) degradationLevel = 'stale'

  return {
    companyId,
    companyName: company.name,
    degradationLevel,
    freshnessScore: score,
    lastRefreshAt: lastRefresh,
    signalCount,
    evidenceCount,
    daysSinceRefresh: daysSince,
    nextRefreshAt: freshness?.nextRefreshAt || null,
  }
}

/**
 * Update freshness after intelligence collection
 */
export async function updateFreshnessAfterCollection(companyId: string): Promise<void> {
  const signalCount = await db.signal.count({ where: { companyId, status: 'active' } })
  const evidenceCount = await db.evidence.count({ where: { companyId, status: { in: ['active', 'aging'] } } })

  // Get most recent signal
  const latestSignal = await db.signal.findFirst({
    where: { companyId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })

  const lastRefreshAt = latestSignal?.createdAt || new Date()
  const daysSince = (Date.now() - lastRefreshAt.getTime()) / (1000 * 60 * 60 * 24)

  // Calculate freshness score: 1.0 when just refreshed, decays over 14 days
  const freshnessScore = Math.max(0, 1 - (daysSince / 14))

  let degradationLevel = 'critical'
  if (freshnessScore >= 0.7) degradationLevel = 'fresh'
  else if (freshnessScore >= 0.4) degradationLevel = 'aging'
  else if (freshnessScore >= 0.2) degradationLevel = 'stale'

  // Schedule next refresh based on degradation
  let nextRefreshAt: Date | null = null
  if (degradationLevel === 'fresh') nextRefreshAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  else if (degradationLevel === 'aging') nextRefreshAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  else nextRefreshAt = new Date() // Refresh immediately if stale

  await db.companyIntelligenceFreshness.upsert({
    where: { companyId },
    create: {
      companyId,
      lastRefreshAt,
      lastSignalCount: signalCount,
      lastEvidenceCount: evidenceCount,
      freshnessScore,
      degradationLevel,
      nextRefreshAt,
    },
    update: {
      lastRefreshAt,
      lastSignalCount: signalCount,
      lastEvidenceCount: evidenceCount,
      freshnessScore,
      degradationLevel,
      nextRefreshAt,
    },
  })
}

/**
 * Get all companies needing refresh
 */
export async function getCompaniesNeedingRefresh(): Promise<FreshnessStatus[]> {
  const staleRecords = await db.companyIntelligenceFreshness.findMany({
    where: {
      OR: [
        { degradationLevel: { in: ['stale', 'critical'] } },
        { nextRefreshAt: { lte: new Date() } },
      ],
    },
    select: { companyId: true },
    take: 20,
  })

  const results: FreshnessStatus[] = []
  for (const record of staleRecords) {
    const status = await getFreshnessStatus(record.companyId)
    if (status) results.push(status)
  }
  return results
}

/**
 * Batch update freshness scores (cron job)
 */
export async function batchUpdateFreshness(): Promise<number> {
  const allCompanies = await db.company.findMany({
    select: { id: true },
    take: 100,
  })

  let updated = 0
  for (const company of allCompanies) {
    try {
      await updateFreshnessAfterCollection(company.id)
      updated++
    } catch {
      // Skip on error
    }
  }
  return updated
}
