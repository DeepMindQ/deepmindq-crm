import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

const SALES_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    // ── 1. Fetch all pursuits with opportunity data ──
    const pursuits = await db.pursuit.findMany({
      where: { status: 'active' },
      include: {
        opportunity: { include: { company: { select: { id: true, rawName: true, normalizedName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allPursuits = await db.pursuit.findMany({
      include: {
        opportunity: { include: { company: { select: { id: true, rawName: true, normalizedName: true } } } },
      },
    });

    // ── 2. Stage distribution ──
    const opportunitiesByStage: Record<string, number> = {};
    const opportunitiesByPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const p of allPursuits) {
      const stage = p.outcomeStage || 'discovery';
      opportunitiesByStage[stage] = (opportunitiesByStage[stage] || 0) + 1;
      const pri = p.priority || 'medium';
      opportunitiesByPriority[pri] = (opportunitiesByPriority[pri] || 0) + 1;
    }

    // ── 3. Velocity: avg days in each stage ──
    const stageDaysMap: Record<string, number[]> = {};
    for (const p of allPursuits) {
      if (!p.outcomeStage || !p.createdAt) continue;
      const stage = p.outcomeStage;
      const days = Math.floor((Date.now() - p.createdAt.getTime()) / 86400000);
      if (!stageDaysMap[stage]) stageDaysMap[stage] = [];
      stageDaysMap[stage].push(days);
    }

    const avgDaysInStage: Record<string, number> = {};
    for (const [stage, days] of Object.entries(stageDaysMap)) {
      avgDaysInStage[stage] = days.length > 0 ? parseFloat((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)) : 0;
    }

    // ── 4. Conversion rates ──
    const totalCreated = allPursuits.length;
    const closedWon = allPursuits.filter(p => p.outcomeStage === 'closed_won').length;
    const closedLost = allPursuits.filter(p => p.outcomeStage === 'closed_lost').length;
    const overallConversionRate = totalCreated > 0 ? parseFloat(((closedWon / totalCreated) * 100).toFixed(1)) : 0;

    const stageConversionRates: Array<{ from: string; to: string; rate: number }> = [];
    const stageOrder = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won'];
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const fromCount = allPursuits.filter(p => p.outcomeStage === stageOrder[i]).length;
      const toCount = allPursuits.filter(p => p.outcomeStage === stageOrder[i + 1]).length;
      stageConversionRates.push({
        from: stageOrder[i],
        to: stageOrder[i + 1],
        rate: fromCount > 0 ? parseFloat(((toCount / fromCount) * 100).toFixed(1)) : 0,
      });
    }

    // ── 5. Stale & at-risk deals ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const staleDeals = pursuits.filter(p => {
      if (!p.lastActivityAt) return true;
      return p.lastActivityAt < sevenDaysAgo;
    });

    const now = Date.now();
    const atRiskDeals = pursuits
      .map(p => {
        let riskScore = 0;
        const factors: string[] = [];

        const daysSinceActivity = p.lastActivityAt
          ? Math.floor((now - p.lastActivityAt.getTime()) / 86400000)
          : 30;

        if (daysSinceActivity > 14) { riskScore += 30; factors.push('No activity in 14+ days'); }
        else if (daysSinceActivity > 7) { riskScore += 15; factors.push('No activity in 7+ days'); }

        if (!p.owner) { riskScore += 20; factors.push('No owner assigned'); }
        if (!p.nextAction) { riskScore += 15; factors.push('No next action set'); }
        if (p.nextActionAt && p.nextActionAt < new Date()) { riskScore += 25; factors.push('Next action overdue'); }
        if (p.opportunity && p.opportunity.confidenceScore < 40) { riskScore += 15; factors.push('Low confidence score'); }

        const daysInStage = p.createdAt ? Math.floor((now - p.createdAt.getTime()) / 86400000) : 0;
        if (daysInStage > 30) { riskScore += 20; factors.push(`In ${p.outcomeStage || 'current'} stage for 30+ days`); }

        return {
          pursuitId: p.id,
          opportunityId: p.opportunityId,
          title: p.opportunity?.opportunityTitle || 'Untitled',
          company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
          riskScore: Math.min(100, riskScore),
          riskFactors: factors,
          daysSinceActivity,
          stage: p.outcomeStage || 'discovery',
        };
      })
      .filter(d => d.riskScore >= 30)
      .sort((a, b) => b.riskScore - a.riskScore);

    const totalPipelineValue = pursuits.reduce((sum, p) => sum + (p.opportunity?.opportunityScore || 0), 0);

    // ── 6. Risk summary ──
    const topRisks = atRiskDeals.slice(0, 5);
    const riskHigh = atRiskDeals.filter(d => d.riskScore >= 71).length;
    const riskMedium = atRiskDeals.filter(d => d.riskScore >= 51 && d.riskScore <= 70).length;
    const riskLow = atRiskDeals.filter(d => d.riskScore >= 30 && d.riskScore <= 50).length;

    return apiSuccess({
      totalOpportunities: allPursuits.length,
      opportunitiesByStage,
      opportunitiesByPriority,
      avgDaysInStage,
      overallConversionRate,
      stageConversionRates,
      staleDeals: staleDeals.length,
      atRiskDeals: atRiskDeals.length,
      totalPipelineValue,
      riskSummary: {
        total: atRiskDeals.length,
        high: riskHigh,
        medium: riskMedium,
        low: riskLow,
        topRisks,
      },
    });
  } catch (error) {
    logger.error('[pipeline/health] Error:', { error: error });
    return apiError('Failed to compute pipeline health', 500);
  }
}
