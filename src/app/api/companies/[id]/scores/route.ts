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
 */

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// ── Response Types ──

interface IntelligenceScoreDetail {
  score: number;
  tier: string;
  computedAt: string | null;
  source: 'company_table';
}

interface AccountPriorityDetail {
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

interface RevenueOpportunityDetail {
  score: number;
  category: string;
  computedAt: string | null;
  breakdown: {
    intelligenceCoverage: number;
    signalStrength: number;
    freshness: number;
    strategicFit: number;
    engagementHistory: number;
  } | null;
  source: 'account_score_table';
}

interface ScoreHistoryEntry {
  id: string;
  accountPriorityScore: number;
  priorityTier: string;
  computedAt: string;
  triggerType: string;
  previousScore: number | null;
  newScore: number | null;
}

interface UnifiedScoresResponse {
  companyId: string;
  companyName: string;
  intelligence: IntelligenceScoreDetail;
  accountPriority: AccountPriorityDetail | null;
  revenueOpportunity: RevenueOpportunityDetail | null;
  history: ScoreHistoryEntry[];
  fetchedAt: string;
}

// ── Helpers ──

function classifyIntelligenceTier(score: number): string {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 15) return 'cold';
  return 'unknown';
}

// ── GET Handler ──

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch AccountScore (Revenue/Opportunity) — persisted by account-scoring.ts
    const accountScore = await db.accountScore.findUnique({
      where: { companyId: id },
    });

    // Fetch PriorityScoreHistory — last 10 entries for trend
    const historyEntries = await db.priorityScoreHistory.findMany({
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
      },
    });

    // Build Intelligence Score detail
    const intelligence: IntelligenceScoreDetail = {
      score: company.intelligenceScore,
      tier: classifyIntelligenceTier(company.intelligenceScore),
      computedAt: company.lastEnrichedAt?.toISOString() ?? null,
      source: 'company_table',
    };

    // Build Account Priority Score detail
    let accountPriority: AccountPriorityDetail | null = null;
    if (company.accountPriorityScore !== null) {
      // Try to get breakdown from the most recent history entry
      const latestHistory = await db.priorityScoreHistory.findFirst({
        where: { companyId: id },
        orderBy: { computedAt: 'desc' },
        select: {
          staticFitScore: true,
          dynamicIntelScore: true,
          timingUrgencyScore: true,
        },
      });

      accountPriority = {
        score: company.accountPriorityScore,
        tier: company.priorityTier ?? 'unknown',
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
      let breakdown: RevenueOpportunityDetail['breakdown'] = null;
      try {
        const parsed = typeof accountScore.scoreBreakdown === 'string'
          ? JSON.parse(accountScore.scoreBreakdown)
          : accountScore.scoreBreakdown;
        if (parsed && typeof parsed === 'object') {
          breakdown = {
            intelligenceCoverage: Number(parsed.intelligenceCoverage) || 0,
            signalStrength: Number(parsed.signalStrength) || 0,
            freshness: Number(parsed.freshness) || 0,
            strategicFit: Number(parsed.strategicFit) || 0,
            engagementHistory: Number(parsed.engagementHistory) || 0,
          };
        }
      } catch { /* ignore parse failure */ }

      revenueOpportunity = {
        score: accountScore.score,
        category: accountScore.category,
        computedAt: accountScore.calculatedAt?.toISOString() ?? null,
        breakdown,
        source: 'account_score_table',
      };
    }

    // Map history
    const history: ScoreHistoryEntry[] = historyEntries.map(h => ({
      id: h.id,
      accountPriorityScore: h.accountPriorityScore,
      priorityTier: h.priorityTier,
      computedAt: h.computedAt.toISOString(),
      triggerType: h.triggerType,
      previousScore: h.previousScore,
      newScore: h.newScore,
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

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[scores] GET error:', { error, companyId: _request.url });
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}
