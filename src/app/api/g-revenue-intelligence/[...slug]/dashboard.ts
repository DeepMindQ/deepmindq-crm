import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess } from '@/lib/apiHelpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '90d';
  const days = period === '30d' ? 30 : period === 'all' ? 3650 : 90;
  const periodDate = new Date(Date.now() - days * 86400000);

  const [totalAccounts, scoredAccounts, oppSignals, briefs, categoryDistribution, topScoredAccounts, signalTypeDistribution] = await Promise.all([
    db.company.count(),
    db.accountScore.groupBy({ by: ['companyId'] }),
    db.opportunitySignal.findMany({
      where: { createdAt: { gte: periodDate } },
      select: { id: true, signalType: true, score: true, companyId: true, status: true },
    }),
    db.accountBrief.findMany({
      select: { id: true, companyId: true, confidence: true, generatedAt: true },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    }),
    db.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT DISTINCT ON ("companyId") "category", "companyId"
      FROM "AccountScore"
      ORDER BY "companyId", "calculatedAt" DESC
    `.then(rows => {
      const dist: Record<string, number> = { HOT_ACCOUNT: 0, WARM_ACCOUNT: 0, NURTURE: 0, AT_RISK: 0 };
      for (const r of rows) { if (r.category in dist) dist[r.category]++; }
      return dist;
    }),
    db.accountScore.findMany({
      orderBy: { score: 'desc' },
      take: 10,
      include: { company: { select: { id: true, rawName: true, industry: true } } },
    }),
    db.opportunitySignal.groupBy({
      by: ['signalType'],
      _count: { id: true },
      where: { createdAt: { gte: periodDate } },
    }),
  ]);

  const accountsWithScores = scoredAccounts.length;
  const avgScore = await getAverageScore();
  const signalTypeDist = Object.fromEntries(signalTypeDistribution.map(d => [d.signalType, d._count.id]));

  return apiSuccess({
    summary: {
      totalAccounts,
      accountsWithScores,
      accountsWithoutScores: totalAccounts - accountsWithScores,
      averageScore: avgScore,
      totalOpportunitySignals: oppSignals.length,
      signalsNew: oppSignals.filter(s => s.status === 'new').length,
      signalsValidated: oppSignals.filter(s => s.status === 'validated').length,
      briefsGenerated: briefs.length,
      averageBriefConfidence: briefs.length > 0 ? parseFloat((briefs.reduce((sum, b) => sum + b.confidence, 0) / briefs.length).toFixed(2)) : 0,
    },
    categoryDistribution,
    topScoredAccounts: topScoredAccounts.map(s => ({
      accountId: s.companyId,
      accountName: s.company.rawName,
      industry: s.company.industry,
      score: s.score,
      category: s.category,
      calculatedAt: s.calculatedAt,
    })),
    signalTypeDistribution: signalTypeDist,
  });
}

async function getAverageScore(): Promise<number> {
  try {
    const result = await db.accountScore.aggregate({ _avg: { score: true } });
    return result._avg.score ? Math.round(result._avg.score * 10) / 10 : 0;
  } catch { return 0; }
}
