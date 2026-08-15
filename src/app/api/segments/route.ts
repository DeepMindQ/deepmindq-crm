import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Group organizations by industry to create segments
    const orgs = await db.organization.findMany({
      select: { industry: true, id: true, intelligenceScore: true },
      where: { trackingStatus: 'active' },
    });

    const industryMap = new Map<string, { count: number; totalScore: number; orgIds: string[] }>();
    for (const org of orgs) {
      const industry = org.industry ?? 'Other';
      const existing = industryMap.get(industry) ?? { count: 0, totalScore: 0, orgIds: [] };
      existing.count++;
      existing.totalScore += org.intelligenceScore ?? 50;
      existing.orgIds.push(org.id);
      industryMap.set(industry, existing);
    }

    const data = Array.from(industryMap.entries()).map(([industry, info]) => ({
      id: `seg-${industry.toLowerCase().replace(/\s+/g, '-')}`,
      name: `${industry} Companies`,
      description: `Organizations in the ${industry} sector.`,
      companyCount: info.count,
      avgIntelScore: Math.round(info.totalScore / info.count),
      criteria: [{ field: 'industry', operator: 'equals', value: industry }],
      lastUpdated: new Date().toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list segments', details: message },
      { status: 500 },
    );
  }
}
