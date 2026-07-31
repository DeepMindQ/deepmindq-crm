/**
 * GET /api/companies/{id}/scores — Unified 3-Score Architecture
 *
 * Returns all three scoring dimensions for a company:
 *   1. Intelligence Score (data quality / research depth) — from Company.intelligenceScore
 *   2. Account Priority Score (ICP fit / sales readiness) — from Company.accountPriorityScore
 *   3. Revenue Opportunity Score (signal strength / engagement) — from AccountScore table
 *
 * Each score includes a breakdown of its sub-dimensions and the tier classification.
 * Also returns PriorityScoreHistory for trend analysis.
 *
 * Architecture: Uses utilityGuard for rate limiting, correlation-id, scrubError.
 * Response uses IntelligenceResponse envelope for consistency.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAccountIntelligence } from '@/lib/intelligence-contract';
import {
  utilityGuard,
  utilityError,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';
import { companyIdSchema } from '@/lib/intelligence-api/validators';

// ── Canonical Response Types (single source of truth) ──
// These types are also consumed by the frontend ScoreTriple component.

export interface IntelligenceScoreDetail {
  score: number;
  tier: string;
  computedAt: string | null;
  source: 'live_computed' | 'company_table';
  staleness?: { status: 'fresh' | 'stale'; lastComputedAt: string | null };
  breakdown?: {
    dataCompleteness: number;
    evidenceQuality: number;
    freshnessScore: number;
    signalStrength: number;
    contactCoverage: number;
    engagementScore: number;
  };
}

export interface AccountPriorityDetail {
  score: number;
  tier: string;
  computedAt: string | null;
  breakdown: {
    staticFit: number;
    dynamicIntelligence: number;
    timingUrgency: number;
  } | null;
  source: 'company_table';
}

export interface RevenueOpportunityDetail {
  score: number;
  category: string;
  /** Normalized display tier derived from category */
  displayTier: string;
  computedAt: string | null;
  /** True when scoreBreakdown was in legacy format (pre-account-scoring.ts) */
  legacyFormat?: boolean;
  breakdown: {
    intelligenceCoverage: number;
    signalStrength: number;
    freshness: number;
    strategicFit: number;
    engagementHistory: number;
  } | null;
  source: 'account_score_table';
}

export interface ScoreHistoryEntry {
  id: string;
  accountPriorityScore: number;
  priorityTier: string;
  computedAt: string;
  triggerType: string;
  previousScore: number | null;
  newScore: number | null;
  // Ticket 4: Unified 3-Score History
  intelligenceScore: number | null;
  intelligenceTier: string | null;
  revenueScore: number | null;
  revenueCategory: string | null;
  scoreTriggerType: string | null;
}

export interface UnifiedScoresResponse {
  companyId: string;
  companyName: string;
  intelligence: IntelligenceScoreDetail;
  accountPriority: AccountPriorityDetail | null;
  revenueOpportunity: RevenueOpportunityDetail | null;
  history: ScoreHistoryEntry[];
  fetchedAt: string;
}

// ── Helpers ──

/** Classify intelligence tier from numeric score */
function classifyIntelligenceTier(score: number): string {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 15) return 'cold';
  return 'unknown';
}

/**
 * Normalize a revenue category (HOT_ACCOUNT/WARM_ACCOUNT/NURTURE/AT_RISK)
 * into a human-readable display tier for the ScoreTriple badge.
 */
export function normalizeRevenueCategory(category: string): string {
  const map: Record<string, string> = {
    HOT_ACCOUNT: 'High',
    WARM_ACCOUNT: 'Medium',
    NURTURE: 'Medium',
    AT_RISK: 'At Risk',
  };
  return map[category] ?? category;
}

/**
 * Parse revenue opportunity scoreBreakdown from AccountScore.
 * Detects legacy format (from deprecated account-scorer.ts) vs new format.
 *
 * Legacy keys: { signalStrength, engagement, opportunityFit, timing }
 * New keys:    { intelligenceCoverage, signalStrength, freshness, strategicFit, engagementHistory }
 */
export function parseRevenueBreakdown(scoreBreakdown: unknown): {
  breakdown: RevenueOpportunityDetail['breakdown'];
  isLegacy: boolean;
} {
  if (!scoreBreakdown || typeof scoreBreakdown !== 'object') {
    return { breakdown: null, isLegacy: false };
  }

  const parsed =
    typeof scoreBreakdown === 'string'
      ? (() => { try { return JSON.parse(scoreBreakdown); } catch { return null; } })()
      : scoreBreakdown;

  if (!parsed || typeof parsed !== 'object') {
    return { breakdown: null, isLegacy: false };
  }

  // Detect legacy format: has "engagement" or "opportunityFit" keys (deprecated scorer)
  const isLegacy = 'engagement' in parsed || 'opportunityFit' in parsed;

  if (isLegacy) {
    // Map legacy keys to new keys as best-effort
    return {
      breakdown: {
        intelligenceCoverage: 0,
        signalStrength: Number(parsed.signalStrength) || 0,
        freshness: Number(parsed.timing) || 0,
        strategicFit: Number(parsed.opportunityFit) || 0,
        engagementHistory: Number(parsed.engagement) || 0,
      },
      isLegacy: true,
    };
  }

  // New format: expected keys from account-scoring.ts
  return {
    breakdown: {
      intelligenceCoverage: Number(parsed.intelligenceCoverage) || 0,
      signalStrength: Number(parsed.signalStrength) || 0,
      freshness: Number(parsed.freshness) || 0,
      strategicFit: Number(parsed.strategicFit) || 0,
      engagementHistory: Number(parsed.engagementHistory) || 0,
    },
    isLegacy: false,
  };
}

// ── GET Handler ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();

  // ── Guard: rate limiting + correlation-id + response headers ──
  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'scores');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      const resetAt = Number(err.headers['X-RateLimit-Reset']) || Math.ceil(Date.now() / 1000) + 60;
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: {
          ...err.headers,
          'Retry-After': String(Math.max(1, Math.ceil(resetAt - Date.now() / 1000))),
        },
      });
    }
    throw err;
  }

  try {
    const { id } = await params;

    // Validate companyId with Zod
    const companyIdResult = companyIdSchema.safeParse(id);
    if (!companyIdResult.success) {
      const message = companyIdResult.error.issues[0]?.message || 'Invalid company ID';
      return utilityError(ctx, 400, message, 'INVALID_REQUEST', Date.now() - startedAt);
    }

    // Fetch company with base score fields
    const company = await db.company.findUnique({
      where: { id },
      select: {
        id: true,
        rawName: true,
        intelligenceScore: true,
        engagementScore: true,
        accountPriorityScore: true,
        priorityTier: true,
        priorityComputedAt: true,
        lastEnrichedAt: true,
      },
    });

    if (!company) {
      return utilityError(ctx, 404, 'Company not found', 'NOT_FOUND', Date.now() - startedAt);
    }

    // Compute live Intelligence Score via getAccountIntelligence (6-component weighted)
    let intelligenceResult = null;
    let intelUsedFallback = false;
    try {
      intelligenceResult = await getAccountIntelligence(id);
    } catch (err) {
      intelUsedFallback = true;
      logger.warn('[scores] getAccountIntelligence failed, falling back to stored value', {
        correlationId: ctx.correlationId,
        companyId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Fetch AccountScore + PriorityScoreHistory in parallel
    const [accountScore, historyEntries] = await Promise.all([
      db.accountScore.findUnique({
        where: { companyId: id },
      }),
      db.priorityScoreHistory.findMany({
        where: { companyId: id },
        orderBy: { computedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          accountPriorityScore: true,
          priorityTier: true,
          computedAt: true,
          triggerType: true,
          previousScore: true,
          newScore: true,
          staticFitScore: true,
          dynamicIntelScore: true,
          timingUrgencyScore: true,
          intelligenceScore: true,
          intelligenceTier: true,
          revenueScore: true,
          revenueCategory: true,
          scoreTriggerType: true,
        },
      }),
    ]);

    // Build Intelligence Score detail (live-computed preferred, stored fallback)
    const intelligence: IntelligenceScoreDetail = intelligenceResult
      ? {
          score: intelligenceResult.intelligenceScore,
          tier: intelligenceResult.tier,
          computedAt: intelligenceResult.computedAt,
          source: 'live_computed',
          breakdown: intelligenceResult.components,
        }
      : {
          score: company.intelligenceScore,
          tier: classifyIntelligenceTier(company.intelligenceScore),
          computedAt: company.lastEnrichedAt?.toISOString() ?? null,
          source: 'company_table',
          ...(intelUsedFallback && {
            staleness: {
              status: 'stale' as const,
              lastComputedAt: company.lastEnrichedAt?.toISOString() ?? null,
            },
          }),
        };

    // Build Account Priority Score detail
    let accountPriority: AccountPriorityDetail | null = null;
    if (company.accountPriorityScore !== null) {
      const latestHistory = historyEntries[0] ?? null;

      accountPriority = {
        score: company.accountPriorityScore,
        tier: company.priorityTier ?? 'NURTURE',
        computedAt: company.priorityComputedAt?.toISOString() ?? null,
        breakdown: latestHistory
          ? {
              staticFit: latestHistory.staticFitScore ?? 0,
              dynamicIntelligence: latestHistory.dynamicIntelScore ?? 0,
              timingUrgency: latestHistory.timingUrgencyScore ?? 0,
            }
          : null,
        source: 'company_table',
      };
    }

    // Build Revenue Opportunity Score detail
    let revenueOpportunity: RevenueOpportunityDetail | null = null;
    if (accountScore) {
      const { breakdown, isLegacy } = parseRevenueBreakdown(accountScore.scoreBreakdown);

      revenueOpportunity = {
        score: accountScore.score,
        category: accountScore.category,
        displayTier: normalizeRevenueCategory(accountScore.category),
        computedAt: accountScore.calculatedAt?.toISOString() ?? null,
        ...(isLegacy && { legacyFormat: true }),
        breakdown,
        source: 'account_score_table',
      };
    }

    // Map history — includes all 3 score dimensions
    const history: ScoreHistoryEntry[] = historyEntries.map(h => ({
      id: h.id,
      accountPriorityScore: h.accountPriorityScore,
      priorityTier: h.priorityTier,
      computedAt: h.computedAt.toISOString(),
      triggerType: h.triggerType,
      previousScore: h.previousScore,
      newScore: h.newScore,
      intelligenceScore: h.intelligenceScore,
      intelligenceTier: h.intelligenceTier,
      revenueScore: h.revenueScore,
      revenueCategory: h.revenueCategory,
      scoreTriggerType: h.scoreTriggerType,
    }));

    const response: UnifiedScoresResponse = {
      companyId: company.id,
      companyName: company.rawName,
      intelligence,
      accountPriority,
      revenueOpportunity,
      history,
      fetchedAt: new Date().toISOString(),
    };

    return utilitySuccess(ctx, response, 'scores', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(
      ctx,
      err,
      502,
      'INTELLIGENCE_UNAVAILABLE',
      'Scores fetch failed',
      Date.now() - startedAt,
    );
  }
}
