/**
 * Revenue Opportunity Score Engine (Wave 8.2)
 *
 * The composite scoring system that combines all 4 sub-engines into
 * one unified Revenue Opportunity Score per company:
 *
 *   1. Account Score Engine       → company fit + engagement
 *   2. Contact Influence Engine  → stakeholder buying power
 *   3. Opportunity Probability   → deal win likelihood
 *   4. Buying Intent Engine      → market signals + timing
 *
 * Output format:
 *   Acme Corporation
 *   Opportunity Score: 87/100
 *   Breakdown:
 *     +25 Technology Trigger (Migrated 200 workloads to Azure)
 *     +20 Growth Signal (Hiring 35 cloud engineers)
 *     +15 Executive Change (New CIO joined)
 *     +12 Engagement (Visited AI modernization pages)
 *      -5 Risk (Existing vendor relationship)
 *   Confidence: 91%
 */

import { db } from '@/lib/db';
import { createInsight } from '@/lib/ai-insight-service';
import { scoreContactInfluence, type ContactInfluenceScore } from './contact-influence-engine';
import { scoreOpportunity, type OpportunityProbability } from './opportunity-probability-engine';
import { scoreBuyingIntent, type BuyingIntentScore } from './buying-intent-engine';
import { getCachedScoringConfig } from '@/lib/scoring-config';
import { logger } from '@/lib/logger';

// ── Types ──

export type SignalCategory =
  | 'technology_trigger'
  | 'growth_signal'
  | 'executive_change'
  | 'engagement'
  | 'risk'
  | 'contact_influence'
  | 'opportunity_strength'
  | 'intent_signal'
  | 'data_coverage'
  | 'competitive_position';

export interface RevenueScoreFactor {
  category: SignalCategory;
  label: string;           // e.g., "Technology Trigger"
  points: number;          // positive or negative
  maxPoints: number;
  evidence: string;        // specific evidence snippet
  source: string;          // which engine produced this
  signalId?: string;       // linked signal if applicable
}

export interface RevenueOpportunityScore {
  companyId: string;
  companyName: string;
  domain: string | null;
  industry: string | null;

  // Composite score
  opportunityScore: number;      // 0-100 final
  confidence: number;            // 0-100 how confident in this score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Decomposed breakdown: "+25 Technology Trigger (evidence)"
  factors: RevenueScoreFactor[];
  breakdown: string;             // human-readable string

  // Sub-engine summaries
  accountFit: number;             // from account scoring (0-100)
  contactInfluence: number;       // top contact influence (0-100)
  opportunityStrength: number;    // best opp win probability (0-100)
  buyingIntent: number;           // overall buying intent (0-100)

  // Actionability
  recommendedAction: string;
  priorityTier: 'critical' | 'high' | 'medium' | 'low' | 'nurture';
  timingWindow: string;
  nextBestActions: string[];

  // Metadata
  scoredAt: string;
  signalCount: number;
  evidenceCount: number;
}

// ── Grade mapping ──

function toGrade(score: number): RevenueOpportunityScore['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function toPriorityTier(score: number, urgency: number): RevenueOpportunityScore['priorityTier'] {
  if (score >= 80 && urgency >= 60) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'nurture';
}

// ── Format the decomposed breakdown ──

function formatBreakdown(factors: RevenueScoreFactor[]): string {
  const sorted = [...factors].sort((a, b) => b.points - a.points);
  const parts = sorted
    .filter(f => f.points !== 0)
    .map(f => {
      const sign = f.points > 0 ? '+' : '';
      const evidence = f.evidence.length > 50 ? f.evidence.substring(0, 47) + '...' : f.evidence;
      return `${sign}${f.points} ${f.label} (${evidence})`;
    });
  return parts.length > 0 ? parts.join(', ') : 'No signals detected. Enrich company data to generate score.';
}

// ── Main scoring function ──

export async function scoreRevenueOpportunity(
  companyId: string
): Promise<RevenueOpportunityScore> {
  // Fetch company data
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      rawName: true,
      normalizedName: true,
      domain: true,
      industry: true,
      status: true,
      lifecycleStage: true,
      intelligenceScore: true,
      sizeRange: true,
      country: true,
    },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  const factors: RevenueScoreFactor[] = [];
  let evidenceCount = 0;
  const now = new Date().toISOString();

  // ──────────────────────────────────────────────────────────
  // 1. Account Fit Score (from company data + signals)
  // ──────────────────────────────────────────────────────────

  const activeSignals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  // Technology Trigger (up to +25)
  const techSignals = activeSignals.filter(s =>
    s.signalType === 'tech_change' ||
    s.title?.toLowerCase().match(/cloud|ai|migration|digital|kubernetes|azure|aws|gcp/i)
  );
  if (techSignals.length > 0) {
    const topTech = techSignals[0];
    const pts = Math.min(25, techSignals.length * 8);
    factors.push({
      category: 'technology_trigger',
      label: 'Technology Trigger',
      points: pts,
      maxPoints: 25,
      evidence: topTech.businessImpact || topTech.title || 'Technology change signal detected',
      source: 'account-signals',
      signalId: topTech.id,
    });
    evidenceCount += techSignals.length;
  }

  // Growth Signal (up to +20)
  const growthSignals = activeSignals.filter(s =>
    s.signalType === 'funding' ||
    s.signalType === 'hiring' ||
    s.signalType === 'expansion' ||
    s.title?.toLowerCase().match(/grow|hiring|fund|expand|series|ipo|revenue/i)
  );
  if (growthSignals.length > 0) {
    const topGrowth = growthSignals[0];
    const pts = Math.min(20, growthSignals.length * 7);
    factors.push({
      category: 'growth_signal',
      label: 'Growth Signal',
      points: pts,
      maxPoints: 20,
      evidence: topGrowth.businessImpact || topGrowth.title || 'Growth indicator detected',
      source: 'account-signals',
      signalId: topGrowth.id,
    });
    evidenceCount += growthSignals.length;
  }

  // Executive Change (up to +15)
  const execSignals = activeSignals.filter(s =>
    s.signalType === 'leadership_change' ||
    s.title?.toLowerCase().match(/ceo|cto|cio|cfo|coo|chief|vp|appointed|joined|left|departed/i)
  );
  if (execSignals.length > 0) {
    const topExec = execSignals[0];
    const pts = Math.min(15, execSignals.length * 8);
    factors.push({
      category: 'executive_change',
      label: 'Executive Change',
      points: pts,
      maxPoints: 15,
      evidence: topExec.businessImpact || topExec.title || 'Leadership change detected',
      source: 'account-signals',
      signalId: topExec.id,
    });
    evidenceCount += execSignals.length;
  }

  // Engagement (up to +12)
  const engageSignals = activeSignals.filter(s =>
    s.signalType === 'news' || s.signalType === 'mention' ||
    s.title?.toLowerCase().match(/visit|engagement|interaction|meeting|conference/i)
  );
  const contactCount = await db.contact.count({ where: { companyId } });
  const repliedCount = await db.contact.count({ where: { companyId, status: 'replied' } });
  const engagePoints = Math.min(12, engageSignals.length * 3 + repliedCount * 3);
  if (engagePoints > 0) {
    factors.push({
      category: 'engagement',
      label: 'Engagement',
      points: engagePoints,
      maxPoints: 12,
      evidence: `${contactCount} contacts tracked, ${repliedCount} replied, ${engageSignals.length} engagement signals`,
      source: 'account-engagement',
    });
    evidenceCount += engageSignals.length;
  }

  // Risk factors (up to -10)
  const riskSignals = activeSignals.filter(s =>
    s.severity === 'high' || s.severity === 'critical' ||
    s.title?.toLowerCase().match(/layoff|downsize|loss|risk|violation|breach|bankrupt/i)
  );
  if (riskSignals.length > 0) {
    const topRisk = riskSignals[0];
    const pts = Math.min(10, riskSignals.length * 5);
    factors.push({
      category: 'risk',
      label: 'Risk',
      points: -pts,
      maxPoints: 10,
      evidence: topRisk.businessImpact || topRisk.title || 'Risk signal detected',
      source: 'account-signals',
      signalId: topRisk.id,
    });
  }

  // Data Coverage bonus (up to +8)
  const intScore = company.intelligenceScore ?? 0;
  if (intScore >= 3) {
    factors.push({
      category: 'data_coverage',
      label: 'Data Coverage',
      points: Math.min(8, intScore * 2),
      maxPoints: 8,
      evidence: `${intScore}/5 intelligence dimensions enriched`,
      source: 'account-data',
    });
  }

  // ──────────────────────────────────────────────────────────
  // 2. Contact Influence (from Contact Influence Engine)
  // ──────────────────────────────────────────────────────────

  let topContactInfluence = 0;
  let topContactName = 'No contacts';
  try {
    const contacts = await db.contact.findMany({
      where: { companyId, status: { not: 'archived' } },
      select: { id: true, rawName: true },
      orderBy: { leadScore: 'desc' },
      take: 5,
    });

    if (contacts.length > 0) {
      // Score top contacts (limit to 3 to avoid excessive DB calls)
      const scored: ContactInfluenceScore[] = [];
      for (const c of contacts.slice(0, 3)) {
        try {
          const s = await scoreContactInfluence(c.id);
          scored.push(s);
        } catch {
          // skip
        }
      }
      scored.sort((a, b) => b.influenceScore - a.influenceScore);
      if (scored.length > 0) {
        topContactInfluence = scored[0].influenceScore;
        topContactName = contacts[0].rawName;

        if (topContactInfluence >= 50) {
          const pts = Math.min(10, Math.round(topContactInfluence / 10));
          factors.push({
            category: 'contact_influence',
            label: 'Contact Influence',
            points: pts,
            maxPoints: 10,
            evidence: `${topContactName} — influence ${topContactInfluence}/100 (${scored[0].buyingRole.replace('_', ' ')})`,
            source: 'contact-influence-engine',
          });
          evidenceCount += 1;
        }
      }
    }
  } catch (err) {
    logger.warn('[revenue-score] Contact influence scoring failed:', { error: err });
  }

  // ──────────────────────────────────────────────────────────
  // 3. Opportunity Strength (from Opportunity Probability)
  // ──────────────────────────────────────────────────────────

  let bestOppProbability = 0;
  let bestOppStage = 'N/A';
  try {
    const opportunities = await db.opportunityRecommendation.findMany({
      where: { companyId, status: { not: 'rejected' } },
      select: { id: true },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    if (opportunities.length > 0) {
      const scored: OpportunityProbability[] = [];
      for (const o of opportunities.slice(0, 3)) {
        try {
          const s = await scoreOpportunity(o.id);
          scored.push(s);
        } catch {
          // skip
        }
      }
      scored.sort((a, b) => b.winProbability - a.winProbability);
      if (scored.length > 0) {
        bestOppProbability = scored[0].winProbability;
        bestOppStage = scored[0].pursuitStage || scored[0].currentStatus;

        if (bestOppProbability >= 30) {
          const pts = Math.min(10, Math.round(bestOppProbability / 10));
          factors.push({
            category: 'opportunity_strength',
            label: 'Opportunity Strength',
            points: pts,
            maxPoints: 10,
            evidence: `Best opportunity at ${bestOppStage} — ${bestOppProbability}% win probability`,
            source: 'opportunity-probability-engine',
          });
          evidenceCount += 1;
        }
      }
    }
  } catch (err) {
    logger.warn('[revenue-score] Opportunity probability scoring failed:', { error: err });
  }

  // ──────────────────────────────────────────────────────────
  // 4. Buying Intent (from Buying Intent Engine)
  // ──────────────────────────────────────────────────────────

  let overallIntent = 0;
  let intentTiming = 'Unknown';
  try {
    const intentResult = await scoreBuyingIntent(companyId);
    overallIntent = intentResult.overallIntentScore;
    intentTiming = intentResult.timingWindow;

    if (overallIntent >= 30) {
      const pts = Math.min(10, Math.round(overallIntent / 10));
      const topCat = Object.entries(intentResult.categoryScores)
        .sort(([, a], [, b]) => b - a)[0];
      factors.push({
        category: 'intent_signal',
        label: 'Buying Intent',
        points: pts,
        maxPoints: 10,
        evidence: `Overall intent ${overallIntent}/100 — strongest in ${topCat[0].replace('_', ' ')} (${topCat[1]})`,
        source: 'buying-intent-engine',
      });
      evidenceCount += intentResult.topSignals.length;
    }
  } catch (err) {
    logger.warn('[revenue-score] Buying intent scoring failed:', { error: err });
  }

  // ──────────────────────────────────────────────────────────
  // Composite Score Calculation
  // ──────────────────────────────────────────────────────────

  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0);
  const opportunityScore = Math.max(0, Math.min(100, rawTotal));

  // Confidence: based on evidence coverage
  const confidence = Math.min(95,
    30 + (evidenceCount * 5) + (factors.length * 3) + (bestOppProbability > 0 ? 10 : 0)
  );

  // Account fit (normalised 0-100 from signal-based factors)
  const accountFit = Math.min(100, Math.round(
    techSignals.length * 15 +
    growthSignals.length * 12 +
    execSignals.length * 10 +
    engagePoints +
    (intScore * 5) -
    (riskSignals.length * 8)
  ));

  // Next best actions
  const nextBestActions: string[] = [];
  if (techSignals.length > 0) nextBestActions.push('Lead with technical value proposition targeting CTO/CIO');
  if (growthSignals.length > 0) nextBestActions.push('Position as scaling enabler for their growth phase');
  if (execSignals.length > 0) nextBestActions.push('New executive may reset vendor relationships — approach now');
  if (contactCount === 0) nextBestActions.push('Discover and add key stakeholders before outreach');
  if (repliedCount === 0 && contactCount > 0) nextBestActions.push('Begin outreach sequence with top contacts');
  if (riskSignals.length > 0) nextBestActions.push(`Address identified risk: ${riskSignals[0].title || 'review risk signals'}`);
  if (bestOppProbability >= 60) nextBestActions.push('Accelerate deal — high win probability, propose next step');
  if (bestOppProbability > 0 && bestOppProbability < 30) nextBestActions.push('Strengthen opportunity — add evidence and stakeholders');
  if (overallIntent >= 70) nextBestActions.push(`Strong buying intent — ${intentTiming} window. Prioritize immediate outreach`);
  if (intScore < 3) nextBestActions.push('Enrich company data to improve scoring accuracy');

  const result: RevenueOpportunityScore = {
    companyId,
    companyName: company.normalizedName || company.rawName,
    domain: company.domain,
    industry: company.industry,
    opportunityScore,
    confidence: Math.round(confidence),
    grade: toGrade(opportunityScore),
    factors,
    breakdown: formatBreakdown(factors),
    accountFit: Math.max(0, accountFit),
    contactInfluence: topContactInfluence,
    opportunityStrength: bestOppProbability,
    buyingIntent: overallIntent,
    recommendedAction: nextBestActions[0] || 'Monitor and enrich data',
    priorityTier: toPriorityTier(opportunityScore, overallIntent >= 60 ? 70 : 30),
    timingWindow: intentTiming,
    nextBestActions,
    scoredAt: now,
    signalCount: activeSignals.length,
    evidenceCount,
  };

  // ──────────────────────────────────────────────────────────
  // Persist as AI Insight
  // ──────────────────────────────────────────────────────────

  await createInsight({
    companyId,
    type: opportunityScore >= 70 ? 'OPPORTUNITY' : opportunityScore >= 45 ? 'SIGNAL' : 'RECOMMENDATION',
    title: `Revenue Score: ${company.normalizedName} — ${opportunityScore}/100 (${result.grade})`,
    description: `${company.normalizedName} has a Revenue Opportunity Score of ${opportunityScore}/100 (grade ${result.grade}). ${factors.length} scoring factors identified across technology, growth, engagement, and risk dimensions. Confidence: ${Math.round(confidence)}%. ${result.timingWindow} timing window.`,
    evidence: factors.slice(0, 6).map(f => ({
      source: f.source,
      snippet: `${f.label}: ${f.evidence}`,
      reliability: Math.min(1, Math.max(0, (Math.abs(f.points) / f.maxPoints))),
    })),
    confidenceScore: Math.round(confidence),
    impactScore: opportunityScore,
    urgencyScore: opportunityScore >= 70 ? 75 : opportunityScore >= 50 ? 50 : 25,
    recommendedAction: result.recommendedAction,
    reasoning: `Score breakdown: ${formatBreakdown(factors)}`,
    sourceType: 'revenue_opportunity_engine',
    sourceRoute: '/api/ai/revenue-score',
    modelUsed: 'composite_v1',
    metadata: {
      accountFit: result.accountFit,
      contactInfluence: result.contactInfluence,
      opportunityStrength: result.opportunityStrength,
      buyingIntent: result.buyingIntent,
      priorityTier: result.priorityTier,
      signalCount: result.signalCount,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7-day expiry
  });

  return result;
}

// ──────────────────────────────────────────────────────────
// Batch scoring for multiple companies
// ──────────────────────────────────────────────────────────

export async function scoreRevenueOpportunities(
  companyIds: string[]
): Promise<RevenueOpportunityScore[]> {
  const results: RevenueOpportunityScore[] = [];
  for (const id of companyIds) {
    try {
      const score = await scoreRevenueOpportunity(id);
      results.push(score);
    } catch (err) {
      logger.warn(`[revenue-score] Failed to score company ${id}:`, { error: err });
    }
  }
  return results.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

// ──────────────────────────────────────────────────────────
// Score all active companies
// ──────────────────────────────────────────────────────────

export async function scoreAllRevenueOpportunities(
  limit = 50
): Promise<RevenueOpportunityScore[]> {
  const companies = await db.company.findMany({
    where: { status: { not: 'archived' } },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  return scoreRevenueOpportunities(companies.map(c => c.id));
}
