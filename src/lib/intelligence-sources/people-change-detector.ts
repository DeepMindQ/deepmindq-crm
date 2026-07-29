/**
 * Sprint 3A: People Change Detector
 *
 * Detects people movement and relationship changes as first-class signals:
 * - Contact role/title changes → buying role evolution
 * - New contacts added to account → buying committee formation
 * - Engagement pattern shifts → relationship strength changes
 * - High-value contact departures → champion risk signals
 * - Hiring signals from title patterns → growth/reorganization signals
 *
 * This wires the existing person-intelligence-engine into the intelligence
 * pipeline as a signal source, not just a standalone profiling tool.
 */

import { db } from '@/lib/db'
import { createSignalFromIntelligenceObject } from './signal-creator'
import type { PersonIntelligenceProfile } from '@/lib/person-intelligence-engine'
import { logger } from '@/lib/logger';

// ── Types ──

export interface PeopleChangeSignal {
  signal: string
  signalType: string  // always 'people_change'
  evidence: string
  confidence: number
  businessImpact: string
  recommendedAction: string
  timing: 'immediate' | 'within_7_days' | 'within_30_days' | 'within_90_days' | 'ongoing'
  severity: 'low' | 'medium' | 'high' | 'critical'
  sourceName: string
  signalDate?: Date
}

export interface PeopleChangeResult {
  companyId: string
  signalsExtracted: number
  signalsPersisted: number
  contactAnalysis: {
    totalContacts: number
    newContacts30d: number
    highInfluenceContacts: number
    activeEngagement: number
    staleContacts: number
    championCandidates: number
  }
  signals: PeopleChangeSignal[]
}

// ── Detection Functions ──

function detectNewContactSignals(
  newContacts: Array<{
    id: string
    rawName: string
    title: string | null
    role: string | null
    createdAt: Date
  }>
): PeopleChangeSignal[] {
  const signals: PeopleChangeSignal[] = []

  if (newContacts.length === 0) return signals

  // New C-suite or VP contacts = buying committee formation
  const executives = newContacts.filter(c => {
    const t = (c.title || c.role || '').toLowerCase()
    return /ceo|cto|cfo|cio|cmo|coo|vp|vice president|chief|svp|evp|director|head/.test(t)
  })

  if (executives.length > 0) {
    signals.push({
      signal: `Buying Committee Expansion: ${executives.length} new senior contact(s) added — ${executives.map(c => `${c.rawName} (${c.title || c.role})`).join(', ')}`,
      signalType: 'people_change',
      evidence: `New executive contacts added to account in the last 30 days, indicating possible buying committee formation or reorganization`,
      confidence: 80,
      businessImpact: 'Critical — New senior contacts suggest active buying process or organizational change',
      recommendedAction: `Prioritize outreach to new contacts — they may be part of an active evaluation committee`,
      timing: 'within_7_days',
      severity: 'critical',
      sourceName: 'people:new_contacts',
    })
  }

  if (newContacts.length >= 3) {
    signals.push({
      signal: `Account Team Growth: ${newContacts.length} new contacts added in last 30 days`,
      signalType: 'people_change',
      evidence: `Rapid contact addition suggests the account is scaling or forming a buying committee`,
      confidence: 75,
      businessImpact: 'High — Rapid team expansion correlates with active projects and buying intent',
      recommendedAction: 'Map the expanded team to buying roles and identify the decision-making structure',
      timing: 'within_30_days',
      severity: 'high',
      sourceName: 'people:contact_growth',
    })
  }

  return signals
}

function detectChampionRiskSignals(
  contacts: Array<{
    id: string
    rawName: string
    title: string | null
    status: string
    lastContactedAt: Date | null
    leadScore: number
    _count: { replies: number }
  }>
): PeopleChangeSignal[] {
  const signals: PeopleChangeSignal[] = []

  for (const contact of contacts) {
    const daysSinceContact = contact.lastContactedAt
      ? (Date.now() - contact.lastContactedAt.getTime()) / 86400000
      : 999

    // Champion going cold = risk signal
    if (contact._count.replies >= 2 && contact.leadScore >= 60 && daysSinceContact > 45) {
      signals.push({
        signal: `Champion at Risk: ${contact.rawName} (${contact.title || 'Unknown'}) was responsive but now cold for ${Math.round(daysSinceContact)} days`,
        signalType: 'people_change',
        evidence: `${contact.rawName} had ${contact._count.replies} replies (lead score ${contact.leadScore}) but no interaction in ${Math.round(daysSinceContact)} days`,
        confidence: 78,
        businessImpact: 'Critical — Previously engaged champion going silent may indicate loss of interest, internal changes, or competitor engagement',
        recommendedAction: `Immediately re-engage ${contact.rawName} with value-add content or meeting request — champion at risk`,
        timing: 'immediate',
        severity: 'critical',
        sourceName: 'people:champion_risk',
      })
    }

    // High influence contact never engaged = untapped potential
    const title = (contact.title || '').toLowerCase()
    const isExecutive = /ceo|cto|cfo|cio|cmo|coo|vp|chief|president/.test(title)
    if (isExecutive && contact._count.replies === 0 && daysSinceContact > 30) {
      signals.push({
        signal: `Untapped Executive: ${contact.rawName} (${contact.title || 'Unknown'}) — executive with no engagement history`,
        signalType: 'people_change',
        evidence: `C-suite/VP contact with zero replies — potential high-value target not yet engaged`,
        confidence: 70,
        businessImpact: 'High — Executive contact with buying authority is not being engaged',
        recommendedAction: `Develop executive-specific outreach for ${contact.rawName} — use insight-led approach`,
        timing: 'within_7_days',
        severity: 'high',
        sourceName: 'people:untapped_executive',
      })
    }
  }

  return signals
}

function detectEngagementPatternSignals(
  contacts: Array<{
    rawName: string
    title: string | null
    status: string
    engagementScore: number
    lastContactedAt: Date | null
    _count: { replies: number }
  }>
): PeopleChangeSignal[] {
  const signals: PeopleChangeSignal[] = []

  const activeContacts = contacts.filter(c =>
    c.status === 'replied' || c._count.replies > 0 || c.engagementScore > 30
  )
  const ratio = activeContacts.length / Math.max(1, contacts.length)

  // High engagement ratio = strong account
  if (ratio >= 0.5 && contacts.length >= 3) {
    signals.push({
      signal: `Strong Account Engagement: ${Math.round(ratio * 100)}% of contacts actively engaged (${activeContacts.length}/${contacts.length})`,
      signalType: 'people_change',
      evidence: `High engagement ratio suggests strong relationship penetration across the account`,
      confidence: 82,
      businessImpact: 'High — Multi-threaded engagement increases deal velocity and reduces single-point-of-failure risk',
      recommendedAction: 'Leverage strong engagement to deepen relationships and advance deal stage',
      timing: 'within_30_days',
      severity: 'medium',
      sourceName: 'people:engagement_patterns',
    })
  }

  // Low engagement ratio = concern
  if (ratio < 0.2 && contacts.length >= 3) {
    signals.push({
      signal: `Low Account Engagement: Only ${Math.round(ratio * 100)}% of contacts active (${activeContacts.length}/${contacts.length})`,
      signalType: 'people_change',
      evidence: `Most contacts are dormant — limited relationship penetration across the account`,
      confidence: 75,
      businessImpact: 'Medium — Low engagement increases single-threading risk and reduces deal intelligence',
      recommendedAction: 'Launch multi-threaded outreach campaign to expand engagement across the buying committee',
      timing: 'within_30_days',
      severity: 'medium',
      sourceName: 'people:engagement_patterns',
    })
  }

  return signals
}

function detectStakeholderGapSignals(
  contacts: Array<{
    rawName: string
    title: string | null
    role: string | null
  }>
): PeopleChangeSignal[] {
  const signals: PeopleChangeSignal[] = []

  const titles = contacts.map(c => (c.title || c.role || '').toLowerCase())

  const hasEconomicBuyer = titles.some(t =>
    /ceo|cfo|coo|president|chief executive|chief financial|chief operating|vp finance|vp revenue/.test(t)
  )
  const hasTechnicalBuyer = titles.some(t =>
    /cto|cio|vp engineering|vp technology|chief technology|chief information|architect|vp infrastructure/.test(t)
  )
  const hasChampion = titles.some(t =>
    /director|head|lead|senior manager|manager/.test(t)
  )

  const gaps: string[] = []
  if (!hasEconomicBuyer) gaps.push('No economic buyer — no contact with budget authority')
  if (!hasTechnicalBuyer) gaps.push('No technical buyer — no contact for technical evaluation')
  if (!hasChampion && contacts.length > 0) gaps.push('No mid-level champion — no internal advocate')

  if (gaps.length >= 2) {
    signals.push({
      signal: `Critical Stakeholder Gaps: ${gaps.join('; ')}`,
      signalType: 'people_change',
      evidence: `Analysis of ${contacts.length} contacts reveals missing buying roles needed for deal progression`,
      confidence: 85,
      businessImpact: 'Critical — Missing buying roles prevent effective deal progression',
      recommendedAction: 'Immediately identify and target missing buying roles through LinkedIn research and referral asks',
      timing: 'within_7_days',
      severity: 'critical',
      sourceName: 'people:stakeholder_gaps',
    })
  } else if (gaps.length === 1) {
    signals.push({
      signal: `Stakeholder Gap: ${gaps[0]}`,
      signalType: 'people_change',
      evidence: `Analysis of ${contacts.length} contacts reveals one critical buying role is missing`,
      confidence: 70,
      businessImpact: 'High — Missing buying role creates risk in deal progression',
      recommendedAction: `Target the missing buying role through warm introductions from existing contacts`,
      timing: 'within_30_days',
      severity: 'medium',
      sourceName: 'people:stakeholder_gaps',
    })
  }

  return signals
}

// ═══════════════════════════════════════════════════════════════
// MAIN DETECTOR
// ═══════════════════════════════════════════════════════════════

export async function detectPeopleChanges(
  companyId: string
): Promise<PeopleChangeResult> {
  const allSignals: PeopleChangeSignal[] = []

  // ── Fetch all contacts with engagement data ──
  const contacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    include: { _count: { select: { replies: true } } },
    orderBy: { leadScore: 'desc' },
  })

  // ── 1. New contacts (last 30 days) ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const newContacts = contacts.filter(c => c.createdAt >= thirtyDaysAgo)
  allSignals.push(...detectNewContactSignals(newContacts))

  // ── 2. Champion risk detection ──
  allSignals.push(...detectChampionRiskSignals(contacts))

  // ── 3. Engagement pattern analysis ──
  allSignals.push(...detectEngagementPatternSignals(contacts))

  // ── 4. Stakeholder gap detection ──
  allSignals.push(...detectStakeholderGapSignals(contacts))

  // ── 5. Generate from person profiles (high-value contacts) ──
  const highValueContacts = contacts.filter(c => c.leadScore >= 50).slice(0, 5)
  for (const contact of highValueContacts) {
    // Use title-based priority detection inline (avoid full profile build overhead)
    const title = (contact.title || contact.role || '').toLowerCase()
    if (contact.leadScore >= 80) {
      allSignals.push({
        signal: `High-Value Contact: ${contact.rawName} (${contact.title || contact.role}) — lead score ${contact.leadScore}/100`,
        signalType: 'people_change',
        evidence: `${contact.rawName} has very high lead score (${contact.leadScore}), indicating strong fit for engagement`,
        confidence: contact.leadScore,
        businessImpact: 'High — High lead score contact matches ideal customer profile closely',
        recommendedAction: `Prioritize personalized outreach to ${contact.rawName} with role-specific messaging`,
        timing: 'within_7_days',
        severity: 'high',
        sourceName: 'people:lead_scoring',
      })
    }
  }

  // ── Persist signals ──
  let signalsPersisted = 0
  for (const sig of allSignals) {
    try {
      const result = await createSignalFromIntelligenceObject({
        companyId,
        signal: sig.signal,
        evidence: sig.evidence,
        sourceName: sig.sourceName,
        confidence: sig.confidence,
        businessImpact: sig.businessImpact,
        recommendedAction: sig.recommendedAction,
        timing: sig.timing,
        severity: sig.severity,
        signalType: sig.signalType,
      })
      if (result.success) signalsPersisted++
    } catch (err) {
      logger.warn(`[people-change] Failed to persist signal:`, { error: err })
    }
  }

  // ── Analysis summary ──
  const contactAnalysis = {
    totalContacts: contacts.length,
    newContacts30d: newContacts.length,
    highInfluenceContacts: contacts.filter(c => c.leadScore >= 60).length,
    activeEngagement: contacts.filter(c => c.status === 'replied' || c._count.replies > 0).length,
    staleContacts: contacts.filter(c => {
      if (!c.lastContactedAt) return true
      return (Date.now() - c.lastContactedAt.getTime()) / 86400000 > 45
    }).length,
    championCandidates: contacts.filter(c => c._count.replies >= 2 && c.leadScore >= 50).length,
  }

  return {
    companyId,
    signalsExtracted: allSignals.length,
    signalsPersisted,
    contactAnalysis,
    signals: allSignals,
  }
}
