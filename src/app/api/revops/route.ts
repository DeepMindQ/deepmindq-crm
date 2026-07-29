import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';

/**
 * Wave 7 — RevOps Dashboard API
 * 
 * GET /api/revops — revenue operations overview
 */

export async function GET() {
  try {
    const now = Date.now();
    const day = 86400000;

    // ── Revenue Metrics ──
    const pursuits = await db.pursuit.findMany({
      include: { opportunity: true },
    });

    const closedWon = pursuits.filter(p => p.outcomeStage === 'closed_won');
    const closedLost = pursuits.filter(p => p.outcomeStage === 'closed_lost');
    const active = pursuits.filter(p => p.status === 'active');

    // Pipeline value (using opportunity scores as proxy)
    const totalPipelineValue = active.reduce((s, p) => s + (p.opportunity?.opportunityScore || 0), 0);

    // Win rate by time periods
    const wonThisMonth = closedWon.filter(p => p.updatedAt && (now - p.updatedAt.getTime()) < 30 * day).length;
    const wonLastMonth = closedWon.filter(p => p.updatedAt && (now - p.updatedAt.getTime()) >= 30 * day && (now - p.updatedAt.getTime()) < 60 * day).length;
    const lostThisMonth = closedLost.filter(p => p.updatedAt && (now - p.updatedAt.getTime()) < 30 * day).length;

    // ── Activity Metrics ──
    const contacts = await db.contact.findMany();
    const totalContacts = contacts.length;

    const sentContacts = contacts.filter(c => c.status === 'sent').length;
    const repliedContacts = contacts.filter(c => c.status === 'replied').length;
    const bouncedContacts = contacts.filter(c => c.status === 'bounced').length;

    const replyRate = sentContacts > 0 ? Math.round((repliedContacts / sentContacts) * 100) : 0;
    const bounceRate = sentContacts > 0 ? Math.round((bouncedContacts / sentContacts) * 100) : 0;

    // ── Data Quality ──
    const enrichedContacts = contacts.filter(c => !!c.enrichmentData).length;
    const enrichmentRate = totalContacts > 0 ? Math.round((enrichedContacts / totalContacts) * 100) : 0;

    const validEmails = contacts.filter(c => c.emailHealth === 'valid').length;
    const emailQualityRate = totalContacts > 0 ? Math.round((validEmails / totalContacts) * 100) : 0;

    // ── Company coverage ──
    const companies = await db.company.count();
    const companiesWithSignals = await db.companySignal.groupBy({
      by: ['companyId'],
    });

    const companiesWithPursuits = await db.pursuit.groupBy({
      by: ['companyId'],
    });

    const companiesWithOpportunities = await db.opportunityRecommendation.groupBy({
      by: ['companyId'],
    });

    // ── Sequence performance ──
    const sequences = await db.emailSequence.findMany({
      include: {
        _count: { select: { steps: true } },
      },
    });

    // ── Draft pipeline ──
    const drafts = await db.draft.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const draftStats: Record<string, number> = {};
    for (const d of drafts) draftStats[d.status] = d._count.status;

    // ── AI Intelligence metrics ──
    const aiInsights = await db.aIInsight.count();
    const recentInsights = await db.aIInsight.count({
      where: { createdAt: { gte: new Date(now - 7 * day) } },
    });

    // ── Health score composite ──
    const coverageHealth = Math.min(100, Math.round((companiesWithSignals.length / Math.max(companies, 1)) * 100));
    const dataHealth = Math.round((enrichmentRate + emailQualityRate) / 2);
    const executionHealth = Math.min(100, Math.round(replyRate * 3));
    const pipelineHealth = active.length > 0 ? Math.min(100, Math.round(totalPipelineValue / Math.max(active.length, 1) / 10)) : 0;

    const revopsHealthScore = Math.round((coverageHealth + dataHealth + executionHealth + pipelineHealth) / 4);

    // Persist revops insight
    try {
      await createInsights([{
        type: 'FORECAST' as const,
        title: `RevOps Health: ${revopsHealthScore}/100 — ${active.length} active pursuits, ${replyRate}% reply rate`,
        description: `Pipeline value: ${totalPipelineValue}. Companies: ${companies}. AI insights: ${recentInsights} this week.`,
        evidence: [
          { source: 'revops-engine', snippet: `Coverage: ${coverageHealth}/100, Data: ${dataHealth}/100, Execution: ${executionHealth}/100, Pipeline: ${pipelineHealth}/100`, reliability: 0.9 },
        ],
        confidenceScore: 80,
        impactScore: revopsHealthScore,
        urgencyScore: revopsHealthScore < 40 ? 70 : 30,
        reasoning: 'Composite RevOps health from coverage, data quality, execution, and pipeline metrics',
        recommendedAction: dataHealth < 50 ? 'Focus on data enrichment and email verification' : executionHealth < 50 ? 'Improve outreach sequences and reply rates' : 'RevOps operations healthy',
        sourceType: 'revops_dashboard',
        sourceRoute: '/api/revops',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }]);
    } catch (e) {
      logger.warn('[revops] Failed to persist insight:', { error: e });
    }

    return apiSuccess({
      // Revenue
      totalPipelineValue,
      activeDeals: active.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      winRate: (closedWon.length + closedLost.length) > 0 ? Math.round((closedWon.length / (closedWon.length + closedLost.length)) * 100) : 0,
      wonThisMonth,
      wonLastMonth,
      lostThisMonth,
      monthOverMonthGrowth: wonLastMonth > 0 ? Math.round(((wonThisMonth - wonLastMonth) / wonLastMonth) * 100) : wonThisMonth > 0 ? 100 : 0,

      // Activity
      totalContacts,
      sentContacts,
      replyRate,
      bounceRate,
      sequencesCount: sequences.length,

      // Data Quality
      enrichmentRate,
      emailQualityRate,
      companies,
      companiesWithSignals: companiesWithSignals.length,
      companiesWithPursuits: companiesWithPursuits.length,
      companiesWithOpportunities: companiesWithOpportunities.length,

      // AI
      totalAIInsights: aiInsights,
      recentAIInsights: recentInsights,

      // Drafts
      draftPipeline: draftStats,

      // Health
      revopsHealthScore,
      healthBreakdown: {
        coverage: coverageHealth,
        data: dataHealth,
        execution: executionHealth,
        pipeline: pipelineHealth,
      },
    });
  } catch (error) {
    logger.error('[revops] Error:', { error: error });
    return apiError('Failed to load RevOps data', 500);
  }
}
