// ── Phase 7.6: Account Scorer ──
// Calculates composite AccountScore from multiple signal dimensions.

import { db } from '@/lib/db';

export interface ScoreBreakdown {
  signalStrength: number;  // 0-30
  engagement: number;      // 0-20
  opportunityFit: number;  // 0-30
  timing: number;          // 0-20
}

export interface ScoreResult {
  id: string;
  companyId: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  category: string;
  calculatedAt: Date;
}

/**
 * Calculate account score based on signal strength, engagement, opportunity fit, and timing.
 * Formula:
 *   signalStrength (0-30): based on OpportunitySignal count and avg score
 *   engagement      (0-20): based on Company.engagementScore
 *   opportunityFit  (0-30): based on signal category coverage (more categories = better fit)
 *   timing          (0-20): based on signal freshness (recency of signals)
 * Total: 0-100
 */
export function calculateScore(inputs: {
  opportunitySignals: Array<{ score: number; createdAt: Date; signalType: string }>;
  engagementScore: number;
}): ScoreBreakdown {
  const { opportunitySignals, engagementScore } = inputs;

  // 1. Signal Strength (0-30): weighted average of opportunity signal scores
  let signalStrength = 0;
  if (opportunitySignals.length > 0) {
    const avgScore = opportunitySignals.reduce((sum, s) => sum + s.score, 0) / opportunitySignals.length;
    const countBoost = Math.min(opportunitySignals.length * 2, 10);
    signalStrength = Math.min(30, Math.round((avgScore / 100) * 20 + countBoost));
  }

  // 2. Engagement (0-20): direct from Company.engagementScore mapped to 0-20
  const engagement = Math.round((Math.min(100, engagementScore) / 100) * 20);

  // 3. Opportunity Fit (0-30): how many signal categories covered (5 categories max)
  const uniqueCategories = new Set(opportunitySignals.map(s => s.signalType));
  const categoryCoverage = uniqueCategories.size;
  const opportunityFit = Math.min(30, Math.round(categoryCoverage * 6));

  // 4. Timing (0-20): how recent the signals are (within last 30 days = max)
  const now = Date.now();
  let timing = 0;
  if (opportunitySignals.length > 0) {
    const newest = opportunitySignals.reduce((a, b) => a.createdAt > b.createdAt ? a : b);
    const ageDays = (now - newest.createdAt.getTime()) / 86400000;
    if (ageDays <= 7) timing = 20;
    else if (ageDays <= 30) timing = 15;
    else if (ageDays <= 60) timing = 10;
    else if (ageDays <= 90) timing = 5;
    else timing = 2;
  }

  return { signalStrength, engagement, opportunityFit, timing };
}

/**
 * Classify score into category.
 */
export function classifyScore(score: number): string {
  if (score >= 80) return 'HOT_ACCOUNT';
  if (score >= 60) return 'WARM_ACCOUNT';
  if (score >= 40) return 'NURTURE';
  return 'AT_RISK';
}

/**
 * Calculate and persist a new AccountScore for a company.
 */
export async function calculateAndPersistScore(companyId: string): Promise<ScoreResult> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { rawName: true, engagementScore: true },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  const oppSignals = await db.opportunitySignal.findMany({
    where: { companyId, status: { in: ['new', 'validated'] } },
    select: { score: true, createdAt: true, signalType: true },
    orderBy: { score: 'desc' },
  });

  const breakdown = calculateScore({
    opportunitySignals: oppSignals,
    engagementScore: company.engagementScore,
  });

  const compositeScore = breakdown.signalStrength + breakdown.engagement + breakdown.opportunityFit + breakdown.timing;
  const category = classifyScore(compositeScore);

  const record = await db.accountScore.create({
    data: {
      companyId,
      score: compositeScore,
      scoreBreakdown: JSON.stringify(breakdown),
      category,
    },
  });

  return {
    id: record.id,
    companyId,
    score: compositeScore,
    scoreBreakdown: breakdown,
    category,
    calculatedAt: record.calculatedAt,
  };
}
