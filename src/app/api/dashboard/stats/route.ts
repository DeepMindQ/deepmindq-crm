import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/dashboard/stats
 *
 * Aggregated command-center stats — companies, contacts, signals,
 * insights, opportunities, risks, and recommended actions, plus
 * simple "today" deltas used by the metric cards on the AI Command
 * Center screen.
 */
export async function GET() {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      companies,
      contacts,
      signals,
      insights,
      opportunities,
      risks,
      recommendations,
      newSignalsToday,
      newOpportunitiesToday,
      newRisksToday,
      newRecommendationsToday,
      signalsByImpact,
      signalsByType,
      insightsByType,
    ] = await Promise.all([
      db.company.count({ where: { status: { not: 'archived' } } }),
      db.contact.count({ where: { status: { not: 'archived' } } }),
      db.companySignal.count({ where: { status: { notIn: ['archived', 'expired'] } } }),
      db.aIInsight.count({ where: { status: 'active' } }),
      db.opportunityRecommendation.count({ where: { status: { notIn: ['rejected'] } } }),
      db.companySignal.count({
        where: {
          severity: { in: ['high', 'critical'] },
          status: { notIn: ['archived', 'expired'] },
        },
      }),
      db.aIInsight.count({ where: { status: 'active', type: 'RECOMMENDATION' } }),
      db.companySignal.count({ where: { createdAt: { gte: startOfToday } } }),
      db.opportunityRecommendation.count({ where: { createdAt: { gte: startOfToday } } }),
      db.companySignal.count({
        where: {
          severity: { in: ['high', 'critical'] },
          createdAt: { gte: startOfToday },
        },
      }),
      db.aIInsight.count({
        where: { status: 'active', type: 'RECOMMENDATION', createdAt: { gte: startOfToday } },
      }),
      db.companySignal.groupBy({
        by: ['impact'],
        where: { status: { notIn: ['archived', 'expired'] } },
        _count: { impact: true },
      }),
      db.companySignal.groupBy({
        by: ['signalType'],
        where: { status: { notIn: ['archived', 'expired'] } },
        _count: { signalType: true },
      }),
      db.aIInsight.groupBy({
        by: ['type'],
        where: { status: 'active' },
        _count: { type: true },
      }),
    ]);

    const byImpact: Record<string, number> = {};
    for (const g of signalsByImpact) byImpact[g.impact as string] = g._count.impact;

    const bySignalType: Record<string, number> = {};
    for (const g of signalsByType) bySignalType[g.signalType as string] = g._count.signalType;

    const byInsightType: Record<string, number> = {};
    for (const g of insightsByType) byInsightType[g.type as string] = g._count.type;

    return NextResponse.json({
      companies,
      contacts,
      signals,
      insights,
      opportunities,
      risks,
      recommendations,
      today: {
        newSignals: newSignalsToday,
        newOpportunities: newOpportunitiesToday,
        newRisks: newRisksToday,
        newRecommendations: newRecommendationsToday,
      },
      breakdown: {
        signalsByImpact: byImpact,
        signalsByType: bySignalType,
        insightsByType: byInsightType,
      },
    });
  } catch (error) {
    console.error('[dashboard/stats] error:', error);
    return NextResponse.json(
      {
        companies: 0,
        contacts: 0,
        signals: 0,
        insights: 0,
        opportunities: 0,
        risks: 0,
        recommendations: 0,
        today: {
          newSignals: 0,
          newOpportunities: 0,
          newRisks: 0,
          newRecommendations: 0,
        },
        breakdown: {
          signalsByImpact: {},
          signalsByType: {},
          insightsByType: {},
        },
      },
      { status: 200 }
    );
  }
}
