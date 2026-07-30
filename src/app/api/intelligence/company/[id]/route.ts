/**
 * GET /api/intelligence/company/{id}?include=signals,scores,contacts,timeline,actions,brief,knowledge,mindmap
 *
 * PRIMARY PRODUCT API — The ONLY call the frontend makes for company intelligence.
 *
 * Composes multiple engines into one unified IntelligenceResponse.
 * Each ?include= section is independently guarded: engine failures never
 * kill the whole response. Parallel engine calls use Promise.allSettled.
 *
 * Contract:
 *   - Returns IntelligenceResponse<IntelligenceCompanyContext>
 *   - All engine calls are wrapped in try/catch (non-throwing)
 *   - Confidence is the average of available engine confidences
 *   - Freshness is derived from company.lastEnrichedAt
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ScoringEngine } from '@/lib/engines/scoring-engine';
import type { RevenueScore } from '@/lib/engines/scoring-engine';
import { ActionEngine } from '@/lib/engines/action-engine';
import type { ActionResult } from '@/lib/engines/action-engine';
import { ConversationEngine } from '@/lib/engines/conversation-engine';
import type { ConversationResult } from '@/lib/engines/conversation-engine';
import {
  shouldInclude,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from '@/lib/intelligence-api/middleware';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import type {
  IntelligenceCompanyContext,
  IntelligenceResponse,
} from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';

// ── Engine references (static object exports, not classes) ──────────────────────
// ScoringEngine, ActionEngine, ConversationEngine are object literals with static methods

// ── GET handler ─────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Extract companyId from dynamic route ───────────────────────────────
  const { id: companyId } = await params;

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'company');
  if (guardResult instanceof Response) return guardResult;
  const { correlationId, responseHeaders } = guardResult;

  logger.info('[intelligence/company] Processing', {
    companyId,
    correlationId,
    includes: Array.from(guardResult.includes),
  });

  // ── Step 1: Load company from DB ───────────────────────────────────────
  type CompanyRow = {
    id: string; rawName: string; normalizedName: string; domain: string | null;
    industry: string | null; sizeRange: string | null; location: string | null;
    country: string | null; website: string | null; status: string; assignedTo: string | null;
    intelligenceScore: number | null; engagementScore: number | null;
    accountPriorityScore: number | null; priorityTier: string | null;
    createdAt: Date; updatedAt: Date; lastEnrichedAt: Date | null; lastActivityAt: Date | null;
  };

  let company: CompanyRow | null = null;
  try {
    company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        location: true,
        country: true,
        website: true,
        status: true,
        assignedTo: true,
        intelligenceScore: true,
        engagementScore: true,
        accountPriorityScore: true,
        priorityTier: true,
        createdAt: true,
        updatedAt: true,
        lastEnrichedAt: true,
        lastActivityAt: true,
      },
    });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[intelligence/company] DB lookup failed', { companyId, error: rawMessage });
    return Response.json(
      createErrorResponse(
        'company',
        companyId,
        `Company lookup failed: ${scrubError(rawMessage)}`,
        'INTELLIGENCE_UNAVAILABLE',
        Date.now() - startedAt,
        guardResult.includes,
      ),
      { status: 500, headers: responseHeaders },
    );
  }

  if (!company) {
    logger.warn('[intelligence/company] Company not found', { companyId });
    return Response.json(
      createErrorResponse(
        'company',
        companyId,
        'Company not found',
        'COMPANY_NOT_FOUND',
        Date.now() - startedAt,
        guardResult.includes,
      ),
      { status: 404, headers: responseHeaders },
    );
  }

  // ── Step 2: Conditionally load data sections ───────────────────────────

  // --- Signals ---
  let signals: IntelligenceCompanyContext['signals'] = undefined;
  if (shouldInclude(guardResult.includes, 'signals')) {
    try {
      const signalRecords = await db.companySignal.findMany({
        where: { companyId },
        orderBy: { extractedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          signalType: true,
          title: true,
          description: true,
          severity: true,
          impact: true,
          source: true,
          confidence: true,
          evidenceIds: true,
          extractedAt: true,
          companyId: true,
        },
      });
      signals = signalRecords.map((s) => ({
        id: s.id,
        signalType: s.signalType,
        title: s.title,
        summary: s.description ?? '',
        confidence: s.confidence,
        severity: s.severity,
        impact: s.impact,
        source: s.source ?? 'unknown',
        evidenceCount: Array.isArray(s.evidenceIds) ? (s.evidenceIds as unknown[]).length : 0,
        createdAt: s.extractedAt.toISOString(),
        companyId: s.companyId,
      }));
    } catch (err) {
      logger.warn('[intelligence/company] Failed to load signals', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Contacts ---
  let contacts: IntelligenceCompanyContext['contacts'] = undefined;
  if (shouldInclude(guardResult.includes, 'contacts')) {
    try {
      const contactRecords = await db.contact.findMany({
        where: { companyId },
        orderBy: { leadScore: 'desc' },
        take: 50,
        select: {
          id: true,
          rawName: true,
          title: true,
          email: true,
          role: true,
          phone: true,
          companyId: true,
          company: { select: { rawName: true } },
          leadScore: true,
          aiConversionScore: true,
          enrichmentScore: true,
          source: true,
          status: true,
          lastContactedAt: true,
        },
      });
      contacts = contactRecords.map((c) => ({
        id: c.id,
        rawName: c.rawName,
        title: c.title,
        email: c.email,
        role: c.role,
        phone: c.phone,
        companyId: c.companyId,
        companyName: c.company?.rawName ?? null,
        leadScore: c.leadScore ?? 0,
        confidence: (c.aiConversionScore ?? c.enrichmentScore ?? 0),
        status: c.status,
        source: c.source ?? null,
        lastActivityAt: c.lastContactedAt?.toISOString() ?? null,
      }));
    } catch (err) {
      logger.warn('[intelligence/company] Failed to load contacts', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Timeline ---
  let timeline: IntelligenceCompanyContext['timeline'] = undefined;
  if (shouldInclude(guardResult.includes, 'timeline')) {
    try {
      const timelineRecords = await db.companyTimelineEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          eventType: true,
          title: true,
          description: true,
          metadata: true,
          createdAt: true,
          companyId: true,
        },
      });
      timeline = timelineRecords.map((e) => ({
        id: e.id,
        type: e.eventType,
        title: e.title,
        description: e.description,
        metadata: (e.metadata as Record<string, unknown>) ?? {},
        createdAt: e.createdAt.toISOString(),
        companyId: e.companyId,
      }));
    } catch (err) {
      logger.warn('[intelligence/company] Failed to load timeline', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Knowledge (CapabilityAssets linked via FusionResult) ---
  let knowledge: IntelligenceCompanyContext['knowledge'] = undefined;
  if (shouldInclude(guardResult.includes, 'knowledge')) {
    try {
      // Load fusion results to find capability IDs linked to this company
      const fusionResults = await db.fusionResult.findMany({
        where: { companyId },
        select: {
          capabilityIds: true,
          businessProblem: true,
          recommendedCapability: true,
          relevantCaseStudy: true,
          proofPoints: true,
          fusionScore: true,
        },
        distinct: ['companyId'],
        take: 1,
      });

      // Extract unique capability IDs from all fusion results
      const allCapabilityIds: string[] = [];
      for (const fr of fusionResults) {
        const ids = fr.capabilityIds as unknown[];
        if (Array.isArray(ids)) {
          for (const capId of ids) {
            if (typeof capId === 'string' && !allCapabilityIds.includes(capId)) {
              allCapabilityIds.push(capId);
            }
          }
        }
      }

      // Load the actual capability assets
      let capabilities: Array<Record<string, unknown>> = [];
      let caseStudies: Array<Record<string, unknown>> = [];

      if (allCapabilityIds.length > 0) {
        const assets = await db.capabilityAsset.findMany({
          where: { id: { in: allCapabilityIds } },
          select: {
            id: true,
            title: true,
            summary: true,
            category: true,
            serviceLine: true,
            targetIndustries: true,
            problems: true,
            evidence: true,
          },
        });

        capabilities = assets
          .filter((a) => a.category !== 'case_study' && a.category !== 'proof_point')
          .map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            category: a.category,
            serviceLine: a.serviceLine,
            targetIndustries: a.targetIndustries,
            problems: a.problems,
          }));

        caseStudies = assets
          .filter((a) => a.category === 'case_study' || a.category === 'proof_point')
          .map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            category: a.category,
            evidence: a.evidence,
          }));
      }

      knowledge = { capabilities, caseStudies };
    } catch (err) {
      logger.warn('[intelligence/company] Failed to load knowledge', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Mindmap summary ---
  let mindmap: IntelligenceCompanyContext['mindmap'] = undefined;
  if (shouldInclude(guardResult.includes, 'mindmap')) {
    try {
      // Mindmap tables (mindmapNode/mindmapEdge) don't exist in Prisma schema yet.
      // Derive summary from contacts, signals, and capability counts.
      const [contactCount, signalCount, capabilityCount] = await Promise.all([
        db.contact.count({ where: { companyId } }),
        db.companySignal.count({ where: { companyId } }),
        db.capabilityAsset.count({ where: { isActive: true } }),
      ]);

      mindmap = {
        nodeCount: 1 + contactCount + signalCount + capabilityCount, // +1 for company center
        edgeCount: contactCount + signalCount + capabilityCount, // hub-and-spoke
        centerNode: (company.normalizedName as string) || (company.rawName as string) || '',
        categories: ['person', 'signal', 'knowledge'],
        lastGenerated: null,
      };
    } catch (err) {
      logger.warn('[intelligence/company] Failed to compute mindmap summary', {
        companyId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Step 3: Run engines in parallel (scores, actions, brief) ──────────
  const enginePromises: Record<string, Promise<unknown>> = {};

  if (shouldInclude(guardResult.includes, 'scores')) {
    enginePromises.scores = ScoringEngine.score({ companyId, skipNarrative: true });
  }

  if (shouldInclude(guardResult.includes, 'actions')) {
    enginePromises.actions = ActionEngine.recommend({ companyId, skipNarrative: true });
  }

  if (shouldInclude(guardResult.includes, 'brief')) {
    enginePromises.brief = ConversationEngine.brief({ companyId, skipNarrative: true });
  }

  // Resolve all engine calls in parallel — failures are captured, not thrown
  const engineResults = await Promise.allSettled(
    Object.entries(enginePromises).map(async ([key, promise]) => {
      try {
        const result = await promise;
        return { key, result };
      } catch (err) {
        return {
          key,
          result: {
            success: false,
            error: scrubError(err instanceof Error ? err.message : String(err)),
          },
        };
      }
    }),
  );

  // ── Step 4: Extract engine outputs ──────────────────────────────────────
  let scores: IntelligenceCompanyContext['scores'] = undefined;
  let actions: IntelligenceCompanyContext['actions'] = undefined;
  let brief: IntelligenceCompanyContext['brief'] = undefined;

  // Track confidences for aggregate computation
  const confidences: number[] = [];

  for (const settled of engineResults) {
    if (settled.status !== 'fulfilled') {
      const reason = (settled as PromiseRejectedResult).reason;
      logger.warn('[intelligence/company] Engine promise rejected', {
        error: reason instanceof Error ? reason.message : String(reason),
      });
      continue;
    }

    const { key, result } = settled.value as { key: string; result: RevenueScore | ActionResult | ConversationResult };

    if (key === 'scores') {
      const sr = result as RevenueScore;
      if (sr.success) {
        scores = {
          revenue: sr,
          accountPriority: company.accountPriorityScore
            ? { score: company.accountPriorityScore as number, tier: (company.priorityTier as string) ?? 'medium' }
            : undefined,
          intelConfidence: sr.confidence / 100,
        };
        confidences.push(sr.confidence / 100);
      } else {
        logger.warn('[intelligence/company] ScoringEngine returned failure', {
          companyId,
          error: sr.error,
        });
      }
    }

    if (key === 'actions') {
      const ar = result as ActionResult;
      if (ar.success) {
        actions = ar;
        if (ar.currentScore != null) {
          confidences.push(Math.min(ar.currentScore / 100, 1));
        }
      } else {
        logger.warn('[intelligence/company] ActionEngine returned failure', {
          companyId,
          error: ar.error,
        });
      }
    }

    if (key === 'brief') {
      const cr = result as unknown as Record<string, unknown>;
      if (cr.success as boolean) {
        const summary = (cr.meetingObjective as string) || (cr.companyContext as string) || '';
        const keyThemes = Array.isArray(cr.signalContext) ? (cr.signalContext as string[]) : [];
        const recommendations = Array.isArray(cr.postMeetingActions) ? (cr.postMeetingActions as string[]) : [];
        const briefConfidence = ((cr.confidenceScore as number) ?? 0) / 100;

        brief = {
          briefType: 'conversation_brief',
          content: [summary, ...keyThemes.map(t => `- ${t}`), ...recommendations.map(r => `- ${r}`)].join('\n'),
          sections: [{
            heading: 'Company Brief',
            body: summary || 'No summary available.',
            confidence: briefConfidence,
            citations: [],
          }],
          citations: [],
          evidenceChain: { evidences: [], aggregateConfidence: 0, coverage: 0, gaps: [], freshnessScore: 0 },
          wordCount: summary.split(/\s+/).filter(Boolean).length,
          modelUsed: 'conversation-engine',
          confidence: briefConfidence,
          durationMs: 0,
          tokensUsed: 0,
          costUsd: 0,
          warnings: [],
        };
        confidences.push(briefConfidence);
      } else {
        logger.warn('[intelligence/company] ConversationEngine.brief returned failure', {
          companyId,
          error: cr.error as string,
        });
      }
    }
  }

  // ── Step 5: Compute freshness & confidence ─────────────────────────────
  const freshness = computeFreshness(company as Parameters<typeof computeFreshness>[0]);

  // Average of available confidences; default to freshness-derived estimate
  const aggregateConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : freshness.score / 100;

  // ── Step 6: Load research card + key people ─────────────────────────────
  let researchCard: Record<string, unknown> | null = null;
  let keyPeople: IntelligenceCompanyContext['keyPeople'] = [];

  try {
    // Research card (best-effort)
    researchCard = await db.companyResearchCard.findUnique({
      where: { companyId },
      select: {
        businessOverview: true,
        techStack: true,
        keyPeople: true,
        recentNews: true,
        revenue: true,
        employeeCount: true,
        strategicPriorities: true,
        businessProblems: true,
      },
    });

    // Extract key people from research card if available
    if (researchCard?.keyPeople) {
      const people = researchCard.keyPeople as Array<{
        name: string;
        title: string;
        department?: string;
        linkedInUrl?: string;
      }>;
      if (Array.isArray(people)) {
        keyPeople = people.map((p) => ({
          name: p.name,
          title: p.title,
          department: p.department,
          linkedInUrl: p.linkedInUrl,
          source: 'research_card',
        }));
      }
    }
  } catch (err) {
    logger.warn('[intelligence/company] Failed to load research card / key people', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 7: Assemble IntelligenceCompanyContext ────────────────────────
  const data: IntelligenceCompanyContext = {
    company: {
      id: company.id,
      rawName: company.rawName,
      normalizedName: company.normalizedName,
      domain: company.domain,
      industry: company.industry,
      sizeRange: company.sizeRange,
      location: company.location,
      country: company.country,
      website: company.website,
      status: company.status,
      assignedTo: company.assignedTo,
      intelligenceScore: (company.intelligenceScore as number) ?? 0,
      engagementScore: (company.engagementScore as number) ?? 0,
      accountPriorityScore: company.accountPriorityScore as number | null,
      priorityTier: company.priorityTier as string | null,
      createdAt: (company.createdAt as Date).toISOString(),
      updatedAt: (company.updatedAt as Date).toISOString(),
    },
    researchCard,
    keyPeople,
    ...(signals != null && { signals }),
    ...(scores != null && { scores }),
    ...(contacts != null && { contacts }),
    ...(timeline != null && { timeline }),
    ...(actions != null && { actions }),
    ...(brief != null && { brief }),
    ...(knowledge != null && { knowledge }),
    ...(mindmap != null && { mindmap }),
    freshness,
  };

  // ── Step 8: Build & return envelope ─────────────────────────────────────
  const durationMs = Date.now() - startedAt;

  logger.info('[intelligence/company] Response assembled', {
    companyId,
    correlationId,
    durationMs,
    includes: Array.from(guardResult.includes),
    confidence: aggregateConfidence,
    freshnessLevel: freshness.level,
  });

  return Response.json(
    createResponse('company', companyId, data, {
      durationMs,
      includes: guardResult.includes,
      cached: false,
      confidence: aggregateConfidence,
      freshness,
      requestedAt,
      respondedAt: new Date(),
    }),
    { headers: responseHeaders },
  );
}
