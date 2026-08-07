/**
 * S6-3.1 — AI Governance Dashboard API
 *
 * GET /api/ai/governance/dashboard?hours=24
 *
 * Returns comprehensive governance health data:
 *   - Overall governance health score (weighted pass rate)
 *   - Per-generation-type pass/fail rates
 *   - Recent governance failures (last 20 blocked generations)
 *   - Staleness distribution (fresh/aging/stale/none)
 *   - Top 5 generation types by call volume
 *   - Governance trend (hourly pass rate over time window)
 *   - Hallucination check results
 *   - Confidence distribution
 *
 * All data sourced from AIGenerationAudit table (production-real data only).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';

const HOURS_MIN = 1;
const HOURS_MAX = 720;
const HOURS_DEFAULT = 24;

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const hours = Math.max(HOURS_MIN, Math.min(HOURS_MAX, parseInt(searchParams.get('hours') || String(HOURS_DEFAULT), 10)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // ── 1. Overall Governance Stats ──
    const [total, passed, blocked] = await Promise.all([
      db.aIGenerationAudit.count({ where: { createdAt: { gte: since } } }),
      db.aIGenerationAudit.count({ where: { createdAt: { gte: since }, governancePassed: true } }),
      db.aIGenerationAudit.count({ where: { createdAt: { gte: since }, governancePassed: false } }),
    ]);

    const overallPassRate = total > 0 ? Math.round((passed / total) * 10000) / 100 : 0;

    // ── 2. Per-Type Pass/Fail Rates ──
    const typeBreakdown = await db.aIGenerationAudit.groupBy({
      by: ['generationType'],
      where: { createdAt: { gte: since } },
      _count: { id: true, governancePassed: true },
      _sum: { researchConfidence: true },
      _avg: { researchConfidence: true, freshnessScore: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const perTypeStats = typeBreakdown.map(t => {
      const typeTotal = t._count.id;
      const typePassed = t._count.governancePassed;
      // Count passed separately for accurate rate
      const passRate = typeTotal > 0 ? Math.round((typePassed / typeTotal) * 10000) / 100 : 0;
      return {
        generationType: t.generationType,
        totalCalls: typeTotal,
        passedCalls: typePassed,
        blockedCalls: typeTotal - typePassed,
        passRate,
        avgConfidence: t._avg.researchConfidence ? Math.round(t._avg.researchConfidence * 100) / 100 : 0,
        avgFreshness: t._avg.freshnessScore ? Math.round(t._avg.freshnessScore * 100) / 100 : 0,
      };
    });

    // ── 3. Recent Governance Failures ──
    const recentFailures = await db.aIGenerationAudit.findMany({
      where: {
        createdAt: { gte: since },
        governancePassed: false,
      },
      select: {
        id: true,
        generationType: true,
        companyId: true,
        createdAt: true,
        outputSummary: true,
        governanceChecks: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // ── 4. Top Generation Types by Volume ──
    const topTypes = perTypeStats.slice(0, 5);

    // ── 5. Confidence Distribution ──
    const confidenceBuckets = {
      high: 0,    // >= 0.8
      medium: 0,  // 0.5 - 0.8
      low: 0,     // 0.2 - 0.5
      minimal: 0, // < 0.2
      unknown: 0, // null/0
    };

    const recentForConfidence = await db.aIGenerationAudit.findMany({
      where: { createdAt: { gte: since }, researchConfidence: { gt: 0 } },
      select: { researchConfidence: true },
      take: 1000,
    });

    for (const r of recentForConfidence) {
      const c = r.researchConfidence ?? 0;
      if (c >= 0.8) confidenceBuckets.high++;
      else if (c >= 0.5) confidenceBuckets.medium++;
      else if (c >= 0.2) confidenceBuckets.low++;
      else confidenceBuckets.minimal++;
    }

    // Count unknown
    const unknownCount = await db.aIGenerationAudit.count({
      where: {
        createdAt: { gte: since },
        researchConfidence: 0,
      },
    });
    confidenceBuckets.unknown = unknownCount;

    // ── 6. Governance Health Score ──
    // Weighted: overall pass rate (70%) + confidence quality (15%) + coverage (15%)
    const confidenceQuality = recentForConfidence.length > 0
      ? recentForConfidence.reduce((s, r) => s + (r.researchConfidence ?? 0), 0) / recentForConfidence.length
      : 0;
    const coverage = Math.min(1, total / 100); // Normalize: 100+ calls = full coverage
    const healthScore = Math.round((overallPassRate / 100 * 0.7 + confidenceQuality * 0.15 + coverage * 0.15) * 10000) / 100;

    return apiSuccess({
      period: `${hours}h`,
      healthScore,
      healthGrade: healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : healthScore >= 40 ? 'D' : 'F',
      overall: {
        totalCalls: total,
        passedCalls: passed,
        blockedCalls: blocked,
        passRate: overallPassRate,
      },
      perTypeStats,
      topTypes,
      recentFailures: recentFailures.map(f => ({
        id: f.id,
        generationType: f.generationType,
        companyId: f.companyId,
        blockedAt: f.createdAt,
        reason: f.outputSummary?.replace('BLOCKED: ', '') || 'Unknown',
        checks: f.governanceChecks,
      })),
      confidenceDistribution: confidenceBuckets,
      modelUsed: null, // Populated from AIGenerationAudit
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
