/**
 * Sprint 3B: Action Engine — Master Orchestrator
 *
 * Coordinates all 6 action modules and provides a unified entry point.
 * Also handles:
 * - ActionArtifact persistence
 * - Cache management (avoid regenerating within 1 hour)
 * - Composite action generation
 */

import { db } from '@/lib/db'
import { generateMeetingPrep, type MeetingPrepBrief } from './meeting-prep'
import { generateExecutiveOutreach, type ExecutiveOutreachIntelligence } from './executive-outreach'
import { generateAccountStrategy, type AccountStrategyPlan } from './account-strategy'
import { generateStakeholderMap, type StakeholderMapAction } from './stakeholder-map'
import { qualifyOpportunity, type OpportunityQualification } from './opportunity-qualification'
import { generateNextBestAction, type NextBestAction } from './next-best-action'

// ── Types ──

export type ActionType = 'meeting_prep' | 'executive_outreach' | 'account_strategy' | 'stakeholder_map' | 'opportunity_qualification' | 'next_best_action'

export interface ActionResult<T = unknown> {
  actionType: ActionType
  success: boolean
  artifactId?: string
  data: T
  generatedAt: string
  latencyMs: number
  wasCached: boolean
}

export interface CompositeActionResult {
  companyId: string
  companyName: string
  actions: Partial<Record<ActionType, ActionResult>>
  meta: {
    totalActionsGenerated: number
    totalLatencyMs: number
    cachedActions: number
  }
}

// ── Cache: Don't regenerate actions within 1 hour ──
const ACTION_CACHE_TTL_MS = 60 * 60 * 1000

async function getCachedArtifact(
  companyId: string,
  actionType: ActionType
): Promise<string | null> {
  const cached = await db.actionArtifact.findFirst({
    where: {
      companyId,
      actionType,
      status: { in: ['draft', 'approved'] },
      generatedAt: { gte: new Date(Date.now() - ACTION_CACHE_TTL_MS) },
    },
    select: { id: true },
  })
  return cached?.id || null
}

async function persistArtifact<T>(
  companyId: string,
  actionType: ActionType,
  data: T,
  summary: string,
  priorityScore: number,
  confidence: number,
  signalCount: number,
  contactCount: number
): Promise<string> {
  const artifact = await db.actionArtifact.create({
    data: {
      companyId,
      actionType,
      summary,
      content: JSON.stringify(data),
      priorityScore,
      confidence,
      evidenceReferences: JSON.stringify([]),
      sourceSignalCount: signalCount,
      sourceContactCount: contactCount,
      status: 'draft',
      generatedBy: 'sprint3_engine',
    },
  })
  return artifact.id
}

// ── Signal/Contact counts for evidence tracking ──
async function getSignalContactCounts(companyId: string) {
  const [signalCount, contactCount] = await Promise.all([
    db.companySignal.count({
      where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
    }),
    db.contact.count({
      where: { companyId, status: { not: 'archived' } },
    }),
  ])
  return { signalCount, contactCount }
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL ACTION GENERATORS (with caching + persistence)
// ═══════════════════════════════════════════════════════════════

export async function generateMeetingPrepAction(companyId: string): Promise<ActionResult<MeetingPrepBrief>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'meeting_prep')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return {
      actionType: 'meeting_prep',
      success: true,
      artifactId: cached,
      data: artifact ? JSON.parse(artifact.content) : null,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - start,
      wasCached: true,
    }
  }

  const data = await generateMeetingPrep(companyId)
  const counts = await getSignalContactCounts(companyId)
  const artifactId = await persistArtifact(
    companyId, 'meeting_prep', data,
    data.executiveSummary.substring(0, 200),
    data.talkingPoints.length * 10 + data.discoveryQuestions.length * 5,
    0.75, counts.signalCount, counts.contactCount
  )

  return { actionType: 'meeting_prep', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

export async function generateExecutiveOutreachAction(companyId: string): Promise<ActionResult<ExecutiveOutreachIntelligence>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'executive_outreach')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return { actionType: 'executive_outreach', success: true, artifactId: cached, data: artifact ? JSON.parse(artifact.content) : null, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: true }
  }

  const data = await generateExecutiveOutreach(companyId)
  const counts = await getSignalContactCounts(companyId)
  const artifactId = await persistArtifact(
    companyId, 'executive_outreach', data,
    data.summary.substring(0, 200),
    data.targets.filter(t => t.priority === 'critical').length * 25 + data.targets.filter(t => t.priority === 'high').length * 15,
    0.70, counts.signalCount, counts.contactCount
  )

  return { actionType: 'executive_outreach', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

export async function generateAccountStrategyAction(companyId: string): Promise<ActionResult<AccountStrategyPlan>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'account_strategy')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return { actionType: 'account_strategy', success: true, artifactId: cached, data: artifact ? JSON.parse(artifact.content) : null, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: true }
  }

  const data = await generateAccountStrategy(companyId)
  const counts = await getSignalContactCounts(companyId)
  const artifactId = await persistArtifact(
    companyId, 'account_strategy', data,
    data.executiveSummary.substring(0, 200),
    data.priorities.length * 15 + data.opportunityAreas.length * 10,
    0.70, counts.signalCount, counts.contactCount
  )

  return { actionType: 'account_strategy', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

export async function generateStakeholderMapAction(companyId: string): Promise<ActionResult<StakeholderMapAction>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'stakeholder_map')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return { actionType: 'stakeholder_map', success: true, artifactId: cached, data: artifact ? JSON.parse(artifact.content) : null, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: true }
  }

  const data = await generateStakeholderMap(companyId)
  const counts = await getSignalContactCounts(companyId)
  const artifactId = await persistArtifact(
    companyId, 'stakeholder_map', data,
    data.summary.substring(0, 200),
    data.powerGrid.manageClosely.length * 20 + (data.coverageGaps.length === 0 ? 30 : 0),
    0.75, counts.signalCount, counts.contactCount
  )

  return { actionType: 'stakeholder_map', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

export async function generateOpportunityQualificationAction(companyId: string): Promise<ActionResult<OpportunityQualification>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'opportunity_qualification')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return { actionType: 'opportunity_qualification', success: true, artifactId: cached, data: artifact ? JSON.parse(artifact.content) : null, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: true }
  }

  const data = await qualifyOpportunity(companyId)
  const counts = await getSignalContactCounts(companyId)
  const artifactId = await persistArtifact(
    companyId, 'opportunity_qualification', data,
    data.executiveSummary.substring(0, 200),
    data.confidenceScore,
    data.confidenceScore / 100,
    counts.signalCount, counts.contactCount
  )

  return { actionType: 'opportunity_qualification', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

export async function generateNextBestActionAction(companyId: string): Promise<ActionResult<NextBestAction>> {
  const start = Date.now()
  const cached = await getCachedArtifact(companyId, 'next_best_action')
  if (cached) {
    const artifact = await db.actionArtifact.findUnique({ where: { id: cached } })
    return { actionType: 'next_best_action', success: true, artifactId: cached, data: artifact ? JSON.parse(artifact.content) : null, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: true }
  }

  const data = await generateNextBestAction(companyId)
  const counts = await getSignalContactCounts(companyId)
  const priorityMap = { critical: 95, high: 75, medium: 50, low: 25 }
  const artifactId = await persistArtifact(
    companyId, 'next_best_action', data,
    data.action.substring(0, 200),
    priorityMap[data.priority] || 50,
    0.75, counts.signalCount, counts.contactCount
  )

  return { actionType: 'next_best_action', success: true, artifactId, data, generatedAt: new Date().toISOString(), latencyMs: Date.now() - start, wasCached: false }
}

// ═══════════════════════════════════════════════════════════════
// COMPOSITE: Generate all actions for an account
// ═══════════════════════════════════════════════════════════════

export async function generateAllActions(
  companyId: string,
  options?: { actionTypes?: ActionType[] }
): Promise<CompositeActionResult> {
  const start = Date.now()
  const types = options?.actionTypes || ['meeting_prep', 'executive_outreach', 'account_strategy', 'stakeholder_map', 'opportunity_qualification', 'next_best_action']

  const company = await db.company.findUnique({ where: { id: companyId }, select: { rawName: true } })
  if (!company) throw new Error(`Company ${companyId} not found`)

  const actions: Partial<Record<ActionType, ActionResult>> = {}
  let cachedCount = 0

  for (const type of types) {
    try {
      let result: ActionResult
      switch (type) {
        case 'meeting_prep': result = await generateMeetingPrepAction(companyId); break
        case 'executive_outreach': result = await generateExecutiveOutreachAction(companyId); break
        case 'account_strategy': result = await generateAccountStrategyAction(companyId); break
        case 'stakeholder_map': result = await generateStakeholderMapAction(companyId); break
        case 'opportunity_qualification': result = await generateOpportunityQualificationAction(companyId); break
        case 'next_best_action': result = await generateNextBestActionAction(companyId); break
        default: continue
      }
      if (result.wasCached) cachedCount++
      actions[type] = result
    } catch (err) {
      console.warn(`[action-engine] Failed to generate ${type}:`, err)
      actions[type] = { actionType: type, success: false, data: null, generatedAt: new Date().toISOString(), latencyMs: 0, wasCached: false }
    }
  }

  return {
    companyId,
    companyName: company.rawName,
    actions,
    meta: {
      totalActionsGenerated: Object.values(actions).filter(a => a.success).length,
      totalLatencyMs: Date.now() - start,
      cachedActions: cachedCount,
    },
  }
}
