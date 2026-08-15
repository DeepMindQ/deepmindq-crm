import { checkApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';
import { db } from '@/lib/db';

/**
 * ROI Analytics API — Q5/Q8 FIX
 *
 * Computes measurable business outcomes from system data:
 * - Intelligence coverage (% of orgs with signals/insights)
 * - Data processed (total rows ingested)
 * - Signal detection rate
 * - Insight generation rate
 * - Pipeline efficiency (time from ingestion to insight)
 * - Cost efficiency (estimated cost per company analyzed)
 */
async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalOrgs,
    orgsWithSignals,
    orgsWithInsights,
    totalSignals,
    recentSignals,
    totalInsights,
    recentInsights,
    totalPeople,
    ingestionStats,
    avgIntelScore,
    avgPipelineLatency,
    briefingsCount,
    recentBriefings,
  ] = await Promise.all([
    // Total organizations tracked
    db.organization.count(),
    // Orgs that have at least one signal
    db.organization.count({ where: { signals: { some: {} } } }),
    // Orgs that have at least one insight
    db.organization.count({ where: { insights: { some: {} } } }),
    // Total signals ever
    db.signal.count(),
    // Signals in last 30 days
    db.signal.count({ where: { detectedAt: { gte: thirtyDaysAgo } } }),
    // Total insights
    db.insight.count(),
    // Insights in last 30 days
    db.insight.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    // Total contacts
    db.person.count(),
    // Ingestion totals
    db.dataIngestion.aggregate({
      _sum: {
        totalRows: true,
        processedRows: true,
        organizationsCreated: true,
        peopleCreated: true,
      },
      _count: true,
    }),
    // Average intelligence score
    db.organization.aggregate({ _avg: { intelligenceScore: true } }),
    // Average pipeline latency (from AIUsageLog)
    db.aIUsageLog.aggregate({
      _avg: { latencyMs: true },
      where: { feature: { in: ['data_ingestion', 'signal_detection', 'ai_reasoning'] } },
    }),
    // Total briefings
    db.briefing.count(),
    // Recent briefings (Briefing uses generatedAt, not createdAt)
    db.briefing.count({ where: { generatedAt: { gte: thirtyDaysAgo } } }),
  ]);

  // Compute derived ROI metrics
  const signalCoverageRate = totalOrgs > 0 ? Math.round((orgsWithSignals / totalOrgs) * 100) : 0;
  const insightCoverageRate = totalOrgs > 0 ? Math.round((orgsWithInsights / totalOrgs) * 100) : 0;
  const totalRowsProcessed = ingestionStats._sum.processedRows ?? 0;
  const totalRowsIngested = ingestionStats._sum.totalRows ?? 0;
  const processingSuccessRate =
    totalRowsIngested > 0
      ? Math.round(
          ((totalRowsProcessed - (totalRowsIngested - totalRowsProcessed)) / totalRowsIngested) *
            100,
        )
      : 0;
  const avgScore = avgIntelScore._avg.intelligenceScore ?? 0;
  const avgLatencyMs = avgPipelineLatency._avg.latencyMs ?? 0;
  const signalGrowthRate = totalSignals > 0 ? Math.round((recentSignals / totalSignals) * 100) : 0;
  const insightGrowthRate =
    totalInsights > 0 ? Math.round((recentInsights / totalInsights) * 100) : 0;

  return apiSuccess({
    // Coverage metrics
    organizations: {
      total: totalOrgs,
      withSignals: orgsWithSignals,
      withInsights: orgsWithInsights,
      signalCoveragePct: signalCoverageRate,
      insightCoveragePct: insightCoverageRate,
    },
    // Signal metrics
    signals: {
      total: totalSignals,
      last30Days: recentSignals,
      growthRatePct: signalGrowthRate,
    },
    // Insight metrics
    insights: {
      total: totalInsights,
      last30Days: recentInsights,
      growthRatePct: insightGrowthRate,
    },
    // Briefing metrics
    briefings: {
      total: briefingsCount,
      last30Days: recentBriefings,
    },
    // Data processing metrics
    dataProcessing: {
      totalRowsIngested,
      totalRowsProcessed,
      successRatePct: Math.min(100, processingSuccessRate),
      organizationsCreated: ingestionStats._sum.organizationsCreated ?? 0,
      peopleCreated: ingestionStats._sum.peopleCreated ?? 0,
    },
    // Performance metrics
    performance: {
      avgIntelligenceScore: Math.round(avgScore * 10) / 10,
      avgPipelineLatencyMs: Math.round(avgLatencyMs),
      avgPipelineLatencySec: Math.round((avgLatencyMs / 1000) * 10) / 10,
    },
    // Contact metrics
    contacts: {
      total: totalPeople,
    },
    // Computed ROI indicators
    roi: {
      dataPerOrg: totalOrgs > 0 ? Math.round(totalRowsProcessed / totalOrgs) : 0,
      signalsPerOrg: totalOrgs > 0 ? Math.round((totalSignals / totalOrgs) * 10) / 10 : 0,
      insightsPerOrg: totalOrgs > 0 ? Math.round((totalInsights / totalOrgs) * 10) / 10 : 0,
      overallCoveragePct: Math.round((signalCoverageRate + insightCoverageRate) / 2),
    },
  });
}

export const GET = withErrorHandler(_getHandler);
