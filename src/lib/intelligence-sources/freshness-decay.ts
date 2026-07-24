/**
 * Freshness Decay — Signal Lifecycle Management
 *
 * Wave 8B: Manages the temporal decay of intelligence signals.
 *
 * Features:
 *   1. Expire signals past their expiresAt date
 *   2. Decay confidence for aging signals (time-based degradation)
 *   3. Promote signals to 'aging' status after configurable threshold
 *   4. Bulk scan + update for scheduled execution
 */

import { db } from '@/lib/db'

const MAX_SIGNAL_AGE_DAYS = 180
const AGING_THRESHOLD_DAYS = 60
const DAILY_DECAY_RATE = 0.005

interface DecayResult {
  expired: number
  aged: number
  decayed: number
  untouched: number
  details: Array<{ signalId: string; action: string; previousConfidence: number; newConfidence: number }>
}

interface FreshnessStats {
  totalActive: number
  totalAging: number
  totalExpired: number
  avgConfidence: number
  urgentExpiryCount: number
  highPriorityDecay: number
}

export async function runFreshnessScan(): Promise<DecayResult> {
  const now = new Date()
  const result: DecayResult = { expired: 0, aged: 0, decayed: 0, untouched: 0, details: [] }

  // Step 1: Expire signals past their expiresAt date
  const expiredSignals = await db.companySignal.findMany({
    where: { status: { in: ['detected', 'validated', 'active', 'aging'] }, expiresAt: { lt: now } },
    select: { id: true, confidence: true },
  })
  if (expiredSignals.length > 0) {
    await db.companySignal.updateMany({
      where: { id: { in: expiredSignals.map(s => s.id) }, status: { in: ['detected', 'validated', 'active', 'aging'] }, expiresAt: { lt: now } },
      data: { status: 'expired', confidence: 0.1 },
    })
    result.expired = expiredSignals.length
    for (const s of expiredSignals) {
      result.details.push({ signalId: s.id, action: 'expired', previousConfidence: s.confidence, newConfidence: 0.1 })
    }
  }

  // Step 2: Expire very old signals without expiresAt
  const maxAgeCutoff = new Date(now.getTime() - MAX_SIGNAL_AGE_DAYS * 24 * 60 * 60 * 1000)
  const oldSignals = await db.companySignal.findMany({
    where: { status: { in: ['detected', 'validated', 'active', 'aging'] }, expiresAt: null, createdAt: { lt: maxAgeCutoff } },
    select: { id: true, confidence: true },
  })
  if (oldSignals.length > 0) {
    await db.companySignal.updateMany({
      where: { id: { in: oldSignals.map(s => s.id) }, status: { in: ['detected', 'validated', 'active', 'aging'] }, expiresAt: null, createdAt: { lt: maxAgeCutoff } },
      data: { status: 'expired', confidence: 0.1, expiresAt: now },
    })
    result.expired += oldSignals.length
    for (const s of oldSignals) {
      result.details.push({ signalId: s.id, action: 'expired', previousConfidence: s.confidence, newConfidence: 0.1 })
    }
  }

  // Step 3: Decay confidence for aging signals
  const agingCutoff = new Date(now.getTime() - AGING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
  const decayableSignals = await db.companySignal.findMany({
    where: { status: { in: ['active', 'aging'] }, createdAt: { lt: agingCutoff }, confidence: { gt: 0.1 } },
    select: { id: true, confidence: true, createdAt: true },
  })
  for (const signal of decayableSignals) {
    const ageDays = (now.getTime() - signal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const daysOverThreshold = Math.max(0, ageDays - AGING_THRESHOLD_DAYS)
    const decayMultiplier = Math.pow(1 - DAILY_DECAY_RATE, daysOverThreshold)
    const newConfidence = Math.max(0.1, signal.confidence * decayMultiplier)
    if (newConfidence < signal.confidence - 0.001) {
      await db.companySignal.update({
        where: { id: signal.id },
        data: { confidence: Math.round(newConfidence * 1000) / 1000, status: 'aging' },
      })
      result.decayed++
      result.details.push({ signalId: signal.id, action: 'decayed', previousConfidence: signal.confidence, newConfidence: Math.round(newConfidence * 1000) / 1000 })
    } else {
      result.untouched++
    }
  }

  // Step 4: Promote signals approaching expiry to 'aging'
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const approachingExpiry = await db.companySignal.findMany({
    where: { status: 'active', expiresAt: { gt: now, lt: weekFromNow } },
    select: { id: true },
  })
  if (approachingExpiry.length > 0) {
    await db.companySignal.updateMany({
      where: { id: { in: approachingExpiry.map(s => s.id) }, status: 'active', expiresAt: { gt: now, lt: weekFromNow } },
      data: { status: 'aging' },
    })
    result.aged = approachingExpiry.length
  }

  return result
}

export async function getFreshnessStats(): Promise<FreshnessStats> {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [totalActive, totalAging, totalExpired, urgentExpiry, avgResult] = await Promise.all([
    db.companySignal.count({ where: { status: { in: ['detected', 'validated', 'active'] } } }),
    db.companySignal.count({ where: { status: 'aging' } }),
    db.companySignal.count({ where: { status: 'expired' } }),
    db.companySignal.count({ where: { status: { in: ['active', 'aging'] }, expiresAt: { gt: now, lt: weekFromNow } } }),
    db.companySignal.aggregate({ where: { status: { in: ['detected', 'validated', 'active', 'aging'] } }, _avg: { confidence: true } }),
  ])
  const highPriorityDecay = await db.companySignal.count({
    where: { status: { in: ['active', 'aging'] }, confidence: { lt: 0.3, gt: 0 } },
  })
  return {
    totalActive, totalAging, totalExpired,
    avgConfidence: avgResult._avg.confidence ?? 0,
    urgentExpiryCount: urgentExpiry,
    highPriorityDecay,
  }
}

export async function refreshSignalExpiry(signalId: string, newExpiresAt: Date): Promise<boolean> {
  try {
    await db.companySignal.update({
      where: { id: signalId },
      data: { expiresAt: newExpiresAt, status: 'active', confidence: Math.max(0.3, 0.5) },
    })
    return true
  } catch { return false }
}

export async function backfillExpiryDates(batchSize = 500): Promise<number> {
  let updated = 0
  let hasMore = true
  while (hasMore) {
    const signals = await db.companySignal.findMany({
      where: { expiresAt: null, status: { in: ['detected', 'validated', 'active'] } },
      take: batchSize,
      select: { id: true, signalDate: true, createdAt: true },
    })
    if (signals.length === 0) { hasMore = false; break }
    await Promise.all(signals.map(s => {
      const base = s.signalDate || s.createdAt
      return db.companySignal.update({
        where: { id: s.id },
        data: { expiresAt: new Date(base.getTime() + 90 * 24 * 60 * 60 * 1000) },
      })
    }))
    updated += signals.length
    if (signals.length < batchSize) hasMore = false
  }
  return updated
}
