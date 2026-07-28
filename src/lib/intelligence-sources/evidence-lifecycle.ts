/**
 * Phase 9: Evidence Lifecycle Manager
 *
 * Manages the lifecycle of evidence records: active → aging → superseded → expired.
 * Prevents stale evidence from polluting confidence scores and intelligence outputs.
 *
 * Runs as a scheduled job (cron) or on-demand.
 */

import { db } from '@/lib/db'

const EVIDENCE_AGING_DAYS = 7     // Mark as 'aging' after 7 days
const EVIDENCE_EXPIRED_DAYS = 30  // Mark as 'expired' after 30 days
const SUPERSEDED_GRACE_DAYS = 30  // Keep superseded evidence for 30 days before expiring

export interface EvidenceLifecycleStats {
  totalProcessed: number
  markedAging: number
  markedSuperseded: number
  markedExpired: number
  cleanedUp: number
}

/**
 * Run evidence lifecycle management across all companies
 */
export async function runEvidenceLifecycle(): Promise<EvidenceLifecycleStats> {
  const stats: EvidenceLifecycleStats = {
    totalProcessed: 0, markedAging: 0, markedSuperseded: 0, markedExpired: 0, cleanedUp: 0,
  }

  const now = new Date()
  const agingThreshold = new Date(now.getTime() - EVIDENCE_AGING_DAYS * 24 * 60 * 60 * 1000)
  const expiredThreshold = new Date(now.getTime() - EVIDENCE_EXPIRED_DAYS * 24 * 60 * 60 * 1000)

  // Mark aging evidence
  const agingResult = await db.evidence.updateMany({
    where: {
      status: 'active',
      createdAt: { lt: agingThreshold },
    },
    data: { status: 'aging' },
  })
  stats.markedAging = agingResult.count
  stats.totalProcessed += agingResult.count

  // Mark expired evidence
  const expiredResult = await db.evidence.updateMany({
    where: {
      status: { in: ['active', 'aging'] },
      createdAt: { lt: expiredThreshold },
    },
    data: { status: 'expired' },
  })
  stats.markedExpired = expiredResult.count
  stats.totalProcessed += expiredResult.count

  // Clean up expired superseded evidence older than grace period
  const supersededThreshold = new Date(now.getTime() - SUPERSEDED_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const cleanupResult = await db.evidence.deleteMany({
    where: {
      status: 'superseded',
      createdAt: { lt: supersededThreshold },
    },
  })
  stats.cleanedUp = cleanupResult.count

  // Check for newer evidence that supersedes older evidence
  // (same company + same extractedField + newer = older gets superseded)
  const recentEvidence = await db.evidence.findMany({
    where: { status: 'active', extractedField: { not: null } },
    select: { companyId: true, extractedField: true, createdAt: true },
    distinct: ['companyId', 'extractedField'],
    take: 100,
  })

  for (const evidence of recentEvidence) {
    if (!evidence.extractedField) continue

    await db.evidence.updateMany({
      where: {
        companyId: evidence.companyId,
        extractedField: evidence.extractedField,
        createdAt: { lt: evidence.createdAt },
        status: { in: ['active', 'aging'] },
      },
      data: { status: 'superseded' },
    })
  }

  console.log(`[evidence-lifecycle] Processed: ${stats.totalProcessed}, Aging: ${stats.markedAging}, Expired: ${stats.markedExpired}, Cleaned: ${stats.cleanedUp}`)
  return stats
}

/**
 * Get evidence stats for a company
 */
export async function getCompanyEvidenceStats(companyId: string) {
  const [total, active, aging, superseded, expired] = await Promise.all([
    db.evidence.count({ where: { companyId } }),
    db.evidence.count({ where: { companyId, status: 'active' } }),
    db.evidence.count({ where: { companyId, status: 'aging' } }),
    db.evidence.count({ where: { companyId, status: 'superseded' } }),
    db.evidence.count({ where: { companyId, status: 'expired' } }),
  ])

  return { total, active, aging, superseded, expired, healthScore: total > 0 ? active / total : 0 }
}
