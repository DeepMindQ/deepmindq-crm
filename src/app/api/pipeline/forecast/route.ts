/**
 * AI-Powered Pipeline Forecast API (Wave 4.4 enhanced)
 *
 * GET /api/pipeline/forecast — Evidence-backed AI pipeline intelligence
 *
 * Enhanced with:
 * - AI Evidence Framework (every forecast backed by evidence)
 * - AI Reliability tracking
 * - Deal-level risk assessment with evidence
 * - Confidence calibration based on data quality
 */

import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { buildScoreBreakdown, factor, persistScoreAsInsight } from '@/lib/ai-evidence-framework';
import { trackGeneration, assessHallucinationRisk, assessFreshness, calibrateConfidence } from '@/lib/ai-reliability';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

const startMs = Date.now();

  try {
    // ── 1. Fetch all pursuits (active + closed) ──
    const allPursuits = await db.pursuit.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
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
        : 14;
    }

    const closedWon = closedPursuits.filter(p => p.outcomeStage === 'closed_won');
    const avgDaysToClose = closedWon.length > 0
      ? parseFloat((closedWon.reduce((sum, p) => {
          const days = p.createdAt ? Math.floor((now - p.createdAt.getTime()) / 86400000) : 0;
          return sum + days;
        }, 0) / closedWon.length).toFixed(1))
      : 45;

    // ── 5. Projected closes ──
    const negotiationCount = currentStageCounts['negotiation'] || 0;
    const proposalCount = currentStageCounts['proposal'] || 0;
    const qualCount = currentStageCounts['qualification'] || 0;

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

    // ── 9. Pipeline Health Score (Evidence-Backed) ──

    // Factor 1: Pipeline coverage
    const coverageScore = Math.min(100, activePursuits.length * 10);

    // Factor 2: Stage balance
    const stageCounts = Object.values(currentStageCounts);
    const totalActive = stageCounts.reduce((a, b) => a + b, 0) || 1;
    const maxStageShare = Math.max(...stageCounts.map(c => c / totalActive));
    const balanceScore = Math.max(0, 100 - (maxStageShare - 0.4) * 200);

    // Factor 3: Win rate
    const winRate = closedPursuits.length > 0 ? (closedWon.length / closedPursuits.length) * 100 : 0;
    const winRateScore = Math.round(Math.min(100, winRate * 2));

    // Factor 4: Velocity
    const velocityScore = avgDaysToClose <= 30 ? 100 : avgDaysToClose <= 60 ? 75 : avgDaysToClose <= 90 ? 50 : 25;

    // Factor 5: Deal freshness
    const staleRatio = activePursuits.length > 0
      ? activePursuits.filter(p => {
          if (!p.lastActivityAt) return true;
          return (now - p.lastActivityAt.getTime()) > 14 * 86400000;
        }).length / activePursuits.length
      : 0;
    const freshnessScore = Math.max(0, 100 - staleRatio * 200);

    // Build score breakdown using AI Evidence Framework
    const healthBreakdown = buildScoreBreakdown({
      factors: [
        factor('coverage', 'Pipeline Coverage', coverageScore, 100, `${activePursuits.length} active pursuits`, 'pipeline-data'),
        factor('balance', 'Stage Balance', Math.round(balanceScore), 100, maxStageShare > 0.6 ? 'Too concentrated in one stage' : 'Well distributed across stages', 'pipeline-analysis'),
        factor('win_rate', 'Win Rate', winRateScore, 100, `${winRate.toFixed(0)}% of closed deals won`, 'pipeline-data'),
        factor('velocity', 'Sales Velocity', velocityScore, 100, `Avg ${avgDaysToClose} days to close`, 'pipeline-data'),
        factor('freshness', 'Deal Freshness', Math.round(freshnessScore), 100, `${(staleRatio * 100).toFixed(0)}% of deals are stale (14+ days inactive)`, 'pipeline-data'),
      ],
      confidence: 70,
      recommendedAction: staleRatio > 0.3 ? 'Run pipeline hygiene review — re-engage or close stale deals' : 'Monitor pipeline health weekly',
    });

    // ── 10. AI Risk Assessment for At-Risk Deals ──
    const atRiskDeals = activePursuits
      .map(p => {
        let riskScore = 0;
        const riskFactors: Array<{ factor: string; severity: 'critical' | 'high' | 'medium'; evidence: string }> = [];

        const daysSinceActivity = p.lastActivityAt
          ? Math.floor((now - p.lastActivityAt.getTime()) / 86400000)
          : 30;

        if (daysSinceActivity > 14) { riskScore += 30; riskFactors.push({ factor: 'No activity in 14+ days', severity: 'critical', evidence: `Last activity: ${p.lastActivityAt ? p.lastActivityAt.toISOString() : 'never'}` }); }
        else if (daysSinceActivity > 7) { riskScore += 15; riskFactors.push({ factor: 'No activity in 7+ days', severity: 'high', evidence: `Last activity: ${p.lastActivityAt ? p.lastActivityAt.toISOString() : 'never'}` }); }

        if (!p.owner) { riskScore += 20; riskFactors.push({ factor: 'No owner assigned', severity: 'high', evidence: 'Pursuit has no assigned owner' }); }
        if (!p.nextAction) { riskScore += 15; riskFactors.push({ factor: 'No next action set', severity: 'medium', evidence: 'No planned next step' }); }
        if (p.nextActionAt && p.nextActionAt < new Date()) { riskScore += 25; riskFactors.push({ factor: 'Next action overdue', severity: 'critical', evidence: `Was due: ${p.nextActionAt.toISOString()}` }); }
        if (p.opportunity && p.opportunity.confidenceScore < 40) { riskScore += 15; riskFactors.push({ factor: 'Low confidence score', severity: 'medium', evidence: `Confidence: ${p.opportunity.confidenceScore}` }); }

        const daysInStage = p.createdAt ? Math.floor((now - p.createdAt.getTime()) / 86400000) : 0;
        if (daysInStage > 30) { riskScore += 20; riskFactors.push({ factor: `Stuck in ${p.outcomeStage || 'current'} stage for 30+ days`, severity: 'high', evidence: `In stage for ${daysInStage} days` }); }

        return {
          pursuitId: p.id,
          opportunityId: p.opportunityId,
          title: p.opportunity?.opportunityTitle || 'Untitled',
          company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
          companyId: p.opportunity?.companyId,
          riskScore: Math.min(100, riskScore),
          riskCategory: riskScore >= 71 ? 'critical' : riskScore >= 51 ? 'elevated' : riskScore >= 30 ? 'at_risk' : 'normal',
          riskFactors,
          daysSinceActivity,
          stage: p.outcomeStage || 'discovery',
        };
      })
      .filter(d => d.riskScore >= 30)
      .sort((a, b) => b.riskScore - a.riskScore);

    // ── 11. Evidence-Backed Recommendations ──
    const recommendations: Array<{ action: string; impact: string; priority: string; evidence: string }> = [];
    if (staleRatio > 0.3) recommendations.push({ action: 'Run pipeline hygiene review — re-engage or close stale deals', impact: 'Improve pipeline accuracy and rep focus', priority: 'high', evidence: `${(staleRatio * 100).toFixed(0)}% stale rate exceeds 30% threshold` });
    if (activePursuits.filter(p => !p.owner).length > 0) recommendations.push({ action: 'Assign owners to all unassigned pursuits', impact: 'Increase accountability and deal progression', priority: 'high', evidence: `${activePursuits.filter(p => !p.owner).length} unassigned pursuits` });
    if (currentStageCounts['discovery'] > totalActive * 0.5) recommendations.push({ action: 'Focus on advancing discovery deals to qualification', impact: 'Move deals through the pipeline faster', priority: 'medium', evidence: `${Math.round((currentStageCounts['discovery'] / totalActive) * 100)}% of pipeline stuck in discovery` });
    if (winRate < 30 && closedPursuits.length > 5) recommendations.push({ action: 'Analyze lost deals for common patterns and adjust qualification criteria', impact: 'Improve close rates by focusing on better-qualified opportunities', priority: 'medium', evidence: `Win rate ${winRate.toFixed(0)}% below 30% threshold` });
    if (avgDaysToClose > 60) recommendations.push({ action: 'Implement stage-based SLAs to maintain deal momentum', impact: 'Reduce sales cycle length', priority: 'medium', evidence: `Avg ${avgDaysToClose} days exceeds 60-day target` });
    if (activePursuits.length < 5) recommendations.push({ action: 'Increase top-of-funnel activity — generate more opportunity recommendations', impact: 'Build pipeline coverage for consistent revenue', priority: 'high', evidence: `Only ${activePursuits.length} active pursuits (below 5 minimum)` });

    // ── 12. AI Confidence Calibration ──
    const hallucinationRisk = assessHallucinationRisk({
      evidenceCount: healthBreakdown.factors.length,
      confidenceScore: healthBreakdown.confidence,
      hasContradictions: false,
      sourceReliability: 0.9, // DB data is high reliability
      isNovelClaim: false,
      hasSpecificNumbers: true,
      reasoningDepth: 70,
    });

    const freshness = assessFreshness({
      signalCount: activePursuits.length,
      daysSinceLastUpdate: allPursuits.length > 0 ? 0 : 90,
      hasCurrentData: activePursuits.length > 0,
    });

    const calibratedConfidence = calibrateConfidence({
      rawConfidence: healthBreakdown.confidence,
      evidenceCount: healthBreakdown.factors.length,
      evidenceQuality: 'corroborated',
      sourceReliability: 0.9,
      hallucinationRisk,
    });

    // ── 13. Persist as AI Insight with Evidence Framework ──
    try {
      await persistScoreAsInsight(healthBreakdown, {
        entityName: 'Pipeline',
        scoreType: 'Pipeline Health',
        metadata: {
          projectedCloses,
          weightedPipelineValue,
          avgDaysToClose,
          hallucinationRisk,
          freshness,
          calibratedConfidence,
          atRiskCount: atRiskDeals.length,
        },
      });
    } catch (e) {
      logger.warn('[pipeline/forecast] Failed to persist insight:', { error: e });
    }

    // ── 14. Track generation for reliability ──
    try {
      await trackGeneration('forecast', '/api/pipeline/forecast', async () => {}, {
        modelUsed: 'pipeline_forecast_engine',
      });
    } catch {
      // Non-blocking
    }

    return apiSuccess({
      // AI Forecast (evidence-backed)
      forecast: {
        projectedCloses,
        weightedPipelineValue,
        aiConfidence: calibratedConfidence,
        evidenceQuality: 'corroborated',
        hallucinationRisk,
        freshness,
      },

      // Pipeline Health Score (evidence-backed breakdown)
      health: {
        score: healthBreakdown.totalScore,
        grade: healthBreakdown.grade,
        confidence: calibratedConfidence,
        breakdown: healthBreakdown.breakdown,
        factors: healthBreakdown.factors,
      },

      // Stage Forecast
      stageForecast,
      avgDaysPerStage,
      avgDaysToClose,

      // Deal Analytics
      fastestDeals: dealsWithDuration.slice(0, 3),
      slowestDeals: dealsWithDuration.slice(-3).reverse(),

      // At-Risk Deals (evidence-backed)
      atRiskDeals: atRiskDeals.slice(0, 10),
      totalActivePipeline: activePursuits.length,

      // Recommendations (evidence-backed)
      recommendations,
    });
  } catch (error) {
    logger.error('[pipeline/forecast] Error:', { error: error });
    return apiError('Failed to generate pipeline forecast', 500);
  }
}
