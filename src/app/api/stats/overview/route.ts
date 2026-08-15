import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

/**
 * GET /api/stats/overview — Aggregate counts for Intelligence Hub stats cards.
 */
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const [organizationCount, signalCount, briefingCount, ingestionCount, personCount] =
      await Promise.all([
        db.organization.count(),
        db.signal.count(),
        db.briefing.count(),
        db.dataIngestion.count({ where: { status: 'completed' } }),
        db.person.count(),
      ]);

    const completedIngestions = await db.dataIngestion.findMany({
      where: { status: 'completed' },
      select: { processedRows: true },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    const totalRowsProcessed = completedIngestions.reduce(
      (sum, i) => sum + (i.processedRows ?? 0),
      0,
    );

    return NextResponse.json({
      data: {
        organizations: organizationCount,
        signals: signalCount,
        briefings: briefingCount,
        imports: ingestionCount,
        people: personCount,
        totalRowsProcessed,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch overview stats' }, { status: 500 });
  }
}
