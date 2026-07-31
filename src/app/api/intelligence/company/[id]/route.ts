/**
 * GET /api/intelligence/company/{id}?include=signals,scores,contacts,timeline,actions,brief,knowledge,mindmap
 *
 * PRIMARY PRODUCT API — The ONLY call the frontend makes for company intelligence.
 *
 * Composes multiple engines into one unified IntelligenceResponse.
 * Each ?include= section is independently guarded: engine failures never
 * kill the whole response. Parallel engine calls use Promise.allSettled.
 *
 * Supported includes: signals, scores, contacts, timeline, actions, brief, knowledge, mindmap, learning
 * Note: 'learning' is valid globally (used by action/conversation routes) but not applicable to this
 * endpoint — it will be silently ignored here since learning insights are not part of the company context.
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
  runGovernanceMetadata,
  safeNumber,
  SECURITY_HEADERS,
  classifyIntelligenceTier,
  parseRevenueBreakdown,
} from '@/lib/intelligence-api/middleware';
import { intelligenceGuard } from '@/lib/intelligence-api/guard';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';
import type {
  IntelligenceCompanyContext,
} from '@/lib/intelligence-api/types';
import { scrubError } from '@/lib/intelligence-api/handler';
import { logger } from '@/lib/logger';

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** A8: Safe type guard for Record<string, unknown> conversion */
function asRecord(obj: unknown): Record<string, unknown> {
  return (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
}

// ── Engine references (static object exports, not classes) ──────────────────────
// ScoringEngine, ActionEngine, ConversationEngine are object literals with static methods

// ── GET handler ─────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startedAt = Date.now();
  const requestedAt = new Date();

  // ── Intelligence Guard: validation + rate limiting + correlation-id ─────
  const guardResult = await intelligenceGuard(request, params, 'company');
  if (guardResult instanceof Response) return guardResult;
  const { companyId, correlationId, responseHeaders } = guardResult;

  // E1: Use shared governance helper instead of 12-line inline block
  const governanceMeta = await runGovernanceMetadata(companyId, 'company_intelligence');

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
    logger.error('[intelligence/company] DB lookup failed', { companyId, correlationId, error: rawMessage });
    return Response.json(
      createErrorResponse(
        'company',
        companyId,
        `Company lookup failed: ${scrubError(rawMessage)}`,
        IntelligenceErrors.INTELLIGENCE_UNAVAILABLE,
        Date.now() - startedAt,
        guardResult.includes,
      ),
      {
        status: 500,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/json',
          ...responseHeaders,
        },
      },
    );
  }

  if (!company) {
    logger.warn('[intelligence/company] Company not found', { companyId, correlationId });
    return Response.json(
      createErrorResponse(
        'company',
        companyId,
        'Company not found',
        IntelligenceErrors.COMPANY_NOT_FOUND,
        Date.now() - startedAt,
        guardResult.includes,
      ),
      {
        status: 404,
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'application/json',
          ...responseHeaders,
        },
      },
    );
  }

  // ── Step 2: Load lightweight revenue summary from AccountScore (always, for base response) ────
  let revenueSummary: { score: number; category: string } | null = null;
  try {
    const accountScore = await db.accountScore.findUnique({
      where: { companyId },
      select: { score: true, category: true },
    });
    if (accountScore) {
      revenueSummary = { score: accountScore.score, category: accountScore.category };
    }
  } catch (err) {
    // B1: Log instead of swallowing
    logger.debug('[intelligence/company] AccountScore lookup failed', {
      companyId,
      correlationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Step 2b: Conditionally load data sections (PARALLEL) ──────────────────
  // B15: Use Promise.allSettled so one rejection doesn't kill all results
  const settledSections = await Promise.allSettled([
    // Signals
    shouldInclude(guardResult.includes, 'signals')
      ? db.companySignal.findMany({
          where: { companyId },
          orderBy: { extractedAt: 'desc' },
          take: 20,
          select: {
            id: true, signalType: true, title: true, description: true,
            severity: true, impact: true, source: true, confidence: true,
            evidenceIds: true, extractedAt: true, companyId: true,
          },
        }).then(records => records.map((s) => ({
          id: s.id, signalType: s.signalType, title: s.title,
          summary: s.description ?? '', confidence: s.confidence,
          severity: s.severity, impact: s.impact, source: s.source ?? 'unknown',
          evidenceCount: Array.isArray(s.evidenceIds) ? (s.evidenceIds as unknown[]).length : 0,
          createdAt: s.extractedAt.toISOString(), companyId: s.companyId,
        }))).catch(err => {
          logger.warn('[intelligence/company] Failed to load signals', {
            companyId, correlationId, error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
      : Promise.resolve(undefined),

    // Contacts
    shouldInclude(guardResult.includes, 'contacts')
      ? db.contact.findMany({
          where: { companyId },
          orderBy: { leadScore: 'desc' },
          take: 50,
          select: {
            id: true, rawName: true, title: true, email: true, role: true,
            phone: true, companyId: true, company: { select: { rawName: true } },
            leadScore: true, aiConversionScore: true, enrichmentScore: true,
            source: true, status: true, lastContactedAt: true,
          },
        }).then(records => records.map((c) => ({
          id: c.id, rawName: c.rawName, title: c.title, email: c.email,
          role: c.role, phone: c.phone, companyId: c.companyId,
          companyName: c.company?.rawName ?? null, leadScore: c.leadScore ?? 0,
          confidence: (c.aiConversionScore ?? c.enrichmentScore ?? 0),
          status: c.status, source: c.source ?? null,
          lastActivityAt: c.lastContactedAt?.toISOString() ?? null,
        }))).catch(err => {
          logger.warn('[intelligence/company] Failed to load contacts', {
            companyId, correlationId, error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
      : Promise.resolve(undefined),

    // Timeline
    shouldInclude(guardResult.includes, 'timeline')
      ? db.companyTimelineEvent.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, eventType: true, title: true, description: true,
            metadata: true, createdAt: true, companyId: true,
          },
        }).then(records => records.map((e) => ({
          id: e.id, type: e.eventType, title: e.title,
          description: e.description,
          // I8: metadata is untyped JSON — trusted internal data from enrichment pipeline
          metadata: (e.metadata as Record<string, unknown>) ?? {},
          createdAt: e.createdAt.toISOString(), companyId: e.companyId,
        }))).catch(err => {
          logger.warn('[intelligence/company] Failed to load timeline', {
            companyId, correlationId, error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
      : Promise.resolve(undefined),

    // Knowledge (CapabilityAssets linked via FusionResult)
    shouldInclude(guardResult.includes, 'knowledge')
      ? (async () => {
          // Load fusion results to find capability IDs linked to this company
          const fusionResults = await db.fusionResult.findMany({
            where: { companyId },
            select: {
              capabilityIds: true, businessProblem: true,
              recommendedCapability: true, relevantCaseStudy: true,
              proofPoints: true, fusionScore: true,
            },
            distinct: ['companyId'],
            take: 1,
          });

          // D14: Use Set for O(1) lookup instead of Array.includes O(n²)
          const allCapabilityIds = new Set<string>();
          for (const fr of fusionResults) {
            // D15: Array.isArray guard already present
            const ids = fr.capabilityIds as unknown[];
            if (Array.isArray(ids)) {
              for (const capId of ids) {
                if (typeof capId === 'string') {
                  allCapabilityIds.add(capId);
                }
              }
            }
          }

          // Load the actual capability assets
          let capabilities: Array<Record<string, unknown>> = [];
          let caseStudies: Array<Record<string, unknown>> = [];

          if (allCapabilityIds.size > 0) {
            const assets = await db.capabilityAsset.findMany({
              where: { id: { in: Array.from(allCapabilityIds) } },
              select: {
                id: true, title: true, summary: true, category: true,
                serviceLine: true, targetIndustries: true, problems: true, evidence: true,
              },
            });

            capabilities = assets
              .filter((a) => a.category !== 'case_study' && a.category !== 'proof_point')
              .map((a) => ({
                id: a.id, title: a.title, summary: a.summary, category: a.category,
                serviceLine: a.serviceLine, targetIndustries: a.targetIndustries,
                problems: a.problems,
              }));

            caseStudies = assets
              .filter((a) => a.category === 'case_study' || a.category === 'proof_point')
              .map((a) => ({
                id: a.id, title: a.title, summary: a.summary, category: a.category,
                evidence: a.evidence,
              }));
          }

          return { capabilities, caseStudies };
        })().catch(err => {
          logger.warn('[intelligence/company] Failed to load knowledge', {
            companyId, correlationId, error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
      : Promise.resolve(undefined),

    // Mindmap summary
    shouldInclude(guardResult.includes, 'mindmap')
      ? (async () => {
          const [contactCount, signalCount, companyFusionResults] = await Promise.all([
            db.contact.count({ where: { companyId } }),
            db.companySignal.count({ where: { companyId } }),
            db.fusionResult.findMany({
              where: { companyId },
              select: { capabilityIds: true },
            }),
          ]);

          // Derive company-specific capability count from fusion results
          const allCapIds = new Set<string>();
          for (const fr of companyFusionResults) {
            const ids = fr.capabilityIds as unknown[];
            if (Array.isArray(ids)) {
              for (const id of ids) {
                if (typeof id === 'string') allCapIds.add(id);
              }
            }
          }
          const capabilityCount = allCapIds.size;

          return {
            nodeCount: 1 + contactCount + signalCount + capabilityCount, // +1 for company center
            edgeCount: contactCount + signalCount + capabilityCount, // hub-and-spoke
            // A17: normalizedName could be null — fall back through rawName then literal
            centerNode: company.normalizedName || company.rawName || 'Company',
            categories: ['person', 'signal', 'knowledge'],
            lastGenerated: null,
          };
        })().catch(err => {
          logger.warn('[intelligence/company] Failed to compute mindmap summary', {
            companyId, correlationId, error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
      : Promise.resolve(undefined),

    // Research card (always loaded)
    (async () => {
      let researchCard: Record<string, unknown> | null = null;
      let keyPeople: IntelligenceCompanyContext['keyPeople'] = [];
      try {
        researchCard = await db.companyResearchCard.findUnique({
          where: { companyId },
          select: {
            businessOverview: true, techStack: true, keyPeople: true,
            recentNews: true, revenue: true, employeeCount: true,
            strategicPriorities: true, businessProblems: true,
          },
        });

        // Extract key people from research card if available
        if (researchCard?.keyPeople) {
          const people = researchCard.keyPeople as Array<{
            name: string; title: string; department?: string; linkedInUrl?: string;
          }>;
          if (Array.isArray(people)) {
            keyPeople = people.map((p) => ({
              name: p.name, title: p.title, department: p.department,
              linkedInUrl: p.linkedInUrl, source: 'research_card',
            }));
          }
        }
      } catch (err) {
        logger.warn('[intelligence/company] Failed to load research card / key people', {
          companyId, correlationId, error: err instanceof Error ? err.message : String(err),
        });
      }
      return { researchCard, keyPeople };
    })(),
  ]);

  // B15: Safely extract results from settled promises
  const signals = settledSections[0].status === 'fulfilled' ? settledSections[0].value : undefined;
  const contacts = settledSections[1].status === 'fulfilled' ? settledSections[1].value : undefined;
  const timeline = settledSections[2].status === 'fulfilled' ? settledSections[2].value : undefined;
  const knowledge = settledSections[3].status === 'fulfilled' ? settledSections[3].value : undefined;
  const mindmap = settledSections[4].status === 'fulfilled' ? settledSections[4].value : undefined;
  const loadedResearchCard = settledSections[5].status === 'fulfilled'
    ? settledSections[5].value as { researchCard: Record<string, unknown> | null; keyPeople: IntelligenceCompanyContext['keyPeople'] }
    : { researchCard: null, keyPeople: [] };

  const { researchCard, keyPeople } = loadedResearchCard;

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
        companyId, correlationId,
        error: reason instanceof Error ? reason.message : String(reason),
      });
      continue;
    }

    const { key, result } = settled.value;

    if (key === 'scores' && result) {
      const sr = result as RevenueScore;
      // H6 FIX: Type guard instead of unchecked 'in' check
      if (sr && typeof sr === 'object' && 'success' in sr && sr.success) {
        // Fetch persisted AccountScore (Revenue Opportunity)
        let accountScoreRecord: { score: number; scoreBreakdown: unknown; category: string; calculatedAt: Date } | null = null;
        try {
          accountScoreRecord = await db.accountScore.findUnique({
            where: { companyId },
          });
        } catch (err) {
          // B2: Log instead of swallowing
          logger.debug('[intelligence/company] AccountScore lookup failed (scores path)', {
            companyId,
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // E6: Use shared parseRevenueBreakdown (single source of truth)
        let revenueOpportunity: IntelligenceCompanyContext['scores'] extends undefined ? never : NonNullable<NonNullable<IntelligenceCompanyContext['scores']>>['revenueOpportunity'];
        if (accountScoreRecord) {
          try {
            const { breakdown, isLegacy } = parseRevenueBreakdown(accountScoreRecord.scoreBreakdown);
            if (breakdown) {
              revenueOpportunity = {
                score: accountScoreRecord.score,
                category: accountScoreRecord.category,
                breakdown,
              };
              if (isLegacy) {
                logger.debug('[intelligence/company] Legacy scoreBreakdown detected', { companyId });
              }
            }
          } catch {
            // B3: Log parse failure
            logger.debug('[intelligence/company] Failed to parse scoreBreakdown', { companyId, correlationId });
          }
        }

        // E3: Use shared tier classification function
        const intelScore = safeNumber(company.intelligenceScore, 0);
        const intelTier = classifyIntelligenceTier(intelScore);

        scores = {
          intelligence: { score: intelScore, tier: intelTier },
          accountPriority: company.accountPriorityScore
            ? { score: company.accountPriorityScore, tier: company.priorityTier ?? 'NURTURE' }
            : undefined,
          revenue: sr,
          ...(revenueOpportunity && { revenueOpportunity }),
        };
        // D6: Clamp confidence to [0,1] — handle both 0-100 and 0-1 range
        const rawConf = sr.confidence ?? 0;
        confidences.push(Math.min(1, rawConf > 1 ? rawConf / 100 : rawConf));
      } else if (sr && typeof sr === 'object' && 'error' in sr && sr.error) {
        logger.warn('[intelligence/company] ScoringEngine returned failure', {
          companyId, correlationId,
          error: String(sr.error),
        });
      }
    }

    if (key === 'actions' && result) {
      const ar = result as ActionResult;
      // H8 FIX: Type guard
      if (ar && typeof ar === 'object' && 'success' in ar && ar.success) {
        actions = ar;
        if (ar.currentScore != null) {
          confidences.push(Math.min(ar.currentScore / 100, 1));
        }
      } else if (ar && typeof ar === 'object' && 'error' in ar && ar.error) {
        logger.warn('[intelligence/company] ActionEngine returned failure', {
          companyId, correlationId,
          error: String(ar.error),
        });
      }
    }

    if (key === 'brief' && result) {
      // A8: Use asRecord helper instead of unchecked cast
      const cr = asRecord(result);
      if (cr && typeof cr === 'object' && cr.success === true) {
        const summary = String(cr.meetingObjective || cr.companyContext || '');
        const keyThemes = Array.isArray(cr.signalContext) ? cr.signalContext.map(String) : [];
        const recommendations = Array.isArray(cr.postMeetingActions) ? cr.postMeetingActions.map(String) : [];
        const briefConfidence = Number(cr.confidenceScore ?? 0) / 100;

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
          // D2: Simple whitespace split; CJK text may undercount slightly
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
          companyId, correlationId,
          error: String(cr.error ?? ''),
        });
      }
    }
  }

  // ── Step 5: Compute freshness & confidence ─────────────────────────────
  // A7: CompanyRow satisfies computeFreshness parameter shape — no cast needed
  const freshness = computeFreshness(company);

  // Average of available confidences; default to freshness-derived estimate
  const aggregateConfidence =
    confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : freshness.score / 100;

  // ── Step 6: Assemble IntelligenceCompanyContext ────────────────────────
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
      // D1: Use safeNumber to guard against NaN from DB — ?? doesn't catch NaN
      intelligenceScore: safeNumber(company.intelligenceScore, 0),
      engagementScore: safeNumber(company.engagementScore, 0),
      accountPriorityScore: company.accountPriorityScore as number | null,
      priorityTier: company.priorityTier as string | null,
      createdAt: (company.createdAt as Date).toISOString(),
      updatedAt: (company.updatedAt as Date).toISOString(),
    },
    researchCard,
    keyPeople,
    ...(revenueSummary && { revenueSummary }),
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

  // ── Step 7: Build & return envelope ─────────────────────────────────────
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
      ...(governanceMeta && { governance: governanceMeta }),
    }),
    {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        ...responseHeaders,
      },
    },
  );
}
