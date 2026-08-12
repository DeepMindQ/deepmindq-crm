/**
 * AI Tool Executor — Real implementations for CRM tool calls.
 *
 * Each exported function corresponds to a tool defined in ai-tool-definitions.ts.
 * Functions receive parsed arguments from the LLM's tool_calls and return
 * structured results that get fed back to the LLM.
 *
 * DESIGN PRINCIPLES:
 *   - All functions are async and return JSON-serializable results
 *   - All functions use safe query patterns (safeFindMany where appropriate)
 *   - All functions handle errors gracefully — return error string, never throw
 *   - Results are concise but informative — optimized for LLM consumption
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ToolName } from './ai-tool-definitions'

// ─── Result type ────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  data: Record<string, unknown> | unknown[]
  error?: string
}

// ─── Main executor router ────────────────────────────────────────────────

/**
 * Execute a tool call by name with the given arguments.
 * This is the single entry point called by the agentic loop.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const startTime = Date.now()
  try {
    let result: ToolResult

    switch (name) {
      // ── Company tools ──
      case ToolName.SEARCH_COMPANIES:
        result = await searchCompanies(args)
        break
      case ToolName.GET_COMPANY_DETAILS:
        result = await getCompanyDetails(args)
        break
      case ToolName.GET_COMPANY_SIGNALS:
        result = await getCompanySignals(args)
        break
      case ToolName.GET_COMPANY_OPPORTUNITIES:
        result = await getCompanyOpportunities(args)
        break
      case ToolName.GET_COMPANY_SCORES:
        result = await getCompanyScores(args)
        break

      // ── Contact tools ──
      case ToolName.SEARCH_CONTACTS:
        result = await searchContacts(args)
        break
      case ToolName.GET_CONTACT_DETAILS:
        result = await getContactDetails(args)
        break
      case ToolName.GET_CONTACT_ACTIVITY:
        result = await getContactActivity(args)
        break

      // ── Pipeline tools ──
      case ToolName.GET_PIPELINE_SUMMARY:
        result = await getPipelineSummary(args)
        break
      case ToolName.SEARCH_PURSUITS:
        result = await searchPursuits(args)
        break

      // ── Aggregate tools ──
      case ToolName.GET_TOP_LEADS:
        result = await getTopLeads(args)
        break
      case ToolName.GET_SIGNALS_DIGEST:
        result = await getSignalsDigest(args)
        break
      case ToolName.GET_ENGAGEMENT_STATS:
        result = await getEngagementStats(args)
        break

      // ── Knowledge tools ──
      case ToolName.SEARCH_KNOWLEDGE:
        result = await searchKnowledge(args)
        break
      case ToolName.GET_ACCOUNT_BRIEF:
        result = await getAccountBrief(args)
        break

      default:
        result = { success: false, data: [], error: `Unknown tool: ${name}` }
    }

    const durationMs = Date.now() - startTime
    logger.info(`[ai-tool-executor] ${name} completed in ${durationMs}ms, success=${result.success}`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`[ai-tool-executor] ${name} failed: ${msg}`)
    return { success: false, data: [], error: msg }
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────

function safeInt(val: unknown, fallback: number): number {
  const n = typeof val === 'number' ? val : parseInt(String(val), 10)
  return isNaN(n) ? fallback : Math.max(1, Math.min(n, 100))
}

function safeStr(val: unknown): string {
  return typeof val === 'string' ? val : ''
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function searchCompanies(args: Record<string, unknown>): Promise<ToolResult> {
  const query = safeStr(args.query)
  const industry = safeStr(args.industry)
  const priorityTier = safeStr(args.priority_tier)
  const minInt = safeInt(args.min_intelligence_score, 0)
  const limit = safeInt(args.limit, 10)

  const where: Record<string, unknown> = {}
  if (query) {
    where.OR = [
      { rawName: { contains: query, mode: 'insensitive' as const } },
      { domain: { contains: query, mode: 'insensitive' as const } },
      { normalizedName: { contains: query, mode: 'insensitive' as const } },
    ]
  }
  if (industry) where.industry = { contains: industry, mode: 'insensitive' as const }
  if (priorityTier) where.priorityTier = priorityTier
  if (minInt > 0) where.intelligenceScore = { gte: minInt }

  const companies = await db.company.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      sizeRange: true,
      status: true,
      priorityTier: true,
      intelligenceScore: true,
      engagementScore: true,
      accountPriorityScore: true,
      country: true,
      _count: { select: { contacts: true, signals: true } },
    },
    orderBy: { accountPriorityScore: 'desc' },
    take: Math.min(limit, 50),
  })

  return {
    success: true,
    data: companies.map((c) => ({
      id: c.id,
      name: c.rawName,
      domain: c.domain,
      industry: c.industry,
      size: c.sizeRange,
      status: c.status,
      priority: c.priorityTier,
      intelligenceScore: c.intelligenceScore,
      engagementScore: c.engagementScore,
      priorityScore: c.accountPriorityScore,
      country: c.country,
      contactsCount: c._count.contacts,
      signalsCount: c._count.signals,
    })),
  }
}

async function getCompanyDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const companyId = safeStr(args.company_id)
  if (!companyId) return { success: false, data: {}, error: 'company_id is required' }

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      contacts: {
        take: 10,
        orderBy: { leadScore: 'desc' },
        select: { id: true, rawName: true, email: true, title: true, leadScore: true, status: true },
      },
      researchCard: true,
      signals: { take: 10, orderBy: { extractedAt: 'desc' } },
      _count: { select: { contacts: true, signals: true, evidence: true, notes: true } },
    },
  })

  if (!company) return { success: false, data: {}, error: `Company not found: ${companyId}` }

  return {
    success: true,
    data: {
      id: company.id,
      name: company.rawName,
      domain: company.domain,
      website: company.website,
      industry: company.industry,
      sizeRange: company.sizeRange,
      country: company.country,
      location: company.location,
      status: company.status,
      lifecycleStage: company.lifecycleStage,
      priorityTier: company.priorityTier,
      intelligenceScore: company.intelligenceScore,
      engagementScore: company.engagementScore,
      accountPriorityScore: company.accountPriorityScore,
      tags: company.tags,
      totalContacts: company._count.contacts,
      totalSignals: company._count.signals,
      totalEvidence: company._count.evidence,
      totalNotes: company._count.notes,
      contacts: company.contacts,
      researchCard: company.researchCard
        ? {
            businessOverview: company.researchCard.businessOverview,
            techLandscape: company.researchCard.techLandscape,
            potentialChallenges: company.researchCard.potentialChallenges,
            possibleOpportunities: company.researchCard.possibleOpportunities,
            revenue: company.researchCard.revenue,
            employeeCount: company.researchCard.employeeCount,
            fundingStage: company.researchCard.fundingStage,
            keyPeople: company.researchCard.keyPeople,
          }
        : null,
      recentSignals: company.signals.slice(0, 5).map((s) => ({
        type: s.signalType,
        severity: s.severity,
        description: s.description,
        detectedAt: s.extractedAt,
      })),
    },
  }
}

async function getCompanySignals(args: Record<string, unknown>): Promise<ToolResult> {
  const companyId = safeStr(args.company_id)
  if (!companyId) return { success: false, data: [], error: 'company_id is required' }

  const signalType = safeStr(args.signal_type)
  const severity = safeStr(args.severity)
  const limit = safeInt(args.limit, 20)

  const where: Record<string, unknown> = { companyId }
  if (signalType) where.signalType = signalType
  if (severity) where.severity = severity

  const signals = await db.companySignal.findMany({
    where,
    orderBy: { extractedAt: 'desc' },
    take: Math.min(limit, 50),
    select: {
      id: true,
      signalType: true,
      severity: true,
      impact: true,
      confidence: true,
      description: true,
      businessImpact: true,
      recommendedAction: true,
      timingWindow: true,
      sourceQuality: true,
      extractedAt: true,
      status: true,
    },
  })

  return {
    success: true,
    data: signals.map((s) => ({
      id: s.id,
      type: s.signalType,
      severity: s.severity,
      impact: s.impact,
      confidence: s.confidence,
      description: s.description,
      businessImpact: s.businessImpact,
      recommendedAction: s.recommendedAction,
      timingWindow: s.timingWindow,
      sourceQuality: s.sourceQuality,
      detectedAt: s.extractedAt,
      status: s.status,
    })),
  }
}

async function getCompanyOpportunities(args: Record<string, unknown>): Promise<ToolResult> {
  const companyId = safeStr(args.company_id)
  if (!companyId) return { success: false, data: [], error: 'company_id is required' }

  const status = safeStr(args.status)

  const where: Record<string, unknown> = { companyId }
  if (status) where.status = status

  const opportunities = await db.opportunityRecommendation.findMany({
    where,
    orderBy: { opportunityScore: 'desc' },
    take: 20,
    select: {
      id: true,
      opportunityTitle: true,
      businessTrigger: true,
      whyNow: true,
      businessProblem: true,
      recommendedCapability: true,
      confidenceScore: true,
      opportunityScore: true,
      priority: true,
      status: true,
    },
  })

  return {
    success: true,
    data: opportunities,
  }
}

async function getCompanyScores(args: Record<string, unknown>): Promise<ToolResult> {
  const companyId = safeStr(args.company_id)
  if (!companyId) return { success: false, data: {}, error: 'company_id is required' }

  const [company, accountScore, health] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        intelligenceScore: true,
        engagementScore: true,
        accountPriorityScore: true,
        priorityTier: true,
      },
    }),
    db.accountScore.findUnique({ where: { companyId } }),
    db.companyIntelligenceHealth.findUnique({
      where: { companyId },
      select: {
        dataCompletenessScore: true,
        signalCoverageScore: true,
        evidenceCoverageScore: true,
        contactCoverageScore: true,
        overallHealthScore: true,
      },
    }),
  ])

  if (!company) return { success: false, data: {}, error: `Company not found: ${companyId}` }

  return {
    success: true,
    data: {
      intelligenceScore: company.intelligenceScore,
      engagementScore: company.engagementScore,
      accountPriorityScore: company.accountPriorityScore,
      priorityTier: company.priorityTier,
      revenueScore: accountScore ? { score: accountScore.score, category: accountScore.category } : null,
      healthScores: health
        ? {
            dataCompleteness: health.dataCompletenessScore,
            signalCoverage: health.signalCoverageScore,
            evidenceCoverage: health.evidenceCoverageScore,
            contactCoverage: health.contactCoverageScore,
            overallHealth: health.overallHealthScore,
          }
        : null,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function searchContacts(args: Record<string, unknown>): Promise<ToolResult> {
  const query = safeStr(args.query)
  const companyId = safeStr(args.company_id)
  const minScore = safeInt(args.min_lead_score, 0)
  const status = safeStr(args.status)
  const needsFollowUp = args.needs_follow_up === true
  const limit = safeInt(args.limit, 10)

  const where: Record<string, unknown> = {}
  if (query) {
    where.OR = [
      { rawName: { contains: query, mode: 'insensitive' as const } },
      { email: { contains: query, mode: 'insensitive' as const } },
      { title: { contains: query, mode: 'insensitive' as const } },
    ]
  }
  if (companyId) where.companyId = companyId
  if (minScore > 0) where.leadScore = { gte: minScore }
  if (status) where.status = status
  if (needsFollowUp) {
    const threshold = daysAgo(7)
    where.OR = [
      ...(Array.isArray(where.OR) ? where.OR : []),
      { lastContactedAt: null },
      { lastContactedAt: { lt: threshold } },
    ]
  }

  const contacts = await db.contact.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    select: {
      id: true,
      rawName: true,
      email: true,
      title: true,
      status: true,
      leadScore: true,
      companyFitScore: true,
      engagementScore: true,
      lastContactedAt: true,
      company: { select: { id: true, rawName: true, industry: true } },
    },
    orderBy: { leadScore: 'desc' },
    take: Math.min(limit, 50),
  })

  return {
    success: true,
    data: contacts.map((c) => ({
      id: c.id,
      name: c.rawName,
      email: c.email,
      title: c.title,
      status: c.status,
      leadScore: c.leadScore,
      companyFitScore: c.companyFitScore,
      engagementScore: c.engagementScore,
      lastContactedAt: c.lastContactedAt,
      company: c.company,
    })),
  }
}

async function getContactDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const contactId = safeStr(args.contact_id)
  if (!contactId) return { success: false, data: {}, error: 'contact_id is required' }

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: { select: { id: true, rawName: true, industry: true, domain: true } },
      drafts: { take: 5, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!contact) return { success: false, data: {}, error: `Contact not found: ${contactId}` }

  return {
    success: true,
    data: {
      id: contact.id,
      name: contact.rawName,
      email: contact.email,
      title: contact.title,
      status: contact.status,
      leadScore: contact.leadScore,
      companyFitScore: contact.companyFitScore,
      engagementScore: contact.engagementScore,
      enrichmentScore: contact.enrichmentScore,
      aiConversionScore: contact.aiConversionScore,
      emailHealth: contact.emailHealth,
      consentStatus: contact.consentStatus,
      lastContactedAt: contact.lastContactedAt,
      linkedinUrl: contact.linkedinUrl,
      phone: contact.phone,
      company: contact.company,
      recentDrafts: contact.drafts.map((d) => ({
        id: d.id,
        subject: d.subject,
        status: d.status,
        createdAt: d.createdAt,
      })),
    },
  }
}

async function getContactActivity(args: Record<string, unknown>): Promise<ToolResult> {
  const contactId = safeStr(args.contact_id)
  if (!contactId) return { success: false, data: {}, error: 'contact_id is required' }
  const days = safeInt(args.days, 30)

  const since = daysAgo(days)

  const [drafts, emailEvents, contact] = await Promise.all([
    db.draft.findMany({
      where: { contactId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, status: true, createdAt: true },
    }),
    db.emailEvent.findMany({
      where: { contactId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { eventType: true, createdAt: true, metadata: true },
    }),
    db.contact.findUnique({
      where: { id: contactId },
      select: { lastContactedAt: true, rawName: true },
    }),
  ])

  // Aggregate email events
  const eventCounts: Record<string, number> = {}
  for (const e of emailEvents) {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1
  }

  return {
    success: true,
    data: {
      contactName: contact?.rawName,
      period: `Last ${days} days`,
      lastContactedAt: contact?.lastContactedAt,
      emailsSent: eventCounts['open'] ? undefined : drafts.length,
      draftsCreated: drafts.length,
      recentDrafts: drafts.slice(0, 5),
      emailEvents: eventCounts,
      totalEvents: emailEvents.length,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE / PURSUIT TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getPipelineSummary(args: Record<string, unknown>): Promise<ToolResult> {
  const status = safeStr(args.status)

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const [pursuits, statusCounts] = await Promise.all([
    db.pursuit.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        company: { select: { id: true, rawName: true } },
        opportunity: { select: { opportunityTitle: true, opportunityScore: true } },
      },
    }),
    db.pursuit.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ])

  const statusSummary: Record<string, number> = {}
  for (const sc of statusCounts) {
    statusSummary[sc.status] = sc._count.id
  }

  return {
    success: true,
    data: {
      totalPursuits: pursuits.length,
      byStatus: statusSummary,
      recentPursuits: pursuits.map((p) => ({
        id: p.id,
        company: p.company?.rawName,
        title: p.opportunity?.opportunityTitle,
        status: p.status,
        priority: p.priority,
        nextAction: p.nextAction,
        owner: p.owner,
        updatedAt: p.updatedAt,
      })),
    },
  }
}

async function searchPursuits(args: Record<string, unknown>): Promise<ToolResult> {
  const query = safeStr(args.query)
  const status = safeStr(args.status)
  const limit = safeInt(args.limit, 10)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (query) {
    where.OR = [
      { company: { rawName: { contains: query, mode: 'insensitive' as const } } },
      { notes: { contains: query, mode: 'insensitive' as const } },
    ]
  }

  const pursuits = await db.pursuit.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      company: { select: { id: true, rawName: true, industry: true } },
      opportunity: { select: { opportunityTitle: true, opportunityScore: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 50),
  })

  return {
    success: true,
    data: pursuits.map((p) => ({
      id: p.id,
      company: p.company?.rawName,
      industry: p.company?.industry,
      title: p.opportunity?.opportunityTitle,
      status: p.status,
      priority: p.priority,
      nextAction: p.nextAction,
      owner: p.owner,
      outcomeStage: p.outcomeStage,
      updatedAt: p.updatedAt,
    })),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGGREGATE / ANALYTICS TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function getTopLeads(args: Record<string, unknown>): Promise<ToolResult> {
  const sortBy = safeStr(args.sort_by) || 'lead_score'
  const minScore = safeInt(args.min_score, 50)
  const limit = safeInt(args.limit, 10)

  // Build the orderBy based on sort preference
  const orderByMap: Record<string, { leadScore?: 'desc'; intelligenceScore?: 'desc'; engagementScore?: 'desc'; accountPriorityScore?: 'desc' }> = {
    lead_score: { leadScore: 'desc' },
    intelligence_score: { intelligenceScore: 'desc' },
    engagement_score: { engagementScore: 'desc' },
    account_priority: { accountPriorityScore: 'desc' },
  }

  const orderBy = orderByMap[sortBy] || { leadScore: 'desc' }

  const contacts = await db.contact.findMany({
    where: {
      status: { in: ['active', 'imported'] },
      ...(sortBy === 'intelligence_score' || sortBy === 'account_priority'
        ? {}
        : { leadScore: { gte: minScore } }),
    },
    select: {
      id: true,
      rawName: true,
      email: true,
      title: true,
      leadScore: true,
      companyFitScore: true,
      engagementScore: true,
      status: true,
      lastContactedAt: true,
      company: { select: { id: true, rawName: true, industry: true, priorityTier: true, intelligenceScore: true } },
    },
    orderBy,
    take: Math.min(limit, 50),
  })

  return {
    success: true,
    data: contacts.map((c) => ({
      id: c.id,
      name: c.rawName,
      email: c.email,
      title: c.title,
      leadScore: c.leadScore,
      companyFitScore: c.companyFitScore,
      engagementScore: c.engagementScore,
      status: c.status,
      lastContactedAt: c.lastContactedAt,
      company: c.company,
    })),
  }
}

async function getSignalsDigest(args: Record<string, unknown>): Promise<ToolResult> {
  const days = safeInt(args.days, 7)
  const signalType = safeStr(args.signal_type)
  const severity = safeStr(args.severity)
  const limit = safeInt(args.limit, 20)

  const since = daysAgo(days)

  const where: Record<string, unknown> = {
    extractedAt: { gte: since },
    status: { not: 'RESOLVED' },
  }
  if (signalType) where.signalType = signalType
  if (severity) where.severity = severity

  const signals = await db.companySignal.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { extractedAt: 'desc' }],
    take: Math.min(limit, 50),
    include: {
      company: { select: { id: true, rawName: true, industry: true } },
    },
  })

  return {
    success: true,
    data: {
      period: `Last ${days} days`,
      totalSignals: signals.length,
      signals: signals.map((s) => ({
        id: s.id,
        company: s.company?.rawName,
        industry: s.company?.industry,
        type: s.signalType,
        severity: s.severity,
        impact: s.impact,
        confidence: s.confidence,
        description: s.description,
        recommendedAction: s.recommendedAction,
        detectedAt: s.extractedAt,
      })),
    },
  }
}

async function getEngagementStats(args: Record<string, unknown>): Promise<ToolResult> {
  const days = safeInt(args.days, 30)
  const companyId = safeStr(args.company_id)

  const since = daysAgo(days)

  const whereBase: Record<string, unknown> = { createdAt: { gte: since } }
  if (companyId) whereBase.contact = { companyId }

  // Count email events by type
  const eventGroups = await db.emailEvent.groupBy({
    by: ['eventType'],
    where: companyId
      ? { createdAt: { gte: since }, contact: { companyId } }
      : { createdAt: { gte: since } },
    _count: { id: true },
  })

  const stats: Record<string, number> = {}
  for (const g of eventGroups) {
    stats[g.eventType] = g._count.id
  }

  return {
    success: true,
    data: {
      period: `Last ${days} days`,
      totalEvents: Object.values(stats).reduce((a, b) => a + b, 0),
      opens: stats['open'] || 0,
      clicks: stats['click'] || 0,
      replies: stats['reply'] || 0,
      bounces: stats['bounce'] || 0,
      unsubscribes: stats['unsubscribe'] || 0,
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE / INTELLIGENCE TOOLS
// ═══════════════════════════════════════════════════════════════════════════

async function searchKnowledge(args: Record<string, unknown>): Promise<ToolResult> {
  const query = safeStr(args.query)
  if (!query) return { success: false, data: [], error: 'query is required' }
  const category = safeStr(args.category)
  const limit = safeInt(args.limit, 10)

  // Search across knowledge entries, intelligence objects, and AI insights
  const [knowledgeEntries, insights] = await Promise.all([
    db.knowledgeEntry.findMany({
      where: {
        ...(category ? { category: category as never } : {}),
        OR: [
          { content: { contains: query, mode: 'insensitive' as const } },
          { subCategory: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 20),
      select: {
        id: true,
        category: true,
        subCategory: true,
        content: true,
        source: true,
        confidence: true,
        companyId: true,
      },
    }),
    db.aIInsight.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 20),
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        confidenceScore: true,
        impactScore: true,
        urgencyScore: true,
        recommendedAction: true,
        companyId: true,
      },
    }),
  ])

  return {
    success: true,
    data: {
      knowledgeEntries: knowledgeEntries.map((k) => ({
        id: k.id,
        category: k.category,
        subCategory: k.subCategory,
        content: k.content?.slice(0, 300),
        source: k.source,
        confidence: k.confidence,
      })),
      insights: insights.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        description: i.description?.slice(0, 300),
        confidence: i.confidenceScore,
        impact: i.impactScore,
        urgency: i.urgencyScore,
        recommendedAction: i.recommendedAction,
      })),
      totalResults: knowledgeEntries.length + insights.length,
    },
  }
}

async function getAccountBrief(args: Record<string, unknown>): Promise<ToolResult> {
  const companyId = safeStr(args.company_id)
  if (!companyId) return { success: false, data: {}, error: 'company_id is required' }

  const brief = await db.accountBrief.findUnique({
    where: { companyId },
  })

  if (!brief) {
    // Check if the company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { rawName: true },
    })
    if (!company) return { success: false, data: {}, error: `Company not found: ${companyId}` }
    return {
      success: true,
      data: {
        exists: false,
        companyName: company.rawName,
        message: 'No account brief has been generated yet. Run a research pipeline on this company first.',
      },
    }
  }

  return {
    success: true,
    data: {
      exists: true,
      companyName: brief.companyId,
      summary: brief.summary,
      accountHealth: brief.accountHealth,
      keySignals: brief.keySignals,
      themes: brief.themes,
      risks: brief.risks,
      opportunityAreas: brief.opportunityAreas,
      recommendedEngagement: brief.recommendedEngagement,
      confidence: brief.confidence,
    },
  }
}
