/**
 * Phase 9: AI Cost Governance
 *
 * Enforces daily AI spending budgets and provides cost visibility.
 * Checks running costs before making LLM calls.
 * Returns cached/stale data when budget is exceeded.
 */

import { db } from '@/lib/db'

export interface CostStatus {
  dailySpend: number
  dailyBudget: number
  remaining: number
  utilizationPct: number
  isExceeded: boolean
  callCount: number
  topFeatures: Array<{ feature: string; cost: number; calls: number }>
}

const DEFAULT_DAILY_BUDGET = 5.0 // $5/day default

/**
 * Get current daily cost status
 */
export async function getDailyCostStatus(): Promise<CostStatus> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const dailyLogs = await db.aIUsageLog.findMany({
    where: { createdAt: { gte: todayStart }, status: 'success' },
    select: { feature: true, estimatedCost: true },
  })

  const dailySpend = dailyLogs.reduce((sum, log) => sum + (log.estimatedCost || 0), 0)
  const budget = parseFloat(process.env.AI_DAILY_BUDGET || String(DEFAULT_DAILY_BUDGET))
  const callCount = dailyLogs.length

  // Aggregate by feature
  const featureMap = new Map<string, { cost: number; calls: number }>()
  for (const log of dailyLogs) {
    const existing = featureMap.get(log.feature) || { cost: 0, calls: 0 }
    featureMap.set(log.feature, { cost: existing.cost + (log.estimatedCost || 0), calls: existing.calls + 1 })
  }

  const topFeatures = Array.from(featureMap.entries())
    .map(([feature, data]) => ({ feature, ...data }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)

  const utilizationPct = budget > 0 ? (dailySpend / budget) * 100 : 0

  return {
    dailySpend,
    dailyBudget: budget,
    remaining: Math.max(0, budget - dailySpend),
    utilizationPct: Math.min(100, utilizationPct),
    isExceeded: dailySpend >= budget,
    callCount,
    topFeatures,
  }
}

/**
 * Check if AI call is allowed within budget
 * Call this BEFORE making an LLM call
 */
export async function canMakeAICall(estimatedCost: number = 0.001): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getDailyCostStatus()

  if (status.isExceeded) {
    return {
      allowed: false,
      reason: `Daily AI budget exceeded ($${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)}). Intelligence refresh paused — showing last cached data.`,
    }
  }

  if (status.dailySpend + estimatedCost > status.dailyBudget) {
    return {
      allowed: false,
      reason: `Approaching daily budget limit. Remaining: $${status.remaining.toFixed(2)}. Consider using cached intelligence.`,
    }
  }

  return { allowed: true }
}

/**
 * Log an AI call for cost tracking
 */
export async function logAICall(params: {
  feature: string
  provider: string
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  estimatedCost?: number
  durationMs?: number
  companyId?: string
  status?: string
}): Promise<void> {
  try {
    await db.aIUsageLog.create({
      data: {
        feature: params.feature,
        provider: params.provider || 'unknown',
        model: params.model || 'unknown',
        promptTokens: params.promptTokens || 0,
        completionTokens: params.completionTokens || 0,
        totalTokens: params.totalTokens || 0,
        estimatedCost: params.estimatedCost || 0,
        durationMs: params.durationMs || 0,
        companyId: params.companyId,
        status: params.status || 'success',
      },
    })
  } catch {
    // Best effort — never throw
  }
}
