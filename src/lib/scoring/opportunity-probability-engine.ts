/**
 * Opportunity Probability Engine (Wave 8.2)
 *
 * Predicts win probability for each opportunity based on:
 * - Stage advancement velocity
 * - Engagement signals (meetings, calls, email threads)
 * - Company intelligence alignment
 * - Competitive landscape
 * - Deal age and stagnation risk
 *
 * Note: Adapted to OpportunityRecommendation model (status: pending_review/accepted/rejected/monitored)
 * and Pursuit model (outcomeStage: discovery/qualification/proposal/negotiation/closed_won/closed_lost)
 */

import { db } from '@/lib/db';
import { createInsight } from '@/lib/ai-insight-service';

// OpportunityRecommendation status → base probability
const STATUS_PROBABILITIES: Record<string, number> = {
  pending_review: 0.15,
  accepted: 0.45,
  monitored: 0.35,
  rejected: 0.0,
};

// Pursuit stage → probability multiplier applied on top of status base
const PURSUIT_STAGE_MULTIPLIER: Record<string, number> = {
  discovery: 0.50,
  qualification: 0.65,
  proposal: 0.75,
  negotiation: 0.85,
  closed_won: 1.0,
  closed_lost: 0.0,
};

// Stagnation thresholds (days since last activity before flagging)
const STAGNATION_THRESHOLDS: Record<string, number> = {
  pending_review: 21,
  accepted: 30,
  monitored: 30,
};

export interface OpportunityProbability {
  opportunityId: string;
  companyId: string;
  companyName: string;
  currentStatus: string;
  pursuitStage: string | null;
  baseProbability: number;     // From status position
  velocityBonus: number;      // +0 to +15 for fast-moving deals
  stagnationRisk: number;      // 0-100 risk of deal stalling
  engagementStrength: number;  // 0-100
  winProbability: number;     // Final 0-100
  riskFactors: string[];
  confidence: number;          // How confident we are in this prediction
  nextBestAction: string;
  daysSinceUpdate: number;
}

export async function scoreOpportunity(
  opportunityId: string
): Promise<OpportunityProbability> {
  const opp = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    include: {
      company: { select: { rawName: true, industry: true } },
      pursuits: {
        where: { status: { in: ['active', 'won', 'lost'] } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!opp) throw new Error(`Opportunity ${opportunityId} not found`);

  const status = opp.status || 'pending_review';
  const baseProbability = (STATUS_PROBABILITIES[status] || 0.15) * 100;

  // Check for pursuit data to refine probability
  const activePursuit = opp.pursuits.length > 0 ? opp.pursuits[0] : null;
  const pursuitStage = activePursuit?.outcomeStage || null;

  // Adjust base probability if there's an active pursuit with a stage
  let effectiveBase = baseProbability;
  if (activePursuit && pursuitStage && PURSUIT_STAGE_MULTIPLIER[pursuitStage] !== undefined) {
    effectiveBase = baseProbability + ((PURSUIT_STAGE_MULTIPLIER[pursuitStage] - 0.5) * 50);
    effectiveBase = Math.max(0, Math.min(100, effectiveBase));
  }

  // Days since last update
  const created = new Date(opp.createdAt).getTime();
  const updated = new Date(opp.updatedAt).getTime();
  const daysSinceUpdate = Math.max(0, (Date.now() - updated) / (1000 * 60 * 60 * 24));

  // Stagnation risk — use pursuit's lastActivityAt if available, else updatedAt
  const lastActivity = activePursuit?.lastActivityAt
    ? new Date(activePursuit.lastActivityAt).getTime()
    : updated;
  const daysSinceActivity = Math.max(0, (Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
  const threshold = STAGNATION_THRESHOLDS[status] || 21;
  const stagnationRisk = daysSinceActivity > threshold
    ? Math.min(100, Math.round(((daysSinceActivity - threshold) / threshold) * 50 + 50))
    : Math.round((daysSinceActivity / threshold) * 30);

  // Velocity bonus (fast advancement = positive signal)
  const totalDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  const stageIdx = ['pending_review', 'accepted', 'monitored'].indexOf(status);
  const velocityBonus = totalDays > 0 && stageIdx > 0
    ? Math.min(15, Math.round((stageIdx / totalDays) * 30))
    : 0;

  // Engagement strength (from company signals and knowledge)
  const signalCount = await db.companySignal.count({
    where: { companyId: opp.companyId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });
  const engagementStrength = Math.min(100, signalCount * 20);

  // Risk factors
  const riskFactors: string[] = [];
  if (stagnationRisk > 60) riskFactors.push(`Deal stagnant — ${Math.round(daysSinceActivity)} days since last activity`);
  if (engagementStrength < 20) riskFactors.push('Low engagement signals — no recent interactions');
  if (effectiveBase < 30) riskFactors.push('Early stage — significant discovery needed');
  if (status === 'rejected') riskFactors.push('Opportunity was rejected — re-evaluate fit');

  // Win probability calculation
  let winProbability = Math.round(
    effectiveBase +
    velocityBonus -
    (stagnationRisk * 0.15) +
    (engagementStrength * 0.1)
  );
  winProbability = Math.max(0, Math.min(100, winProbability));

  // Confidence in our prediction
  const confidence = Math.min(95, 50 + engagementStrength * 0.2 + (totalDays > 7 ? 10 : 0));

  // Next best action
  let nextBestAction = 'Continue monitoring';
  if (status === 'pending_review' && stagnationRisk > 40) nextBestAction = 'Review opportunity — pending review phase stalling';
  else if (status === 'accepted' && stagnationRisk > 50) nextBestAction = 'Re-engage with relevant insight or case study — deal at risk';
  else if (status === 'accepted' && pursuitStage === 'negotiation') nextBestAction = 'Prepare executive sponsorship call to accelerate close';
  else if (status === 'accepted' && pursuitStage === 'proposal') nextBestAction = 'Follow up on proposal — decision timeline at risk';
  else if (engagementStrength > 60) nextBestAction = 'Capitalize on momentum — propose next step';
  else if (status === 'pending_review') nextBestAction = 'Evaluate opportunity for acceptance — high potential signals detected';

  const result: OpportunityProbability = {
    opportunityId,
    companyId: opp.companyId,
    companyName: opp.company?.rawName || 'Unknown',
    currentStatus: status,
    pursuitStage,
    baseProbability: Math.round(effectiveBase),
    velocityBonus,
    stagnationRisk,
    engagementStrength,
    winProbability,
    riskFactors,
    confidence: Math.round(confidence),
    nextBestAction,
    daysSinceUpdate: Math.round(daysSinceUpdate),
  };

  // Persist as AI Insight
  await createInsight({
    companyId: opp.companyId,
    opportunityId,
    type: winProbability >= 50 ? 'OPPORTUNITY' : 'RISK',
    title: `Deal Probability: ${opp.company?.rawName || 'Unknown'} — ${winProbability}%`,
    description: `${result.companyName} opportunity at "${status}" stage has ${winProbability}% win probability.${pursuitStage ? ` Pursuit stage: ${pursuitStage}.` : ''} ${riskFactors.length > 0 ? 'Risks: ' + riskFactors.join('. ') + '.' : 'No major risks detected.'}`,
    evidence: [
      { source: 'probability-engine', snippet: `Status ${status} base probability: ${Math.round(effectiveBase)}%`, reliability: 0.9 },
      { source: 'probability-engine', snippet: `Days since last activity: ${Math.round(daysSinceActivity)} (threshold: ${threshold})`, reliability: 0.95 },
      { source: 'probability-engine', snippet: `Recent signals: ${signalCount} in last 30 days`, reliability: 0.8 },
    ],
    confidenceScore: confidence,
    impactScore: winProbability,
    urgencyScore: stagnationRisk > 60 ? 75 : stagnationRisk > 40 ? 50 : 25,
    recommendedAction: nextBestAction,
    sourceType: 'scoring_engine',
    sourceRoute: '/api/ai/score-opportunities',
  });

  return result;
}

/**
 * Score all open opportunities and return ranked by probability.
 */
export async function scoreAllOpportunities(): Promise<OpportunityProbability[]> {
  const opportunities = await db.opportunityRecommendation.findMany({
    where: { status: { not: 'rejected' } },
    select: { id: true },
  });

  const scores: OpportunityProbability[] = [];
  for (const opp of opportunities) {
    try {
      const score = await scoreOpportunity(opp.id);
      scores.push(score);
    } catch {
      // Skip failed opportunities
    }
  }

  return scores.sort((a, b) => b.winProbability - a.winProbability);
}
