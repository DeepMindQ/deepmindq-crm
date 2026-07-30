/**
 * POST /api/intelligence/unified
 *
 * Intelligence API — Unified Intelligence Query Endpoint
 *
 * Answers: "What do we know about this company?"
 * Combines ALL intelligence sources into a single view:
 *   1. External Intelligence (signals, evidence, web research)
 *   2. Internal Memory (notes, meetings, timeline, human intel, account strategy)
 *   3. People Intelligence (contacts, stakeholder profiles, relationship mapping)
 *
 * Accepts: { companyId: string, includeActions?: boolean }
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';
import { scrubError } from '@/lib/intelligence-api/handler';

export async function POST(request: NextRequest) {
  let correlationId;
  let responseHeaders;
  try {
    const ctx = utilityGuard(request, 'unified');
    correlationId = ctx.correlationId;
    responseHeaders = ctx.responseHeaders;
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }

  const startedAt = Date.now();

  try {
    const body = await request.json()
    const { companyId, includeActions } = body as { companyId?: string; includeActions?: boolean }

    if (!companyId || typeof companyId !== 'string') {
      return Response.json(
        { success: false, error: 'companyId is required (string)', meta: { endpoint: 'unified', durationMs: Date.now() - startedAt } },
        { status: 400 },
      )
    }

    // Fetch company
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        industry: true,
        domain: true,
        sizeRange: true,
        country: true,
        internalSummary: true,
        lifecycleStage: true,
        intelligenceScore: true,
        engagementScore: true,
        accountPriorityScore: true,
        priorityTier: true,
      },
    })

    if (!company) {
      return Response.json(
        { success: false, error: 'Company not found', meta: { endpoint: 'unified', durationMs: Date.now() - startedAt } },
        { status: 404 },
      )
    }

    const companyName = company.normalizedName || company.rawName

    // Parallel fetch all three intelligence layers
    const [
      // Layer 1: External Intelligence
      externalSignals,
      evidence,
      researchCard,
      // Layer 2: Internal Memory
      companyNotes,
      contactNotesData,
      timelineEvents,
      humanIntel,
      accountStrategy,
      // Layer 3: People Intelligence
      contacts,
    ] = await Promise.all([
      // External: Active signals from Sprint 1/2
      db.companySignal.findMany({
        where: { companyId, status: { in: ['detected', 'validated', 'active'] } },
        orderBy: { confidence: 'desc' },
        take: 20,
        select: {
          id: true, signalType: true, title: true, description: true,
          severity: true, confidence: true, businessImpact: true,
          recommendedAction: true, timingWindow: true, signalDate: true,
          sourceUrl: true, source: true, createdAt: true,
        },
      }),

      // External: Evidence records
      db.evidence.findMany({
        where: { companyId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, sourceUrl: true, snippet: true, confidence: true, extractedField: true },
      }),

      // External: Research card
      db.companyResearchCard.findUnique({
        where: { companyId },
        select: {
          businessOverview: true, techStack: true, keyPeople: true,
          recentNews: true, revenue: true, employeeCount: true,
          strategicPriorities: true, businessProblems: true,
        },
      }),

      // Internal: Company notes
      db.companyNote.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { id: true, title: true, category: true, body: true, author: true, createdAt: true, pinned: true },
      }),

      // Internal: Contact notes
      db.contactNote.findMany({
        where: { contact: { companyId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, body: true, createdAt: true,
          contact: { select: { rawName: true, title: true, email: true } },
        },
      }),

      // Internal: Timeline events
      db.companyTimelineEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, eventType: true, title: true, description: true, createdAt: true },
      }),

      // Internal: Human intelligence
      db.humanIntelligenceInbox.findMany({
        where: { companyId, status: { in: ['pending', 'reviewed', 'approved', 'converted'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, content: true, summary: true, priority: true, submittedBy: true, createdAt: true },
      }),

      // Internal: Account strategy
      db.accountStrategy.findFirst({
        where: { companyId },
        select: { swotAnalysis: true, stakeholderMap: true, keyInitiatives: true },
      }),

      // People: Contacts
      db.contact.findMany({
        where: { companyId, status: { not: 'archived' } },
        orderBy: { leadScore: 'desc' },
        take: 15,
        select: {
          id: true, rawName: true, email: true, title: true, role: true,
          location: true, leadScore: true, engagementScore: true, status: true,
          linkedinUrl: true, lastContactedAt: true,
          _count: { select: { replies: true } },
        },
      }),
    ])

    // Extract internal memory signals via connector
    let internalMemorySignals: Array<{
      signalType: string; title: string; description: string; source: string;
      confidence: number; businessImpact: string; recommendedAction: string; severity: string;
    }> = []
    try {
      const { extractInternalMemorySignals } = await import('@/lib/intelligence-sources/internal-memory-connector')
      const memResult = await extractInternalMemorySignals(companyId)
      internalMemorySignals = memResult.signals.slice(0, 15).map(s => ({
        signalType: s.signalType,
        title: s.signal,
        description: s.evidence,
        source: s.sourceName,
        confidence: Math.round(s.confidence * 100),
        businessImpact: s.businessImpact,
        recommendedAction: s.recommendedAction,
        severity: s.severity,
      }))
    } catch (err) {
      logger.warn('[unified] Internal memory extraction failed:', { error: err instanceof Error ? err.message : err })
    }

    // Calculate intelligence balance
    const externalCount = externalSignals.length
    const internalCount = companyNotes.length + contactNotesData.length + timelineEvents.length + humanIntel.length
    const peopleCount = contacts.length
    const totalIntel = externalCount + internalCount + internalMemorySignals.length
    const intelligenceBalance =
      totalIntel === 0 ? 'empty' :
      internalCount > externalCount * 2 ? 'internal_heavy' :
      externalCount > internalCount * 2 ? 'external_heavy' : 'balanced'

    // Build response
    const data: Record<string, unknown> = {
      company: {
        id: company.id,
        name: companyName,
        industry: company.industry,
        domain: company.domain,
        sizeRange: company.sizeRange,
        country: company.country,
        lifecycleStage: company.lifecycleStage,
        priorityTier: company.priorityTier,
        intelligenceScore: company.intelligenceScore,
        engagementScore: company.engagementScore,
      },
      // Layer 1: External Intelligence
      external: {
        signalsCount: externalCount,
        signals: externalSignals.map(s => ({
          type: s.signalType,
          title: s.title,
          severity: s.severity,
          confidence: Math.round(s.confidence * 100),
          impact: s.businessImpact,
          action: s.recommendedAction,
          timing: s.timingWindow,
          source: s.sourceUrl || s.source || 'unknown',
          date: s.signalDate || s.createdAt,
        })),
        evidenceCount: evidence.length,
        researchAvailable: !!researchCard,
        research: researchCard ? {
          overview: researchCard.businessOverview,
          techStack: researchCard.techStack,
          revenue: researchCard.revenue,
          employees: researchCard.employeeCount,
        } : null,
      },
      // Layer 2: Internal Memory
      internal: {
        notesCount: companyNotes.length,
        notes: companyNotes.slice(0, 10).map(n => ({
          id: n.id,
          title: n.title,
          category: n.category,
          preview: n.body.substring(0, 150),
          author: n.author,
          pinned: n.pinned,
          daysAgo: Math.floor((Date.now() - n.createdAt.getTime()) / 86400000),
        })),
        contactNotesCount: contactNotesData.length,
        contactNotes: contactNotesData.slice(0, 5).map(cn => ({
          contact: cn.contact.rawName,
          role: cn.contact.title,
          preview: cn.body.substring(0, 100),
          daysAgo: Math.floor((Date.now() - cn.createdAt.getTime()) / 86400000),
        })),
        timelineCount: timelineEvents.length,
        timeline: timelineEvents.slice(0, 8).map(e => ({
          type: e.eventType,
          title: e.title,
          daysAgo: Math.floor((Date.now() - e.createdAt.getTime()) / 86400000),
        })),
        humanIntelligenceCount: humanIntel.length,
        humanIntel: humanIntel.slice(0, 3).map(h => ({
          summary: h.summary || h.content.substring(0, 100),
          priority: h.priority,
          submittedBy: h.submittedBy,
        })),
        accountStrategyAvailable: !!accountStrategy,
        internalSignalsCount: internalMemorySignals.length,
        internalSignals: internalMemorySignals,
      },
      // Layer 3: People Intelligence
      people: {
        contactsCount: peopleCount,
        contacts: contacts.map(c => ({
          id: c.id,
          name: c.rawName,
          title: c.title,
          email: c.email,
          leadScore: c.leadScore,
          engagementScore: c.engagementScore,
          status: c.status,
          hasReplies: c._count.replies > 0,
          replyCount: c._count.replies,
          daysSinceContact: c.lastContactedAt
            ? Math.floor((Date.now() - c.lastContactedAt.getTime()) / 86400000)
            : null,
          linkedin: !!c.linkedinUrl,
        })),
        departments: [...new Set(
          contacts
            .map(c => {
              const t = (c.title || '').toLowerCase()
              if (/ceo|president|founder|coo|cfo|cto|cio|cmo|cso/.test(t)) return 'C-Suite'
              if (/vp|vice president|svp|evp/.test(t)) return 'VP'
              if (/director|head|lead/.test(t)) return 'Director'
              if (/manager|senior manager/.test(t)) return 'Manager'
              if (/engineer|developer|architect|devops/.test(t)) return 'Engineering'
              if (/sales|revenue|account/.test(t)) return 'Sales'
              if (/marketing|growth|brand/.test(t)) return 'Marketing'
              if (/security|ciso/.test(t)) return 'Security'
              return 'Other'
            })
            .filter(Boolean)
        )],
      },
      // Summary
      meta: {
        totalIntelligencePoints: totalIntel + peopleCount,
        intelligenceBalance,
        externalSignalsCount: externalCount,
        internalDataPoints: internalCount,
        peopleCount,
        pipelineLatencyMs: Date.now() - startedAt,
      },
    }

    // Optionally include action artifacts
    if (includeActions) {
      const actions = await db.actionArtifact.findMany({
        where: { companyId, status: { in: ['draft', 'approved'] } },
        orderBy: { generatedAt: 'desc' },
      })
      const seen = new Set<string>()
      const uniqueActions: Array<{
        type: string; summary: string; priority: number;
        confidence: number; generatedAt: Date;
      }> = []
      for (const a of actions) {
        if (seen.has(a.actionType)) continue
        seen.add(a.actionType)
        uniqueActions.push({
          type: a.actionType,
          summary: a.summary,
          priority: a.priorityScore,
          confidence: Math.round(a.confidence * 100),
          generatedAt: a.generatedAt,
        })
      }
      data.actions = uniqueActions
    }

    return Response.json({
      success: true,
      data,
      meta: { endpoint: 'unified', durationMs: Date.now() - startedAt },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[intelligence/unified] Query error:', { detail: message })
    return Response.json(
      { success: false, error: `Unified intelligence query failed: ${message}`, meta: { endpoint: 'unified', durationMs: Date.now() - startedAt } },
      { status: 502 },
    )
  }
}
