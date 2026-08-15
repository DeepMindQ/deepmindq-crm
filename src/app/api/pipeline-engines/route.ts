import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess } from '@/lib/apiHelpers';

const FEATURE_NAMES: Record<string, string> = {
  reasoning: 'AI Reasoning',
  briefing: 'Briefing Engine',
  signal_analysis: 'Signal Analysis',
  entity_resolution: 'Entity Resolution',
  relationship_discovery: 'Relationship Discovery',
  data_ingestion: 'Data Ingestion Pipeline',
};

function computeStatus(successRate: number): 'active' | 'degraded' | 'down' {
  if (successRate >= 0.9) return 'active';
  if (successRate >= 0.5) return 'degraded';
  return 'down';
}

async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const usageLogs = await db.aIUsageLog.findMany({
    select: {
      feature: true,
      latencyMs: true,
      qualityScore: true,
      error: true,
      createdAt: true,
    },
  });

  // Group by feature
  const groups: Record<
    string,
    {
      totalCalls: number;
      totalLatency: number;
      qualitySum: number;
      qualityCount: number;
      errorCount: number;
    }
  > = {};

  for (const log of usageLogs) {
    const feature = log.feature || 'unknown';
    if (!groups[feature]) {
      groups[feature] = {
        totalCalls: 0,
        totalLatency: 0,
        qualitySum: 0,
        qualityCount: 0,
        errorCount: 0,
      };
    }
    const g = groups[feature];
    g.totalCalls++;
    g.totalLatency += log.latencyMs;
    if (log.qualityScore != null) {
      g.qualitySum += log.qualityScore;
      g.qualityCount++;
    }
    if (log.error) {
      g.errorCount++;
    }
  }

  // Compute days span for throughput
  const timestamps = usageLogs.map((l) => l.createdAt.getTime());
  const minTs = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const maxTs = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const daysSpan = Math.max((maxTs - minTs) / (1000 * 60 * 60 * 24), 1);

  const engines = Object.entries(groups).map(([feature, stats]) => {
    const avgLatency = stats.totalCalls > 0 ? Math.round(stats.totalLatency / stats.totalCalls) : 0;
    const avgQuality =
      stats.qualityCount > 0 ? Math.round((stats.qualitySum / stats.qualityCount) * 100) / 100 : 0;
    const successRate =
      stats.totalCalls > 0 ? (stats.totalCalls - stats.errorCount) / stats.totalCalls : 1;
    const throughput = Math.round(stats.totalCalls / daysSpan);

    return {
      id: feature,
      name: FEATURE_NAMES[feature] || feature,
      feature,
      status: computeStatus(successRate),
      latency: avgLatency,
      throughput,
      accuracy: avgQuality,
      uptime: Math.round(successRate * 100) / 100,
    };
  });

  // ── NEW: Real data ingestion metrics from DB (#11) ──
  // Compute ingestion pipeline health from actual DataIngestion records
  const [ingestionTotal, ingestionCompleted, _ingestionFailed] = await Promise.all([
    db.dataIngestion.count(),
    db.dataIngestion.count({ where: { status: 'completed' } }),
    db.dataIngestion.count({ where: { status: 'failed' } }),
  ]);

  const _ingestionRowsProcessed = await db.dataIngestion.aggregate({
    _sum: {
      processedRows: true,
      totalRows: true,
      organizationsCreated: true,
      peopleCreated: true,
    },
  });

  // Compute average processing time from completed ingestions
  const completedIngestions = await db.dataIngestion.findMany({
    where: { status: 'completed' },
    select: { uploadedAt: true, completedAt: true },
    take: 50,
  });

  let avgProcessingMs = 0;
  if (completedIngestions.length > 0) {
    const totalMs = completedIngestions.reduce((sum, i) => {
      return sum + ((i.completedAt?.getTime() ?? 0) - (i.uploadedAt?.getTime() ?? 0));
    }, 0);
    avgProcessingMs = Math.round(totalMs / completedIngestions.length);
  }

  const ingestionSuccessRate = ingestionTotal > 0 ? ingestionCompleted / ingestionTotal : 1;

  // Only add ingestion engine if it's not already in the usage logs
  if (!groups['data_ingestion']) {
    engines.push({
      id: 'data_ingestion',
      name: 'Data Ingestion Pipeline',
      feature: 'data_ingestion',
      status: computeStatus(ingestionSuccessRate),
      latency: avgProcessingMs,
      throughput: ingestionTotal,
      accuracy: Math.round(ingestionSuccessRate * 10000) / 100,
      uptime: Math.round(ingestionSuccessRate * 100) / 100,
    });
  }

  // Knowledge Graph Sync — compute from relationship count
  const relationshipCount = await db.relationship.count();
  engines.push({
    id: 'knowledge_graph_sync',
    name: 'Knowledge Graph Sync',
    feature: 'knowledge_graph_sync',
    status: 'active',
    latency: 0,
    throughput: relationshipCount,
    accuracy: 0,
    uptime: 1,
  });

  return apiSuccess(engines);
}

export const GET = withErrorHandler(_getHandler);
