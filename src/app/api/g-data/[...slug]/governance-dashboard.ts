/**
 * Governance Dashboard API (Phase 4 B4)
 *
 * Provides visibility into AI governance across the platform:
 *   - Generation volume and success rates by type
 *   - Governance pass/fail rates
 *   - Confidence and freshness score distributions
 *   - Recent blocked generations
 *   - Company-level governance health
 *
 * GET /api/g-data/governance-dashboard
 * Query params:
 *   - period: "7d" (default) | "30d" | "90d" | "all"
 *   - companyId: optional — filter to specific company
 */
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const companyId = searchParams.get('companyId') || null;

    // Calculate date range
    const now = new Date();
    let since: Date;
    switch (period) {
      case '30d': since = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': since = new Date(now.getTime() - 90 * 86400000); break;
      case 'all': since = new Date('2020-01-01'); break;
      default: since = new Date(now.getTime() - 7 * 86400000); break;
    }

    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (companyId) where.companyId = companyId;

    // 1. Overall stats
    const [totalGenerations, passedGenerations, blockedGenerations] = await Promise.all([
      db.aIGenerationAudit.count({ where }),
      db.aIGenerationAudit.count({ where: { ...where, governancePassed: true } }),
      db.aIGenerationAudit.count({ where: { ...where, governancePassed: false } }),
    ]);

    // 2. By generation type — all counts
    const allByType = await db.aIGenerationAudit.groupBy({
      by: ['generationType'],
      where,
      _count: { id: true },
    });

    // Blocked counts per type (separate query instead of having)
    const blockedByTypeQuery = await db.aIGenerationAudit.groupBy({
      by: ['generationType'],
      where: { ...where, governancePassed: false },
      _count: { id: true },
    });

    const totalByTypeMap = new Map(allByType.map(t => [t.generationType, t._count.id]));
    const blockedByTypeMap = new Map(blockedByTypeQuery.map(t => [t.generationType, t._count.id]));

    const generationTypeBreakdown = allByType.map(t => {
      const total = t._count.id;
      const blocked = blockedByTypeMap.get(t.generationType) || 0;
      return {
        type: t.generationType,
        total,
        blocked,
        passRate: total > 0
          ? Math.round(((total - blocked) / total) * 100)
          : 100,
      };
    });

    // 3 & 4. Confidence + Freshness distributions (single fetch)
    const allRecords = await db.aIGenerationAudit.findMany({
      where,
      select: { researchConfidence: true, freshnessScore: true },
    });

    const confidenceDistribution = { high: 0, medium: 0, low: 0, unknown: 0 };
    const freshnessDistribution = { fresh: 0, adequate: 0, stale: 0, unknown: 0 };

    for (const r of allRecords) {
      // Confidence buckets
      if (r.researchConfidence >= 0.6) confidenceDistribution.high++;
      else if (r.researchConfidence >= 0.3) confidenceDistribution.medium++;
      else if (r.researchConfidence > 0) confidenceDistribution.low++;
      else confidenceDistribution.unknown++;

      // Freshness buckets
      if (r.freshnessScore >= 60) freshnessDistribution.fresh++;
      else if (r.freshnessScore >= 30) freshnessDistribution.adequate++;
      else if (r.freshnessScore > 0) freshnessDistribution.stale++;
      else freshnessDistribution.unknown++;
    }

    // 5. Recent blocked generations (last 10)
    const recentBlocked = await db.aIGenerationAudit.findMany({
      where: { ...where, governancePassed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        generationType: true,
        companyId: true,
        researchConfidence: true,
        freshnessScore: true,
        governanceChecks: true,
        outputSummary: true,
        createdAt: true,
      },
    });

    // 6. Company-level governance health (top companies by generation count)
    const companyHealth = await db.aIGenerationAudit.groupBy({
      by: ['companyId'],
      where: { ...where, companyId: { not: null } },
      _count: { id: true },
      _avg: { researchConfidence: true, freshnessScore: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get pass counts per company
    const companyPassed = await db.aIGenerationAudit.groupBy({
      by: ['companyId'],
      where: { ...where, companyId: { not: null }, governancePassed: true },
      _count: { id: true },
    });
    const passedMap = new Map(companyPassed.map(c => [c.companyId, c._count.id]));

    // Resolve company names
    const companyIds = companyHealth.map(c => c.companyId!).filter(Boolean);
    const companies = companyIds.length > 0
      ? await db.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, rawName: true },
        })
      : [];
    const companyNameMap = new Map(companies.map(c => [c.id, c.rawName]));

    const companyBreakdown = companyHealth.map(c => {
      const total = c._count.id;
      const passed = passedMap.get(c.companyId!) || 0;
      return {
        companyId: c.companyId,
        companyName: companyNameMap.get(c.companyId!) || 'Unknown',
        totalGenerations: total,
        passedGenerations: passed,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        avgConfidence: c._avg.researchConfidence != null ? Math.round(c._avg.researchConfidence * 100) : null,
        avgFreshness: c._avg.freshnessScore != null ? Math.round(c._avg.freshnessScore) : null,
      };
    });

    // Compute averages from allRecords
    const avgConfidence = allRecords.length > 0
      ? Math.round((allRecords.reduce((s, r) => s + r.researchConfidence, 0) / allRecords.length) * 100)
      : 0;
    const avgFreshness = allRecords.length > 0
      ? Math.round(allRecords.reduce((s, r) => s + r.freshnessScore, 0) / allRecords.length)
      : 0;

    return apiSuccess({
      period,
      summary: {
        totalGenerations,
        passedGenerations,
        blockedGenerations,
        passRate: totalGenerations > 0 ? Math.round((passedGenerations / totalGenerations) * 100) : 100,
        avgConfidence,
        avgFreshness,
      },
      generationTypeBreakdown,
      confidenceDistribution,
      freshnessDistribution,
      recentBlocked,
      companyBreakdown,
    });
  } catch (err) {
    console.error('[governance-dashboard]', err);
    return apiError('Failed to load governance dashboard', 500);
  }
}