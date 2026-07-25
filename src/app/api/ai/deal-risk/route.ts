import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const minRisk = parseInt(searchParams.get('minRisk') || '0', 10);

    const where: Record<string, unknown> = { status: 'active' };
    if (companyId) where.companyId = companyId;

    const pursuits = await db.pursuit.findMany({
      where,
      include: {
        opportunity: {
          include: { company: { select: { id: true, rawName: true, normalizedName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();

    const assessments = pursuits.map(p => {
      let riskScore = 0;
      const riskFactors: Array<{ factor: string; severity: 'high' | 'medium' | 'low'; description: string }> = [];

      const daysSinceActivity = p.lastActivityAt
        ? Math.floor((now - p.lastActivityAt.getTime()) / 86400000)
        : 30;

      // Staleness
      if (daysSinceActivity > 14) {
        riskScore += 30;
        riskFactors.push({ factor: 'Stale Deal', severity: 'high', description: `No activity in ${daysSinceActivity} days` });
      } else if (daysSinceActivity > 7) {
        riskScore += 15;
        riskFactors.push({ factor: 'Aging', severity: 'medium', description: `No activity in ${daysSinceActivity} days` });
      }

      // No owner
      if (!p.owner) {
        riskScore += 20;
        riskFactors.push({ factor: 'Unassigned', severity: 'high', description: 'No sales rep assigned to this pursuit' });
      }

      // No next action
      if (!p.nextAction) {
        riskScore += 15;
        riskFactors.push({ factor: 'No Next Action', severity: 'medium', description: 'No planned next step for this deal' });
      }

      // Overdue next action
      if (p.nextActionAt && p.nextActionAt < new Date()) {
        riskScore += 25;
        riskFactors.push({ factor: 'Overdue Action', severity: 'high', description: `Next action was due ${Math.floor((now - p.nextActionAt.getTime()) / 86400000)} days ago` });
      }

      // Low confidence
      if (p.opportunity && p.opportunity.confidenceScore < 40) {
        riskScore += 15;
        riskFactors.push({ factor: 'Low Confidence', severity: 'medium', description: `Opportunity confidence is only ${p.opportunity.confidenceScore}%` });
      }

      // Stuck in stage
      const daysInStage = p.createdAt ? Math.floor((now - p.createdAt.getTime()) / 86400000) : 0;
      if (daysInStage > 30) {
        riskScore += 20;
        riskFactors.push({ factor: 'Stage Stuck', severity: 'high', description: `In ${p.outcomeStage || 'current'} stage for ${daysInStage}+ days` });
      } else if (daysInStage > 14) {
        riskScore += 10;
        riskFactors.push({ factor: 'Slow Progress', severity: 'low', description: `In ${p.outcomeStage || 'current'} stage for ${daysInStage} days` });
      }

      riskScore = Math.min(100, riskScore);

      const riskCategory = riskScore >= 71 ? 'critical' : riskScore >= 51 ? 'elevated' : riskScore >= 31 ? 'normal' : 'healthy';

      let recommendedAction = 'Continue current approach';
      if (riskScore >= 71) recommendedAction = 'Immediate intervention needed: re-engage with prospect, update next action, or deprioritize';
      else if (riskScore >= 51) recommendedAction = 'Schedule check-in call and define clear next steps within 48 hours';
      else if (riskScore >= 31) recommendedAction = 'Review progress and ensure next action is planned';

      return {
        pursuitId: p.id,
        opportunityId: p.opportunityId,
        opportunityTitle: p.opportunity?.opportunityTitle || 'Untitled',
        company: { id: p.companyId, name: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown' },
        currentStage: p.outcomeStage || 'discovery',
        daysInStage,
        daysSinceActivity,
        ownerAssigned: !!p.owner,
        hasNextAction: !!p.nextAction,
        nextActionOverdue: p.nextActionAt ? p.nextActionAt < new Date() : false,
        overallRiskScore: riskScore,
        riskFactors,
        riskCategory,
        recommendedAction,
      };
    });

    // Filter by minimum risk
    const filtered = assessments.filter(a => a.overallRiskScore >= minRisk);
    const sorted = filtered.sort((a, b) => b.overallRiskScore - a.overallRiskScore);

    // Persist critical risks as AI Insights
    const criticalRisks = sorted.filter(a => a.overallRiskScore >= 60).slice(0, 3);
    if (criticalRisks.length > 0) {
      try {
        await createInsights(
          criticalRisks.map(r => ({
            companyId: r.company.id,
            opportunityId: r.opportunityId,
            type: 'RISK' as const,
            title: `At-Risk Deal: ${r.opportunityTitle}`,
            description: `Deal risk score: ${r.overallRiskScore}/100. ${r.riskFactors.map(f => f.description).join('; ')}`,
            evidence: r.riskFactors.map(f => ({
              source: 'deal-risk-engine',
              snippet: f.description,
              reliability: 0.85,
            })),
            confidenceScore: 80,
            impactScore: r.overallRiskScore,
            urgencyScore: r.overallRiskScore >= 71 ? 90 : 60,
            reasoning: `Composite risk based on ${r.riskFactors.length} factors: staleness, ownership, next actions, confidence`,
            recommendedAction: r.recommendedAction,
            sourceType: 'pipeline_risk_engine',
            sourceRoute: '/api/ai/deal-risk',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }))
        );
      } catch (insightErr) {
        console.warn('[deal-risk] Failed to persist insights:', insightErr);
      }
    }

    return apiSuccess({
      total: sorted.length,
      critical: sorted.filter(a => a.riskCategory === 'critical').length,
      elevated: sorted.filter(a => a.riskCategory === 'elevated').length,
      normal: sorted.filter(a => a.riskCategory === 'normal').length,
      healthy: sorted.filter(a => a.riskCategory === 'healthy').length,
      deals: sorted,
    });
  } catch (error) {
    console.error('[ai/deal-risk] Error:', error);
    return apiError('Failed to analyze deal risk', 500);
  }
}
