import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const [activeOrgs, allOrgs] = await Promise.all([
      db.organization.findMany({
        where: { trackingStatus: 'active' },
        include: { _count: { select: { signals: true } } },
        orderBy: { intelligenceScore: 'desc' },
        take: 20,
      }),
      db.organization.findMany({
        select: { industry: true, intelligenceScore: true },
      }),
    ]);

    // Compute industry breakdown
    const industryMap: Record<string, { totalScore: number; count: number }> = {};
    for (const org of allOrgs) {
      const industry = org.industry || 'Unknown';
      if (!industryMap[industry]) {
        industryMap[industry] = { totalScore: 0, count: 0 };
      }
      industryMap[industry].count++;
      if (org.intelligenceScore != null) {
        industryMap[industry].totalScore += org.intelligenceScore;
      }
    }

    const industryBreakdown = Object.entries(industryMap)
      .map(([industry, data]) => ({
        industry,
        count: data.count,
        avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Average intelligence score across all orgs
    const totalOrgs = allOrgs.length;
    const totalScore = allOrgs.reduce((sum, o) => sum + (o.intelligenceScore || 0), 0);
    const avgIntelligenceScore =
      totalOrgs > 0 ? Math.round((totalScore / totalOrgs) * 100) / 100 : 0;

    // Top opportunities: active orgs with high intelligence score
    const topOpportunities = activeOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      domain: org.domain,
      industry: org.industry,
      intelligenceScore: org.intelligenceScore,
      signalCount: org._count.signals,
    }));

    return NextResponse.json({
      data: {
        topOpportunities,
        industryBreakdown,
        totalOrganizations: totalOrgs,
        avgIntelligenceScore,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch revenue intelligence' }, { status: 500 });
  }
}
