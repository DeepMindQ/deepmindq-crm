import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { governedAICallAggregate } from '@/lib/ai-governance';
import { logger } from '@/lib/logger';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  utilityError,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   COMMAND CENTER — Unified Insights Endpoint (Ticket 5)

   Returns the Ticket 5 spec shape:
     - kpis: { totalAccounts, activeSignals, avgIntelligenceScore, pendingActions }
     - recentSignals: CompanySignal[]
     - topOpportunities: OpportunityRecommendation[]
     - systemHealth: { engines, aiStatus }
     - intelligenceFeed: recent events
     - morningBrief: AI-generated executive brief (optional, cached 5 min)

   Architecture: utilityGuard for rate limiting + correlation-id + scrubError.
   Uses Response.json via utilitySuccess for consistent envelope.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Zod schema for LLM response validation ──

const morningBriefSchema = z.object({
  greeting: z.string().optional().default(''),
  executiveSummary: z.string().optional().default(''),
  topTargets: z.array(z.object({
    companyId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    intelligenceScore: z.number(),
    whyNow: z.array(z.string()),
    decisionMakers: z.array(z.object({ name: z.string(), title: z.string(), email: z.string() })),
    recommendedAction: z.string(),
    suggestedMessage: z.string(),
    evidenceCount: z.number(),
    signalCount: z.number(),
    confidence: z.number(),
  })).optional().default([]),
  newIntelligence: z.array(z.object({
    companyId: z.string(),
    companyName: z.string(),
    signal: z.string(),
    severity: z.string(),
    date: z.string(),
  })).optional().default([]),
  actionsDue: z.array(z.object({
    companyId: z.string(),
    companyName: z.string(),
    action: z.string(),
    urgency: z.string(),
  })).optional().default([]),
});

type MorningBriefAI = z.infer<typeof morningBriefSchema>;

// ── Cache ──
let aiCache: { data: MorningBriefAI; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── LLM helper — governed aggregate call ──
async function callBriefAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await governedAICallAggregate({
    generationType: 'command_center_analysis',
    systemPrompt,
    userPrompt,
    tier: 'smart',
    maxTokens: 4096,
    temperature: 0.5,
  });
  if (!result.success) throw new Error(result.rejectionReason || 'AI brief failed');
  return result.response!;
}

// ── Fetch all data needed for the unified insights response ──
async function fetchInsightsData() {
  const [
    totalAccounts,
    activeSignals,
    avgScoreResult,
    pendingActions,
    recentSignals,
    topOpportunities,
    intelligenceFeed,
    recentEnrichedCount,
    engineRuns,
    recentAIGenerations,
  ] = await Promise.all([
    // KPI 1: totalAccounts
    db.company.count({ where: { status: { not: 'archived' } } }),
    // KPI 2: activeSignals
    db.companySignal.count({ where: { status: { notIn: ['archived', 'expired'] } } }),
    // KPI 3: avgIntelligenceScore
    db.company.aggregate({
      where: { status: { not: 'archived' }, intelligenceScore: { gte: 0 } },
      _avg: { intelligenceScore: true },
    }),
    // KPI 4: pendingActions (active recommendations)
    db.opportunityRecommendation.count({ where: { status: { in: ['pending_review', 'accepted', 'monitored'] } } }),
    // recentSignals: last 20 active signals with company info
    db.companySignal.findMany({
      where: { status: { notIn: ['archived', 'expired'] } },
      include: {
        company: { select: { id: true, rawName: true, industry: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // topOpportunities: top 10 by opportunityScore
    db.opportunityRecommendation.findMany({
      where: { status: { notIn: ['rejected'] } },
      include: {
        company: { select: { id: true, rawName: true, industry: true } },
      },
      orderBy: { opportunityScore: 'desc' },
      take: 10,
    }),
    // intelligenceFeed: recent events from timeline
    db.companyTimelineEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        companyId: true,
        eventType: true,
        title: true,
        description: true,
        createdAt: true,
      },
    }),
    // For AI brief context: enriched company count
    db.company.count({ where: { lastEnrichedAt: { not: null } } }),
    // System health: last 20 runs per engine
    db.engineRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 120, // 6 engines × 20 each
    }),
    // AI status: recent generations in last 24h
    db.aIGenerationAudit.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // ── Compute engine health from real EngineRun data ──
  const ENGINE_DISPLAY: Record<string, string> = {
    grounding: 'Grounding Engine',
    scoring: 'Scoring Engine',
    action: 'Action Engine',
    conversation: 'Conversation Engine',
    synthesis: 'Synthesis Engine',
    retrieval: 'Retrieval Engine',
  };
  type EngineStatus = 'healthy' | 'degraded' | 'unhealthy';

  // Group runs by engine, take last 20 per engine
  const runsByEngine = new Map<string, typeof engineRuns>();
  for (const run of engineRuns) {
    const existing = runsByEngine.get(run.engine) ?? [];
    if (existing.length < 20) {
      existing.push(run);
      runsByEngine.set(run.engine, existing);
    }
  }

  const engines: { name: string; status: EngineStatus }[] = [];
  for (const [engineKey, displayName] of Object.entries(ENGINE_DISPLAY)) {
    const runs = runsByEngine.get(engineKey);
    if (!runs || runs.length === 0) {
      engines.push({ name: displayName, status: 'unhealthy' });
      continue;
    }
    const successRate = runs.filter(r => r.success).length / runs.length * 100;
    const status: EngineStatus =
      successRate >= 95 ? 'healthy' :
      successRate >= 80 ? 'degraded' :
      'unhealthy';
    engines.push({ name: displayName, status });
  }

  // ── Compute aiStatus from AIGenerationAudit ──
  let aiStatus: 'available' | 'degraded' | 'unavailable';
  if (recentAIGenerations.length === 0) {
    aiStatus = 'unavailable';
  } else {
    const passRate = recentAIGenerations.filter(g => g.governancePassed).length / recentAIGenerations.length;
    aiStatus =
      passRate >= 0.8 ? 'available' :
      passRate >= 0.5 ? 'degraded' :
      'unavailable';
  }

  return {
    kpis: {
      totalAccounts,
      activeSignals,
      avgIntelligenceScore: Math.round(avgScoreResult._avg?.intelligenceScore ?? 0),
      pendingActions,
    },
    recentSignals: recentSignals.map(s => ({
      id: s.id,
      companyId: s.companyId,
      companyName: s.company?.rawName ?? 'Unknown',
      signalType: s.signalType,
      title: s.title,
      severity: s.severity,
      impact: s.impact,
      confidence: s.confidence,
      createdAt: s.createdAt.toISOString(),
    })),
    topOpportunities: topOpportunities.map(o => ({
      id: o.id,
      companyId: o.companyId ?? '',
      companyName: o.company?.rawName ?? 'Unknown',
      industry: o.company?.industry ?? null,
      title: o.opportunityTitle ?? '',
      score: o.opportunityScore ?? 0,
      confidence: o.confidenceScore ?? 0,
      priority: o.priority ?? 'medium',
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    intelligenceFeed: intelligenceFeed.map(e => ({
      id: e.id,
      companyId: e.companyId,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
    })),
    systemHealth: {
      engines,
      aiStatus,
    },
    briefContext: { totalAccounts, recentEnrichedCount },
  };
}

// ── Generate AI morning brief (optional enhancement) ──
async function generateMorningBrief(data: {
  totalAccounts: number;
  recentEnrichedCount: number;
}): Promise<MorningBriefAI> {
  const userName = 'User';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const systemPrompt = `You are the AI intelligence briefing officer for DeepMindQ.
Generate a brief JSON response with greeting, executiveSummary (2 sentences), topTargets (empty array), newIntelligence (empty array), and actionsDue (empty array).
Return ONLY valid JSON.`;

  const userPrompt = `Total accounts: ${data.totalAccounts}. Enriched: ${data.recentEnrichedCount}.`;

  const rawText = await callBriefAI(systemPrompt, userPrompt);
  const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  // Zod-safe parse — validates runtime shape
  const result = morningBriefSchema.safeParse(JSON.parse(cleaned));
  if (!result.success) {
    logger.warn('[command-center/insights] AI brief Zod validation failed, using defaults', {
      errors: result.error.issues.slice(0, 3),
    });
    return {
      greeting: `${timeGreeting} ${userName}!`,
      executiveSummary: 'Intelligence data is loading.',
      topTargets: [],
      newIntelligence: [],
      actionsDue: [],
    };
  }

  return result.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET handler
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // ── Guard: rate limiting + correlation-id + response headers ──
  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'command-center-insights');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const data = await fetchInsightsData();

    // Attempt AI morning brief (cached 5 min, non-blocking)
    let morningBrief: MorningBriefAI | null = null;
    const cachedAI = aiCache && Date.now() - aiCache.ts < CACHE_TTL ? aiCache.data : null;
    if (cachedAI) {
      morningBrief = cachedAI;
    } else {
      try {
        morningBrief = await generateMorningBrief(data.briefContext);
        aiCache = { data: morningBrief, ts: Date.now() };
      } catch (aiError) {
        logger.warn('[command-center/insights] AI brief generation failed, skipping', {
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });
      }
    }

    return utilitySuccess(ctx, {
      kpis: data.kpis,
      recentSignals: data.recentSignals,
      topOpportunities: data.topOpportunities,
      systemHealth: data.systemHealth,
      intelligenceFeed: data.intelligenceFeed,
      ...(morningBrief && { morningBrief }),
    }, 'command-center-insights', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(
      ctx,
      err,
      502,
      'INTELLIGENCE_UNAVAILABLE',
      'Command center insights failed',
      Date.now() - startedAt,
    );
  }
}
