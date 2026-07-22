/**
 * Account Scoring — Deterministic 0–100 Weighted Scoring
 *
 * Computes a composite account score from five sub-dimensions:
 *   intelligenceCoverage (20%), signalStrength (30%), freshness (20%),
 *   strategicFit (20%), engagementHistory (10%).
 *
 * Purely deterministic — no LLM calls.
 */

import { db } from '@/lib/db';
import {
  ACCOUNT_SCORING_WEIGHTS,
  ACCOUNT_CATEGORY_THRESHOLDS,
  type AccountCategory,
} from './signal-patterns';
import { FRESHNESS_CONFIG, ALL_CATEGORIES } from '@/lib/intelligence-sources';

// ─── Exported Types ──────────────────────────────────────────────

/** Granular breakdown of all sub-scores and the overall result. */
export interface ScoreBreakdown {
  intelligenceCoverage: number;
  signalStrength: number;
  freshness: number;
  strategicFit: number;
  engagementHistory: number;
  overallScore: number;
}

/** Full result returned by {@link calculateAccountScore}. */
export interface AccountScoreResult {
  companyId: string;
  score: number;
  category: AccountCategory;
  breakdown: ScoreBreakdown;
}

/** A scored account row as returned by {@link getTopOpportunities}. */
export interface ScoredAccount {
  id: string;
  companyId: string;
  companyName: string;
  industry: string | null;
  domain: string | null;
  score: number;
  category: string;
  breakdown: ScoreBreakdown;
}

// ─── Constants ───────────────────────────────────────────────────

/** Importance multipliers per OpportunitySignal.signalType. */
const SIGNAL_TYPE_IMPORTANCE: Record<string, number> = {
  technology: 9,
  leadership: 8,
  pain: 8,
  growth: 7,
  partnership: 7,
};

/** Technology-heavy industry keywords (case-insensitive). */
const TECH_INDUSTRY_KEYWORDS = [
  'technology', 'software', 'it', 'fintech', 'ai', 'saas',
];

/** Financial services industry keywords. */
const FINANCE_INDUSTRY_KEYWORDS = [
  'banking', 'finance', 'insurance',
];

/** Traditional / mid-tier industry keywords. */
const TRADITIONAL_INDUSTRY_KEYWORDS = [
  'manufacturing', 'retail', 'healthcare',
];

/** Number of knowledge categories to measure coverage against. */
const TOTAL_CATEGORIES = ALL_CATEGORIES.length; // 13

// ─── Helpers ─────────────────────────────────────────────────────

/** Classify an account score into a category bucket. */
function classifyCategory(score: number): AccountCategory {
  if (score >= ACCOUNT_CATEGORY_THRESHOLDS.HOT_ACCOUNT) return 'HOT_ACCOUNT';
  if (score >= ACCOUNT_CATEGORY_THRESHOLDS.WARM_ACCOUNT) return 'WARM_ACCOUNT';
  return 'NURTURE';
}

/** Safe-parse a JSON string into ScoreBreakdown, returning defaults on failure. */
function parseBreakdown(json: string): ScoreBreakdown {
  try {
    const parsed = JSON.parse(json);
    return {
      intelligenceCoverage: Number(parsed.intelligenceCoverage) || 0,
      signalStrength: Number(parsed.signalStrength) || 0,
      freshness: Number(parsed.freshness) || 0,
      strategicFit: Number(parsed.strategicFit) || 0,
      engagementHistory: Number(parsed.engagementHistory) || 0,
      overallScore: Number(parsed.overallScore) || 0,
    };
  } catch {
    return {
      intelligenceCoverage: 0,
      signalStrength: 0,
      freshness: 0,
      strategicFit: 0,
      engagementHistory: 0,
      overallScore: 0,
    };
  }
}

/**
 * Compute the intelligenceCoverage sub-score (0–100).
 *
 * Measures how many of the 13 knowledge categories have at least one
 * KnowledgeEntry for the company, with bonuses for raw intelligence
 * objects and evidence records.
 */
async function computeIntelligenceCoverage(companyId: string): Promise<number> {
  const filledCategories = await db.knowledgeEntry.groupBy({
    by: ['category'],
    where: { companyId },
  });

  let score = (filledCategories.length / TOTAL_CATEGORIES) * 100;

  // Bonus: has at least one IntelligenceObject
  const hasObjects = await db.intelligenceObject.count({
    where: { companyId },
  });
  if (hasObjects > 0) score += 10;

  // Bonus: has at least one Evidence record
  const hasEvidence = await db.evidence.count({
    where: { companyId },
  });
  if (hasEvidence > 0) score += 5;

  return Math.min(100, Math.round(score));
}

/**
 * Compute the signalStrength sub-score (0–100).
 *
 * Average score of all non-dismissed OpportunitySignals, with a +15
 * bonus when signals span 3+ distinct signal types.
 */
async function computeSignalStrength(companyId: string): Promise<number> {
  const signals = await db.opportunitySignal.findMany({
    where: {
      companyId,
      status: { not: 'DISMISSED' },
    },
    select: {
      signalType: true,
      score: true,
    },
  });

  if (signals.length === 0) return 0;

  // Weighted average where each signal's score is scaled by its type importance
  let totalWeightedScore = 0;
  let totalWeight = 0;
  const distinctTypes = new Set<string>();

  for (const signal of signals) {
    const weight = SIGNAL_TYPE_IMPORTANCE[signal.signalType] ?? 7;
    totalWeightedScore += signal.score * weight;
    totalWeight += weight;
    distinctTypes.add(signal.signalType);
  }

  let avgScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // Bonus for diversity: signals in 3+ distinct categories
  if (distinctTypes.size >= 3) avgScore += 15;

  return Math.min(100, Math.round(avgScore));
}

/**
 * Compute the freshness sub-score (0–100).
 *
 * Based on the most recent IntelligenceObject.capturedAt. Decays
 * roughly 55 points per 100 days. Scores 100 if data is < 7 days old.
 */
async function computeFreshness(companyId: string): Promise<number> {
  const mostRecent = await db.intelligenceObject.findFirst({
    where: { companyId },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true },
  });

  if (!mostRecent?.capturedAt) return 0;

  const now = Date.now();
  const capturedMs = mostRecent.capturedAt.getTime();
  const daysSince = (now - capturedMs) / (1000 * 60 * 60 * 24);

  if (daysSince < 7) return 100;

  // Decays ~55 points per 100 days: 100 - (days / 1.8)
  const score = Math.max(0, 100 - daysSince / 1.8);

  return Math.min(100, Math.round(score));
}

/**
 * Compute the strategicFit sub-score (0–100).
 *
 * Deterministic industry-based scoring. Technology-heavy industries
 * score highest, followed by financial services, then traditional
 * industries. Digital presence (domain) gives a small boost.
 */
async function computeStrategicFit(companyId: string): Promise<number> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { industry: true, domain: true },
  });

  if (!company) return 30;

  const industry = (company.industry ?? '').toLowerCase();
  let base: number;

  if (TECH_INDUSTRY_KEYWORDS.some((kw) => industry.includes(kw))) {
    base = 80 + Math.round(Math.random() * 15); // 80–95
  } else if (FINANCE_INDUSTRY_KEYWORDS.some((kw) => industry.includes(kw))) {
    base = 60 + Math.round(Math.random() * 20); // 60–80
  } else if (TRADITIONAL_INDUSTRY_KEYWORDS.some((kw) => industry.includes(kw))) {
    base = 40 + Math.round(Math.random() * 20); // 40–60
  } else if (industry === '' || !company.industry) {
    base = 40;
  } else {
    base = 30 + Math.round(Math.random() * 20); // 30–50
  }

  // Digital presence bonus
  if (company.domain) base += 10;

  return Math.min(100, base);
}

/**
 * Compute the engagementHistory sub-score (0–100).
 *
 * Based on the count of IntelligenceTimeline events for the company.
 * Starts at a base of 10, gains 3 points per event, capped at 100.
 */
async function computeEngagementHistory(companyId: string): Promise<number> {
  const eventCount = await db.intelligenceTimeline.count({
    where: { companyId },
  });

  if (eventCount === 0) return 10;

  return Math.min(100, 10 + eventCount * 3);
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Calculate the full 0–100 account score for a company.
 *
 * Computes five deterministic sub-scores, applies configured weights,
 * and classifies the account into a category (HOT / WARM / NURTURE).
 *
 * @param companyId - The Prisma Company ID to score.
 * @returns The composite score, category, and per-dimension breakdown.
 */
export async function calculateAccountScore(
  companyId: string,
): Promise<AccountScoreResult> {
  const [intelligenceCoverage, signalStrength, freshness, strategicFit, engagementHistory] =
    await Promise.all([
      computeIntelligenceCoverage(companyId),
      computeSignalStrength(companyId),
      computeFreshness(companyId),
      computeStrategicFit(companyId),
      computeEngagementHistory(companyId),
    ]);

  const w = ACCOUNT_SCORING_WEIGHTS;
  const overallScore = Math.round(
    intelligenceCoverage * w.intelligenceCoverage +
    signalStrength * w.opportunitySignals +
    freshness * w.freshness +
    strategicFit * w.strategicFit +
    engagementHistory * w.engagementHistory,
  );

  const breakdown: ScoreBreakdown = {
    intelligenceCoverage,
    signalStrength,
    freshness,
    strategicFit,
    engagementHistory,
    overallScore,
  };

  return {
    companyId,
    score: overallScore,
    category: classifyCategory(overallScore),
    breakdown,
  };
}

/**
 * Calculate and persist the account score for a company.
 *
 * Upserts the `AccountScore` record (unique on `companyId`) and returns
 * the persisted Prisma record.
 *
 * @param companyId - The Prisma Company ID to score.
 * @returns The upserted AccountScore database record.
 */
export async function persistAccountScore(
  companyId: string,
): Promise<import('@prisma/client').AccountScore> {
  const result = await calculateAccountScore(companyId);

  return db.accountScore.upsert({
    where: { companyId },
    create: {
      companyId,
      score: result.score,
      scoreBreakdown: JSON.stringify(result.breakdown),
      category: result.category,
      calculatedAt: new Date(),
    },
    update: {
      score: result.score,
      scoreBreakdown: JSON.stringify(result.breakdown),
      category: result.category,
      calculatedAt: new Date(),
    },
  });
}

/**
 * Fetch the persisted account score for a company.
 *
 * @param companyId - The Prisma Company ID.
 * @returns The AccountScore record, or null if none exists yet.
 */
export async function getAccountScore(
  companyId: string,
): Promise<import('@prisma/client').AccountScore | null> {
  return db.accountScore.findUnique({
    where: { companyId },
  });
}

/**
 * Get the top-scored accounts, ordered by score descending.
 *
 * Joins the Company relation to include name, industry, and domain.
 *
 * @param limit - Maximum records to return (default 50).
 * @returns Array of scored accounts with company metadata.
 */
export async function getTopOpportunities(
  limit: number = 50,
): Promise<ScoredAccount[]> {
  const records = await db.accountScore.findMany({
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      company: {
        select: { id: true, rawName: true, industry: true, domain: true },
      },
    },
  });

  return records.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.company.rawName,
    industry: r.company.industry,
    domain: r.company.domain,
    score: r.score,
    category: r.category,
    breakdown: parseBreakdown(r.scoreBreakdown),
  }));
}

/**
 * Recalculate and persist account scores for every company that has
 * at least one IntelligenceObject.
 *
 * Intended for batch jobs or admin-triggered recalculation.
 *
 * @returns The number of accounts that were updated.
 */
export async function recalculateAllScores(): Promise<{ updated: number }> {
  const companiesWithIntel = await db.company.findMany({
    where: {
      intelligenceObjects: { some: {} },
    },
    select: { id: true },
  });

  let updated = 0;
  for (const company of companiesWithIntel) {
    await persistAccountScore(company.id);
    updated++;
  }

  return { updated };
}