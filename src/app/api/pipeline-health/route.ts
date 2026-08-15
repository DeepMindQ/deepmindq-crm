import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const [statusBreakdown, severityBreakdown, recentSignals, avgConfidence] = await Promise.all([
      db.signal.groupBy({
        by: ['status'],
        _count: true,
      }),
      db.signal.groupBy({
        by: ['severity'],
        _count: true,
      }),
      db.signal.findMany({
        orderBy: { detectedAt: 'desc' },
        take: 5,
        include: {
          organization: { select: { name: true } },
        },
      }),
      db.signal.aggregate({
        _avg: { confidenceScore: true },
      }),
    ]);

    const totalSignals = statusBreakdown.reduce((sum, s) => sum + s._count, 0);

    return NextResponse.json({
      data: {
        statusBreakdown: statusBreakdown.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        severityBreakdown: severityBreakdown.map((s) => ({
          severity: s.severity,
          count: s._count,
        })),
        recentSignals: recentSignals.map((s) => ({
          id: s.id,
          title: s.title,
          signalType: s.signalType,
          severity: s.severity,
          status: s.status,
          organizationName: s.organization?.name || 'Unknown',
          detectedAt: s.detectedAt,
        })),
        avgConfidence:
          avgConfidence._avg.confidenceScore != null
            ? Math.round(avgConfidence._avg.confidenceScore * 100) / 100
            : 0,
        totalSignals,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch pipeline health' }, { status: 500 });
  }
}
