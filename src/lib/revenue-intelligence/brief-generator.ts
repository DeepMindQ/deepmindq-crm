// @ts-nocheck
// ── Phase 7.6: Hybrid Brief Generator ──
// Generates AccountBrief using the hybrid approach:
//   1. Rule engine extracts structured facts from signals/scores/opportunities
//   2. Facts are assembled into a structured JSON payload
//   3. LLM generates ONLY the narrative summary (LLM never invents facts)

import { db } from '@/lib/db';
import type { SignalCategory } from './signal-patterns';

export interface BriefFacts {
  companyName: string;
  industry: string | null;
  sizeRange: string | null;
  status: string;
  lifecycleStage: string;
  accountScore: number | null;
  scoreCategory: string | null;
  recentSignals: {
    signalType: string;
    title: string;
    score: number;
    source: string;
  }[];
  opportunitySignals: {
    signalType: SignalCategory;
    title: string;
    score: number;
    confidence: number;
  }[];
  openOpportunities: number;
  activePursuits: number;
  engagementScore: number;
  keyThemes: string[];
  risks: {
    risk: string;
    severity: string;
    evidence: string;
  }[];
  recommendations: {
    action: string;
    priority: string;
    rationale: string;
  }[];
}

/**
 * Step 1: Extract structured facts from all available data (pure rules, no LLM).
 */
export async function extractBriefFacts(companyId: string): Promise<BriefFacts> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      rawName: true,
      industry: true,
      sizeRange: true,
      status: true,
      lifecycleStage: true,
      intelligenceScore: true,
      engagementScore: true,
      researchCard: {
        select: {
          strategicPriorities: true,
          businessProblems: true,
          transformationAreas: true,
          technologyThemes: true,
          structuredTechLandscape: true,
        },
      },
    },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  const latestScore = await db.accountScore.findFirst({
    where: { companyId },
    orderBy: { calculatedAt: 'desc' },
    select: { score: true, category: true },
  });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const recentSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'active', 'validated'] },
      createdAt: { gte: ninetyDaysAgo },
    },
    select: {
      signalType: true,
      title: true,
      confidence: true,
      source: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const oppSignals = await db.opportunitySignal.findMany({
    where: { companyId, status: { in: ['new', 'validated'] } },
    select: { signalType: true as any, title: true, score: true, confidence: true },
    orderBy: { score: 'desc' },
    take: 10,
  });

  const [openOpps, activePursuits] = await Promise.all([
    db.opportunityRecommendation.count({
      where: { companyId, status: { in: ['monitored', 'accepted'] } },
    }),
    db.pursuit.count({
      where: { companyId, status: 'active' },
    }),
  ]);

  const themes = extractThemes(company);
  const risks = extractRisks(recentSignals, oppSignals as any);
  const recommendations = generateRuleBasedRecommendations({
    company,
    latestScore,
    openOpps,
    activePursuits,
    oppSignals: oppSignals as any,
    recentSignals,
    themes,
  });

  return {
    companyName: company.rawName,
    industry: company.industry,
    sizeRange: company.sizeRange,
    status: company.status,
    lifecycleStage: company.lifecycleStage,
    accountScore: latestScore?.score ?? null,
    scoreCategory: latestScore?.category ?? null,
    recentSignals: recentSignals.map(s => ({
      signalType: s.signalType,
      title: s.title,
      score: s.confidence * 100,
      source: s.source || 'unknown',
    })),
    opportunitySignals: oppSignals.map(s => ({
      signalType: s.signalType as SignalCategory,
      title: s.title,
      score: s.score,
      confidence: s.confidence,
    })),
    openOpportunities: openOpps,
    activePursuits,
    engagementScore: company.engagementScore,
    keyThemes: themes,
    risks,
    recommendations,
  };
}

/**
 * Step 2: Generate the LLM narrative from structured facts.
 * In production, this would call the AI SDK.
 * For now, builds a template-based narrative from facts only.
 */
export function generateNarrative(facts: BriefFacts): string {
  const parts: string[] = [];

  parts.push(
    `${facts.companyName} is a ${facts.industry || 'technology'} company ` +
    `${facts.sizeRange ? `in the ${facts.sizeRange} segment` : ''}, ` +
    `currently at ${facts.lifecycleStage} stage.`
  );

  if (facts.accountScore !== null && facts.scoreCategory) {
    parts.push(
      `The account holds a revenue intelligence score of ${facts.accountScore}/100, ` +
      `classified as ${facts.scoreCategory.replace(/_/g, ' ')}.`
    );
  }

  if (facts.opportunitySignals.length > 0) {
    const topSignals = facts.opportunitySignals.slice(0, 3);
    const signalDesc = topSignals
      .map(s => `${s.signalType} (score: ${s.score})`)
      .join(', ');
    parts.push(
      `Key revenue signals detected: ${signalDesc}. ` +
      `A total of ${facts.recentSignals.length} intelligence items were analyzed in the last 90 days.`
    );
  }

  if (facts.keyThemes.length > 0) {
    parts.push(`Strategic themes: ${facts.keyThemes.join(', ')}.`);
  }

  if (facts.openOpportunities > 0 || facts.activePursuits > 0) {
    parts.push(
      `Current pipeline: ${facts.openOpportunities} open opportunity recommendations, ` +
      `${facts.activePursuits} active pursuits.`
    );
  }

  if (facts.risks.length > 0) {
    const riskDesc = facts.risks.slice(0, 2).map(r => r.risk).join('; ');
    parts.push(`Identified risks: ${riskDesc}.`);
  }

  if (facts.engagementScore > 0) {
    parts.push(`Engagement score: ${facts.engagementScore}/100.`);
  }

  return parts.join(' ');
}

/**
 * Step 3: Persist the brief to the database (upsert).
 */
export async function generateAndPersistBrief(companyId: string): Promise<{
  id: string;
  summary: string;
  confidence: number;
}> {
  const facts = await extractBriefFacts(companyId);
  const summary = generateNarrative(facts);
  const confidence = calculateBriefConfidence(facts);

  const brief = await db.accountBrief.upsert({
    where: { companyId },
    create: {
      companyId,
      summary,
      keySignals: JSON.stringify(facts.opportunitySignals),
      themes: JSON.stringify(facts.keyThemes),
      risks: JSON.stringify(facts.risks),
      recommendations: JSON.stringify(facts.recommendations),
      confidence,
      generatedBy: 'system',
    },
    update: {
      summary,
      keySignals: JSON.stringify(facts.opportunitySignals),
      themes: JSON.stringify(facts.keyThemes),
      risks: JSON.stringify(facts.risks),
      recommendations: JSON.stringify(facts.recommendations),
      confidence,
      generatedAt: new Date(),
      generatedBy: 'system',
    },
  });

  return { id: brief.id, summary: brief.summary, confidence: brief.confidence };
}

/**
 * Retrieve the current brief for a company.
 */
export async function getBrief(companyId: string) {
  return db.accountBrief.findUnique({ where: { companyId } });
}

// ── Internal helpers ──

function extractThemes(company: {
  researchCard: {
    strategicPriorities: string | null;
    businessProblems: string | null;
    transformationAreas: string | null;
    technologyThemes: string | null;
    structuredTechLandscape: string | null;
  } | null;
}): string[] {
  const themes: string[] = [];
  const rc = company.researchCard;

  if (rc?.technologyThemes) {
    try { themes.push(...JSON.parse(rc.technologyThemes)); } catch { /* skip */ }
  }
  if (rc?.transformationAreas) {
    try { themes.push(...JSON.parse(rc.transformationAreas)); } catch { /* skip */ }
  }
  if (rc?.strategicPriorities) {
    try {
      const priorities = JSON.parse(rc.strategicPriorities) as Array<{ priority?: string }>;
      for (const p of priorities) {
        if (p.priority) themes.push(p.priority);
      }
    } catch { /* skip */ }
  }

  return [...new Set(themes)].slice(0, 8);
}

function extractRisks(
  recentSignals: { signalType: string; title: string; confidence: number }[],
  oppSignals: { signalType: SignalCategory; title: string; score: number }[],
): BriefFacts['risks'] {
  const risks: BriefFacts['risks'] = [];

  const painSignals = oppSignals.filter(s => s.signalType === 'PAIN');
  for (const ps of painSignals) {
    risks.push({
      risk: ps.title,
      severity: ps.score > 70 ? 'high' : ps.score > 40 ? 'medium' : 'low',
      evidence: `Opportunity signal score: ${ps.score}`,
    });
  }

  const highSeveritySignals = recentSignals.filter(s => s.confidence > 0.8);
  if (highSeveritySignals.length > 5) {
    risks.push({
      risk: 'High signal volume may indicate instability',
      severity: 'medium',
      evidence: `${highSeveritySignals.length} high-confidence signals detected recently`,
    });
  }

  return risks.slice(0, 5);
}

function generateRuleBasedRecommendations(ctx: {
  company: { status: string; lifecycleStage: string; engagementScore: number };
  latestScore: { score: number; category: string } | null;
  openOpps: number;
  activePursuits: number;
  oppSignals: { signalType: SignalCategory; title: string; score: number }[];
  recentSignals: { signalType: string }[];
  themes: string[];
}): BriefFacts['recommendations'] {
  const recs: BriefFacts['recommendations'] = [];

  if (ctx.latestScore && ctx.latestScore.score >= 70 && ctx.activePursuits === 0) {
    recs.push({
      action: 'Initiate outreach — high score account with no active engagement',
      priority: 'high',
      rationale: `Account score is ${ctx.latestScore.score} but has 0 active pursuits.`,
    });
  }

  const techSignals = ctx.oppSignals.filter(s => s.signalType === 'TECHNOLOGY' && s.score > 50);
  if (techSignals.length > 0) {
    recs.push({
      action: 'Position technology capabilities based on detected tech signals',
      priority: 'high',
      rationale: `${techSignals.length} technology signals detected with scores > 50.`,
    });
  }

  const painSignals = ctx.oppSignals.filter(s => s.signalType === 'PAIN');
  if (painSignals.length > 0) {
    recs.push({
      action: 'Take consultative approach addressing detected pain points',
      priority: 'high',
      rationale: `Pain point signals indicate business challenges that can be addressed.`,
    });
  }

  if (ctx.oppSignals.some(s => s.signalType === 'GROWTH')) {
    recs.push({
      action: 'Open expansion support conversation',
      priority: 'medium',
      rationale: 'Growth signals indicate the company is scaling and may need support.',
    });
  }

  if (ctx.company.engagementScore < 20 && ctx.recentSignals.length > 3) {
    recs.push({
      action: 'Re-engage with fresh value proposition',
      priority: 'medium',
      rationale: `Low engagement (${ctx.company.engagementScore}) despite ${ctx.recentSignals.length} recent signals.`,
    });
  }

  return recs.slice(0, 5);
}

/**
 * Calculate confidence based on data availability (pure heuristic, no LLM).
 */
export function calculateBriefConfidence(facts: BriefFacts): number {
  let total = 0;

  if (facts.accountScore !== null) { total += 0.2; }
  if (facts.opportunitySignals.length > 0) {
    total += Math.min(0.25, facts.opportunitySignals.length * 0.05);
  }
  if (facts.recentSignals.length > 0) {
    total += Math.min(0.2, facts.recentSignals.length * 0.02);
  }
  if (facts.keyThemes.length > 0) { total += 0.15; }
  if (facts.industry) { total += 0.1; }
  if (facts.recommendations.length > 0) { total += 0.1; }

  return Math.min(1, total);
}
