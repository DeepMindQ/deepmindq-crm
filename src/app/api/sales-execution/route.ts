import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Get people with org info
    const people = await db.person.findMany({
      include: {
        organization: { select: { name: true, industry: true } },
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    // Group by department
    const deptMap = new Map<string, number>();
    for (const p of people) {
      const dept = p.department || 'Unknown';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    }
    const departmentBreakdown = Array.from(deptMap.entries()).map(([dept, count]) => ({
      dept,
      count,
    }));

    // Get acted-upon signals count and total insights count in parallel
    const [actedSignalsCount, totalInsights] = await Promise.all([
      db.signal.count({ where: { status: 'acted_upon' } }),
      db.insight.count(),
    ]);

    // Compute outreach rate: acted signals / total signals
    const totalSignals = await db.signal.count();
    const outreachRate =
      totalSignals > 0 ? `${Math.round((actedSignalsCount / totalSignals) * 100)}%` : '0%';

    return NextResponse.json({
      teamMembers: people.slice(0, 20),
      departmentBreakdown,
      totalInsights,
      actedSignalsCount,
      outreachRate,
    });
  } catch (error) {
    console.error('[sales-execution] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
