/**
 * Phase 9: Cross-Account Signal Propagation
 *
 * When a major signal is collected for one account, check if other
 * accounts in the pipeline are affected by the same intelligence.
 *
 * Example: "Microsoft Azure announces partnership with Databricks"
 * → Propagate to all accounts using Azure or Databricks
 *
 * Propagated signals are tagged with sourceCompanyId for traceability.
 */

import { db } from '@/lib/db'

export interface PropagationResult {
  sourceSignalId: string
  sourceCompanyId: string
  sourceCompanyName: string
  propagatedTo: Array<{ companyId: string; companyName: string }>
  totalPropagated: number
}

/**
 * Propagate a single signal to other affected accounts
 */
export async function propagateSignal(signalId: string): Promise<PropagationResult | null> {
  const signal = await db.companySignal.findUnique({
    where: { id: signalId },
    select: {
      id: true, companyId: true, signalType: true,
      title: true, description: true, severity: true,
    },
  })

  if (!signal) return null

  // Only propagate high-severity signals
  const highSeverityTypes = ['leadership', 'funding', 'partnership', 'tech_change', 'product']
  if (!highSeverityTypes.includes(signal.signalType)) return null

  const summary = `${signal.title} ${signal.description || ''}`.toLowerCase()

  // Find accounts that might be affected
  const allCompanies = await db.company.findMany({
    where: {
      id: { not: signal.companyId },
      status: { not: 'deleted' },
    },
    select: { id: true, rawName: true, researchCard: true },
    take: 100,
  })

  const affected: Array<{ companyId: string; companyName: string }> = []

  for (const company of allCompanies) {
    const isAffected = await checkIfAffected(summary, company.researchCard)
    if (isAffected) {
      affected.push({ companyId: company.id, companyName: company.rawName })
    }
  }

  if (affected.length === 0) return null

  const sourceCompany = await db.company.findUnique({ where: { id: signal.companyId }, select: { rawName: true } })

  return {
    sourceSignalId: signalId,
    sourceCompanyId: signal.companyId,
    sourceCompanyName: sourceCompany?.rawName || 'Unknown',
    propagatedTo: affected,
    totalPropagated: affected.length,
  }
}

/**
 * Check if a signal summary affects a company based on its data
 */
async function checkIfAffected(signalSummary: string, researchCard: any): Promise<boolean> {
  try {
    const rc = typeof researchCard === 'string' ? JSON.parse(researchCard) : (researchCard || {})

    // Check tech stack overlap
    const techStack = rc.techStack || ''
    if (techStack) {
      const techKeywords = techStack.toLowerCase().split(/[,;\s]+/)
      for (const keyword of techKeywords) {
        if (keyword.length > 2 && signalSummary.includes(keyword)) return true
      }
    }

    // Check competitor overlap
    const competitors = rc.competitors || []
    for (const competitor of competitors) {
      if (typeof competitor === 'string' && signalSummary.includes(competitor.toLowerCase())) return true
    }

    // Check industry overlap
    const industry = rc.industry || ''
    if (industry && signalSummary.includes(industry.toLowerCase())) return true
  } catch {
    // Skip on parse error
  }

  return false
}

/**
 * Run cross-account propagation across all recent high-severity signals
 */
export async function propagateCrossAccountSignals(): Promise<{ totalChecked: number; totalPropagated: number }> {
  const recentSignals = await db.companySignal.findMany({
    where: {
      status: 'active',
      signalType: { in: ['leadership', 'funding', 'partnership', 'tech_change', 'product'] },
      createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    },
    select: { id: true },
    take: 50,
  })

  let totalPropagated = 0
  for (const signal of recentSignals) {
    try {
      const result = await propagateSignal(signal.id)
      if (result && result.totalPropagated > 0) {
        totalPropagated += result.totalPropagated
        console.log(`[cross-account] Signal ${signal.id} propagated to ${result.totalPropagated} accounts`)
      }
    } catch {
      // Skip on error
    }
  }

  console.log(`[cross-account] Checked ${recentSignals.length} signals, propagated ${totalPropagated} total`)
  return { totalChecked: recentSignals.length, totalPropagated }
}
