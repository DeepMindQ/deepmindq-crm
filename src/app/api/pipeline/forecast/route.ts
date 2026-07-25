import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';

export async function GET() {
  try {
    // ── 1. Fetch all pursuits (active + closed) ──
    const allPursuits = await db.pursuit.findMany({
      include: {
        opportunity: { include: { company: { select: { id: true, rawName: true, normalizedName: true } } } },
      },
    });

    const activePursuits = allPursuits.filter(p => p.status === 'active');
    const closedPursuits = allPursuits.filter(p =>
      p.outcomeStage === 'closed_won' || p.outcomeStage === 'closed_lost'
    );

    // ── 2. Stage distribution for active ──
    const stageOrder = ['discovery', 'qualification', 'proposal', 'negotiation'];
    const currentStageCounts: Record<string, number> = {};
    for (const stage of stageOrder) {
      currentStageCounts[stage] = activePursuits.filter(p => p.outcomeStage === stage).length;
    }

    // ── 3. Historical conversion rates between stages ──
    const conversionRates: Record<string, number> = {};
    for (let i = 0; i < stageOrder.length; i++) {
      const inStage = allPursuits.filter(p => p.outcomeStage === stageOrder[i]).length;
      const nextStage = stageOrder[i + 1] || 'closed_won';
      const advanced = allPursuits.filter(p => {
        const stageIdx = stageOrder.indexOf(p.outcomeStage || '');
        return stageIdx > i || p.outcomeStage === 'closed_won';
      }).length;
      conversionRates[stageOrder[i]] = inStage > 0 ? parseFloat(((advanced / inStage) * 100).toFixed(1)) : 20;
    }

    // ── 4. Velocity metrics ──
    const now = Date.now();
    const stageDaysArrays: Record<string, number[]> = {};
    for (const stage of stageOrder) {
      stageDaysArrays[stage] = [];
    }

    for (const p of allPursuits) {
      if (!p.outcomeStage || !p.createdAt) continue;
      if (stageDaysArrays[p.outcomeStage]) {
        stageDaysArrays[p.outcomeStage].push(
          Math.floor((now - p.createdAt.getTime()) / 86400000)
        );
      }
    }

    const avgDaysPerStage: Record<string, number> = {};
    for (const [stage, days] of Object.entries(stageDaysArrays)) {
      avgDaysPerStage[stage] = days.length > 0
        ? parseFloat((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1))
        : 14; // default 14 days if no data
    }

    // Average days to close (from created to closed_won)
    const closedWon = closedPursuits.filter(p => p.outcomeStage === 'closed_won');
    const avgDaysToClose = closedWon.length > 0
      ? parseFloat((closedWon.reduce((sum, p) => {
          const days = p.createdAt ? Math.floor((now - p.createdAt.getTime()) / 86400000) : 0;
          return sum + days;
        }, 0) / closedWon.length).toFixed(1))
      : 45; // default estimate

    // ── 5. Projected closes ──
    const negotiationCount = currentStageCounts['negotiation'] || 0;
    const proposalCount = currentStageCounts['proposal'] || 0;
    const qualCount = currentStageCounts['qualification'] || 0;
    const discCount = currentStageCounts['discovery'] || 0;

    const convProposal = (conversionRates['proposal'] || 20) / 100;
    const convNegotiation = (conversionRates['negotiation'] || 30) / 100;

    const projectedCloses = {
      thisWeek: Math.round(negotiationCount * convNegotiation * 0.3),
      thisMonth: Math.round(negotiationCount * convNegotiation + proposalCount * convProposal * convNegotiation * 0.5),
      thisQuarter: Math.round(
        negotiationCount * convNegotiation +
        proposalCount * convProposal * convNegotiation +
        qualCount * (conversionRates['qualification'] || 20) / 100 * convProposal * convNegotiation * 0.3
      ),
    };

    // ── 6. Weighted pipeline value ──
    const weightedPipelineValue = activePursuits.reduce((sum, p) => {
      return sum + (p.opportunity?.opportunityScore || 0);
    }, 0);

    // ── 7. Stage forecast ──
    const stageForecast = stageOrder.map(stage => {
      const count = currentStageCounts[stage] || 0;
      const convRate = (conversionRates[stage] || 20) / 100;
      const avgDays = avgDaysPerStage[stage] || 14;

      return {
        stage,
        currentCount: count,
        expectedToAdvance: Math.round(count * convRate),
        expectedToClose: Math.round(count * convRate * convRate * (stage === 'negotiation' ? 1 : 0.5)),
        expectedToLose: Math.round(count * 0.1),
        avgDaysToNextStage: avgDays,
      };
    });

    // ── 8. Fastest & slowest deals ──
    const dealsWithDuration = allPursuits
      .filter(p => p.createdAt && (p.outcomeStage === 'closed_won' || p.outcomeStage === 'closed_lost'))
      .map(p => ({
        pursuitId: p.id,
        title: p.opportunity?.opportunityTitle || 'Untitled',
        company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
        days: Math.floor((now - p.createdAt.getTime()) / 86400000),
        outcome: p.outcomeStage,
      }))
      .sort((a, b) => a.days - b.days);

    // ── 9. Pipeline health score ──
    const healthFactors: Array<{ factor: string; score: number; description: string }> = [];

    // Factor 1: Pipeline coverage (more active deals = healthier)
    const coverageScore = Math.min(100, activePursuits.length * 10);
    healthFactors.push({ factor: 'Pipeline Coverage', score: coverageScore, description: `${activePursuits.length} active pursuits` });

    // Factor 2: Stage balance (not all stuck in one stage)
    const stageCounts = Object.values(currentStageCounts);
    const totalActive = stageCounts.reduce((a, b) => a + b, 0) || 1;
    const maxStageShare = Math.max(...stageCounts.map(c => c / totalActive));
    const balanceScore = Math.max(0, 100 - (maxStageShare - 0.4) * 200);
    healthFactors.push({ factor: 'Stage Balance', score: Math.round(balanceScore), description: maxStageShare > 0.6 ? 'Too concentrated in one stage' : 'Well distributed across stages' });

    // Factor 3: Win rate
    const winRate = allPursuits.length > 0 ? (closedWon.length / closedPursuits.length) * 100 : 0;
    healthFactors.push({ factor: 'Win Rate', score: Math.round(Math.min(100, winRate * 2)), description: `${winRate.toFixed(0)}% of closed deals won` });

    // Factor 4: Velocity
    const velocityScore = avgDaysToClose <= 30 ? 100 : avgDaysToClose <= 60 ? 75 : avgDaysToClose <= 90 ? 50 : 25;
    healthFactors.push({ factor: 'Sales Velocity', score: velocityScore, description: `Avg ${avgDaysToClose} days to close` });

    // Factor 5: Stale deals ratio
    const staleRatio = activePursuits.length > 0
      ? activePursuits.filter(p => {
          if (!p.lastActivityAt) return true;
          return (now - p.lastActivityAt.getTime()) > 14 * 86400000;
        }).length / activePursuits.length
      : 0;
    const freshnessScore = Math.max(0, 100 - staleRatio * 200);
    healthFactors.push({ factor: 'Deal Freshness', score: Math.round(freshnessScore), description: `${(staleRatio * 100).toFixed(0)}% of deals are stale (14+ days inactive)` });

    const pipelineHealthScore = Math.round(
      healthFactors.reduce((sum, f) => sum + f.score, 0) / healthFactors.length
    );

    // ── 10. Recommendations ──
    const recommendations: Array<{ action: string; impact: string; priority: string }> = [];
    if (staleRatio > 0.3) recommendations.push({ action: 'Run pipeline hygiene review — re-engage or close stale deals', impact: 'Improve pipeline accuracy and rep focus', priority: 'high' });
    if (activePursuits.filter(p => !p.owner).length > 0) recommendations.push({ action: 'Assign owners to all unassigned pursuits', impact: 'Increase accountability and deal progression', priority: 'high' });
    if (currentStageCounts['discovery'] > totalActive * 0.5) recommendations.push({ action: 'Focus on advancing discovery deals to qualification', impact: 'Move deals through the pipeline faster', priority: 'medium' });
    if (winRate < 30 && closedPursuits.length > 5) recommendations.push({ action: 'Analyze lost deals for common patterns and adjust qualification criteria', impact: 'Improve close rates by focusing on better-qualified opportunities', priority: 'medium' });
    if (avgDaysToClose > 60) recommendations.push({ action: 'Implement stage-based SLAs to maintain deal momentum', impact: 'Reduce sales cycle length', priority: 'medium' });
    if (activePursuits.length < 5) recommendations.push({ action: 'Increase top-of-funnel activity — generate more opportunity recommendations', impact: 'Build pipeline coverage for consistent revenue', priority: 'high' });

    // ── 11. Persist forecast as AI Insight ──
    try {
      await createInsights([{
        type: 'FORECAST' as const,
        title: `Pipeline Forecast: ${activePursuits.length} active deals, ${projectedCloses.thisMonth} projected closes this month`,
        description: `Health score ${pipelineHealthScore}/100. Weighted pipeline: ${weightedPipelineValue}. Avg days to close: ${avgDaysToClose}.`,
        evidence: healthFactors.map(f => ({ source: 'forecast-engine', snippet: `${f.factor}: ${f.score}/100 — ${f.description}`, reliability: 0.9 })),
        confidenceScore: 70,
        impactScore: pipelineHealthScore,
        urgencyScore: pipelineHealthScore < 50 ? 70 : 30,
        reasoning: `Based on ${allPursuits.length} total pursuits, ${activePursuits.length} active, ${closedWon.length} closed-won`,
        recommendedAction: recommendations[0]?.action || 'Monitor pipeline health weekly',
        sourceType: 'pipeline_forecast_engine',
        sourceRoute: '/api/pipeline/forecast',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }]);
    } catch (e) {
      console.warn('[pipeline/forecast] Failed to persist insight:', e);
    }

    return apiSuccess({
      totalActivePipeline: activePursuits.length,
      totalActivePursuits: activePursuits.length,
      weightedPipelineValue,
      projectedCloses,
      stageForecast,
      avgDaysToClose,
      avgDaysPerStage,
      fastestDeals: dealsWithDuration.slice(0, 3),
      slowestDeals: dealsWithDuration.slice(-3).reverse(),
      pipelineHealthScore,
      healthFactors,
      recommendations,
    });
  } catch (error) {
    console.error('[pipeline/forecast] Error:', error);
    return apiError('Failed to generate pipeline forecast', 500);
  }
}
