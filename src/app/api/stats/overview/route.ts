import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';

async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [organizations, signals, people, insights, criticalSignals, recentActivity] =
    await Promise.all([
      db.organization.count({ where: { trackingStatus: 'active' } }),
      db.signal.count(),
      db.person.count(),
      db.insight.count(),
      db.signal.count({ where: { severity: 'critical' } }),
      db.signal.count({ where: { detectedAt: { gte: sevenDaysAgo } } }),
    ]);

  // Average intelligence score
  const avgResult = await db.organization.aggregate({
    _avg: { intelligenceScore: true },
  });
  const avgIntelligenceScore = avgResult._avg.intelligenceScore ?? 0;

  // ── NEW: Ingestion statistics (#12) ──
  const [ingestionTotal, ingestionCompleted, ingestionRows, ingestionEntities] = await Promise.all([
    db.dataIngestion.count(),
    db.dataIngestion.count({ where: { status: 'completed' } }),
    db.dataIngestion.aggregate({ _sum: { processedRows: true, totalRows: true } }),
    db.dataIngestion.aggregate({ _sum: { organizationsCreated: true, peopleCreated: true } }),
  ]);

  return apiSuccess({
    organizations,
    signals,
    people,
    insights,
    criticalSignals,
    avgIntelligenceScore: Math.round(avgIntelligenceScore * 10) / 10,
    recentActivity,
    // Ingestion stats
    ingestion: {
      total: ingestionTotal,
      completed: ingestionCompleted,
      totalRowsProcessed: ingestionRows._sum.processedRows ?? 0,
      totalRowsIngested: ingestionRows._sum.totalRows ?? 0,
      organizationsCreated: ingestionEntities._sum.organizationsCreated ?? 0,
      peopleCreated: ingestionEntities._sum.peopleCreated ?? 0,
    },
  });
}

export const GET = withErrorHandler(_getHandler);
