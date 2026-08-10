/**
 * CRO Dashboard API (Wave 7)
 *
 * GET /api/cro-dashboard — Chief Revenue Officer's command center
 *
 * Revenue-focused dashboard aggregating:
 * - Revenue Pipeline Health (weighted value, coverage ratio, AI forecast)
 * - Pipeline Risk Analysis (stale deals, at-risk accounts, concentration)
 * - AI Intelligence Quality (signal coverage, insight freshness, scoring accuracy)
 * - Seller Effectiveness (conversion rates, velocity, activity metrics)
 * - Market Signals (trending signals, industry patterns, opportunity alerts)
 * - Data Health (completeness, staleness, enrichment status)
 *
 * This is NOT a SaaS admin dashboard. It's a dedicated instance's
 * revenue operations command center.
 *
 * Optimized: 12 DB queries → 6 queries with 30s TTL cache.
 */

import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { dashboardCache } from '@/lib/dashboard-cache';
import { getCroSignalCounts, getCroCompanyCounts } from '@/lib/dashboard-queries';

/**
 * Core CRO dashboard computation — separated for caching.
 * Returns the full response body (without generatedAt, which is set per-request).
 * Also persists a summary AI insight as a side effect (only on cache miss).
 */
async function computeCroDashboard() {
  const now = Date.now();
  const day = 86400000;
  const thirtyDaysAgo = new Date(now - 30 * day);

  // ── Cached aggregation queries (5 queries → 2) ──
  const [signalCounts, companyCounts] = await Promise.all([
    getCroSignalCounts(thirtyDaysAgo),
    getCroCompanyCounts(),
  ]);

  const { totalSignals, signalsLast30Days, companiesWithSignalsCount } = signalCounts;
  const { totalCompanies, enrichedCompanies, companiesWithoutIndustry } = companyCounts;

  // ──────────────────────────────────────────────────────
  // 1. Revenue Pipeline Health
  // ──────────────────────────────────────────────────────

  const allPursuits = await db.pursuit.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
    include: {
      opportunity: {
        include: { company: { select: { id: true, rawName: true, normalizedName: true, industry: true } } },
      },
    },
  });

  const activePursuits = allPursuits.filter(p => p.status === 'active');
  const closedWon = allPursuits.filter(p => p.outcomeStage === 'closed_won');
  const closedLost = allPursuits.filter(p => p.outcomeStage === 'closed_lost');
  const closedThisMonth = closedWon.filter(p => p.updatedAt >= thirtyDaysAgo);
  const lostThisMonth = closedLost.filter(p => p.updatedAt >= thirtyDaysAgo);

  const totalPipelineValue = activePursuits.reduce((s, p) => s + (p.opportunity?.opportunityScore || 0), 0);
  const weightedPipelineValue = activePursuits.reduce((s, p) => {
    const stageMult = p.outcomeStage === 'negotiation' ? 0.8 : p.outcomeStage === 'proposal' ? 0.5 : p.outcomeStage === 'qualification' ? 0.3 : p.outcomeStage === 'discovery' ? 0.15 : 0.1;
    return s + ((p.opportunity?.opportunityScore || 0) * stageMult);
  }, 0);

  const stageDistribution: Record<string, number> = {};
  for (const p of activePursuits) {
    const stage = p.outcomeStage || 'discovery';
    stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
  }

  const winRate = closedWon.length + closedLost.length > 0
    ? parseFloat(((closedWon.length / (closedWon.length + closedLost.length)) * 100).toFixed(1))
    : 0;

  // Pipeline coverage ratio (active pipeline / target)
  const pipelineCoverage = activePursuits.length >= 10 ? 'healthy' : activePursuits.length >= 5 ? 'adequate' : 'insufficient';

  // ──────────────────────────────────────────────────────
  // 2. Pipeline Risk Analysis
  // ──────────────────────────────────────────────────────

  const staleDeals = activePursuits.filter(p => {
    if (!p.lastActivityAt) return true;
    return (now - p.lastActivityAt.getTime()) > 14 * day;
  });

  const unassignedDeals = activePursuits.filter(p => !p.owner);
  const overdueDeals = activePursuits.filter(p => p.nextActionAt && p.nextActionAt < new Date());

  // Stage concentration (top-heavy warning)
  const stageCounts = Object.values(stageDistribution);
  const totalActive = stageCounts.reduce((a, b) => a + b, 0) || 1;
  const maxStageShare = Math.max(...stageCounts) / totalActive;
  const concentrationRisk = maxStageShare > 0.6 ? 'high' : maxStageShare > 0.4 ? 'medium' : 'low';

  // Top at-risk accounts
  const atRiskAccounts = activePursuits
    .filter(p => {
      const daysSince = p.lastActivityAt ? (now - p.lastActivityAt.getTime()) / day : 30;
      return daysSince > 14 || !p.owner;
    })
    .slice(0, 5)
    .map(p => ({
      pursuitId: p.id,
      company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
      stage: p.outcomeStage || 'discovery',
      risk: !p.owner ? 'No owner' : 'Stale (14+ days)',
    }));

  // ──────────────────────────────────────────────────────
  // 3. AI Intelligence Quality
  // ──────────────────────────────────────────────────────

  const recentInsights = await db.aIInsight.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const highUrgencyInsights = recentInsights.filter(i => i.urgencyScore >= 70);
  const avgConfidence = recentInsights.length > 0
    ? recentInsights.reduce((s, i) => s + i.confidenceScore, 0) / recentInsights.length
    : 0;

  // Signal coverage — uses already-fetched counts (fixes duplicate db.company.count() bug)
  const signalCoverage = totalCompanies > 0
    ? parseFloat(((companiesWithSignalsCount / totalCompanies) * 100).toFixed(1))
    : 0;

  // ──────────────────────────────────────────────────────
  // 4. Seller Effectiveness
  // ──────────────────────────────────────────────────────

  const contacts = await db.contact.findMany({
    take: 500,
    orderBy: { createdAt: 'desc' },
  });
  const totalContacts = contacts.length;
  const sentContacts = contacts.filter(c => c.status === 'sent').length;
  const repliedContacts = contacts.filter(c => c.status === 'replied').length;
  const bouncedContacts = contacts.filter(c => c.status === 'bounced').length;

  const replyRate = sentContacts > 0 ? parseFloat(((repliedContacts / sentContacts) * 100).toFixed(1)) : 0;
  const bounceRate = sentContacts > 0 ? parseFloat(((bouncedContacts / sentContacts) * 100).toFixed(1)) : 0;

  // Velocity: avg days to close
  const avgDaysToClose = closedWon.length > 0
    ? closedWon.reduce((s, p) => s + Math.floor((now - p.createdAt.getTime()) / day), 0) / closedWon.length
    : 0;

  // ──────────────────────────────────────────────────────
  // 5. Market Signals
  // ──────────────────────────────────────────────────────

  const recentSignals = await db.companySignal.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const signalTypes: Record<string, number> = {};
  for (const s of recentSignals) {
    const t = s.signalType || 'unknown';
    signalTypes[t] = (signalTypes[t] || 0) + 1;
  }

  const trendingSignals = recentSignals.slice(0, 5).map(s => ({
    signal: s.title || s.signalType,
    company: '', // Would need join
    category: s.signalType,
    date: s.createdAt.toISOString(),
    severity: s.severity || 'normal',
  }));

  // ──────────────────────────────────────────────────────
  // 6. Data Health
  // ──────────────────────────────────────────────────────

  const enrichmentRate = totalCompanies > 0 ? parseFloat(((enrichedCompanies / totalCompanies) * 100).toFixed(1)) : 0;

  const contactsEnriched = contacts.filter(c => !!c.enrichmentData).length;
  const contactEnrichmentRate = totalContacts > 0 ? parseFloat(((contactsEnriched / totalContacts) * 100).toFixed(1)) : 0;

  const dataHealthScore = Math.round(
    (enrichmentRate * 0.4) +
    (contactEnrichmentRate * 0.3) +
    (Math.min(100, signalCoverage) * 0.2) +
    (totalCompanies > 0 ? ((totalCompanies - companiesWithoutIndustry) / totalCompanies) * 100 * 0.1 : 0)
  );

  // ──────────────────────────────────────────────────────
  // 7. Composite Revenue Health Score
  // ──────────────────────────────────────────────────────

  const revenueHealthScore = Math.round(
    (winRate > 30 ? 20 : winRate * 0.67) +
    (activePursuits.length >= 10 ? 20 : activePursuits.length * 2) +
    (replyRate > 15 ? 20 : replyRate * 1.33) +
    (concentrationRisk === 'low' ? 20 : concentrationRisk === 'medium' ? 12 : 5) +
    (dataHealthScore * 0.2)
  );

  // ──────────────────────────────────────────────────────
  // 8. Persist summary insight (side-effect, runs only on cache miss)
  // ──────────────────────────────────────────────────────

  try {
    await createInsights([{
      type: 'SIGNAL',
      title: `CRO Dashboard: Revenue Health ${revenueHealthScore}/100 — ${activePursuits.length} active deals, ${winRate}% win rate`,
      description: `Pipeline: ${totalPipelineValue} total, ${weightedPipelineValue} weighted. Risk: ${staleDeals.length} stale, ${unassignedDeals.length} unassigned. AI: ${signalsLast30Days} signals (30d), ${signalCoverage}% coverage. Data health: ${dataHealthScore}/100.`,
      evidence: [
        { source: 'pipeline-data', snippet: `${activePursuits.length} active pursuits, ${winRate}% win rate`, reliability: 0.95 },
        { source: 'ai-intelligence', snippet: `${signalsLast30Days} signals detected, ${avgConfidence.toFixed(0)}% avg AI confidence`, reliability: 0.85 },
        { source: 'data-health', snippet: `${dataHealthScore}/100 data health, ${enrichmentRate}% company enrichment`, reliability: 0.9 },
      ],
      confidenceScore: 80,
      impactScore: revenueHealthScore,
      urgencyScore: revenueHealthScore < 50 ? 75 : revenueHealthScore < 70 ? 50 : 25,
      recommendedAction: revenueHealthScore < 50
        ? 'Critical: Pipeline is insufficient — increase top-of-funnel activity immediately'
        : concentrationRisk === 'high'
        ? 'Pipeline is concentrated in one stage — focus on advancing deals'
        : 'Revenue operations are healthy — focus on closing active opportunities',
      sourceType: 'cro_dashboard_engine',
      sourceRoute: '/api/cro-dashboard',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }]);
  } catch (e) {
    logger.warn('[cro-dashboard] Failed to persist insight:', { error: e });
  }

  // Return everything except generatedAt (set per-request)
  return {
    revenueHealth: {
      score: revenueHealthScore,
      status: revenueHealthScore >= 75 ? 'strong' : revenueHealthScore >= 50 ? 'adequate' : 'needs_attention',
    },
    pipeline: {
      totalValue: totalPipelineValue,
      weightedValue: weightedPipelineValue,
      activeDeals: activePursuits.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      closedThisMonth: closedThisMonth.length,
      lostThisMonth: lostThisMonth.length,
      winRate,
      avgDaysToClose: parseFloat(avgDaysToClose.toFixed(0)),
      coverage: pipelineCoverage,
      stageDistribution,
    },
    risk: {
      staleDeals: staleDeals.length,
      unassignedDeals: unassignedDeals.length,
      overdueDeals: overdueDeals.length,
      concentrationRisk,
      staleRatio: activePursuits.length > 0 ? parseFloat(((staleDeals.length / activePursuits.length) * 100).toFixed(1)) : 0,
      atRiskAccounts,
    },
    aiIntelligence: {
      totalInsights: recentInsights.length,
      highUrgencyInsights: highUrgencyInsights.length,
      avgConfidence: parseFloat(avgConfidence.toFixed(1)),
      totalSignals,
      signalsLast30Days,
      signalCoverage,
      signalTypes,
      trendingSignals,
    },
    effectiveness: {
      totalContacts,
      sentCount: sentContacts,
      repliedCount: repliedContacts,
      bouncedCount: bouncedContacts,
      replyRate,
      bounceRate,
      avgDaysToClose: parseFloat(avgDaysToClose.toFixed(0)),
    },
    dataHealth: {
      score: dataHealthScore,
      companyEnrichmentRate: enrichmentRate,
      contactEnrichmentRate: contactEnrichmentRate,
      companiesWithoutIndustry,
      totalCompanies,
    },
  };
}

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    // ── Cached computation (12 DB queries → 6) ──
    const data = await dashboardCache.cached(
      'cro-dashboard:main',
      computeCroDashboard,
    );

    return apiSuccess({
      ...data,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[cro-dashboard] Error:', { error: error });
    return apiError('Failed to generate CRO dashboard', 500);
  }
}
