/**
 * GET /api/ai/retrieval-metrics
 *
 * WI-16F.1 — Retrieval Intelligence Metrics Dashboard
 *
 * Provides enterprise-grade monitoring of retrieval quality:
 *   - Quality metrics (precision, recall, MRR, NDCG, evidence quality)
 *   - Latency metrics (avg, P50, P95, P99)
 *   - Signal usage rates and health
 *   - Degradation status and fallback tracking
 *   - Cost impact analysis
 *   - Enterprise threshold assessment
 *
 * Query params:
 *   ?period=7|30|90 — analysis period in days (default 7)
 *   ?view=dashboard|benchmark|latency|cost|degradation|assessment|stats — specific view
 *
 * POST actions:
 *   ?action=benchmark — run full retrieval benchmark suite
 *   ?action=before-after — run before/after comparison
 *   ?action=latency-test — run latency benchmark (10 iterations)
 */
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import {
  generateRetrievalQualityDashboard,
  runRetrievalBenchmarkSuite,
  runBeforeAfterComparison,
  runLatencyBenchmark,
  getEnterpriseQualityAssessment,
  getRetrievalValidationStats,
  getDegradationStatus,
  compareRetrievalCosts,
  getHybridStats,
  clearRetrievalValidationStore,
} from '@/lib/ai-retrieval-validation';

const VALID_VIEWS = new Set(['dashboard', 'benchmark', 'latency', 'cost', 'degradation', 'assessment', 'stats']);
const VALID_ACTIONS = new Set(['benchmark', 'before-after', 'latency-test', 'cost-compare', 'clear']);

export async function GET(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const view = request.nextUrl.searchParams.get('view') || 'dashboard';
    const periodRaw = request.nextUrl.searchParams.get('period') || '7';
    const period = Math.min(Math.max(parseInt(periodRaw, 10) || 7, 1), 90);

    if (!VALID_VIEWS.has(view)) {
      return Response.json({ error: `Invalid view: ${view}. Valid: ${Array.from(VALID_VIEWS).join(', ')}` }, { status: 400 });
    }

    const startedAt = Date.now();

    switch (view) {
      case 'dashboard': {
        const dashboard = generateRetrievalQualityDashboard(period);
        const hybridStats = getHybridStats();
        return Response.json({
          success: true,
          view: 'dashboard',
          period: `${period}d`,
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: dashboard,
          index: hybridStats,
        });
      }

      case 'stats': {
        const stats = getRetrievalValidationStats();
        const hybridStats = getHybridStats();
        return Response.json({
          success: true,
          view: 'stats',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: stats,
          index: hybridStats,
        });
      }

      case 'degradation': {
        const degradation = getDegradationStatus();
        return Response.json({
          success: true,
          view: 'degradation',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: degradation,
        });
      }

      case 'assessment': {
        const assessment = getEnterpriseQualityAssessment();
        return Response.json({
          success: true,
          view: 'assessment',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: assessment,
        });
      }

      case 'cost': {
        const hybridStats = getHybridStats();
        const costCompare = compareRetrievalCosts(hybridStats.totalEntries);
        return Response.json({
          success: true,
          view: 'cost',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: costCompare,
          indexSize: hybridStats.totalEntries,
        });
      }

      default:
        return Response.json({ error: `View '${view}' not implemented for GET` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ai/retrieval-metrics] GET failed: ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action || request.nextUrl.searchParams.get('action') || 'benchmark') as string;

    if (!VALID_ACTIONS.has(action)) {
      return Response.json({ error: `Invalid action: ${action}. Valid: ${Array.from(VALID_ACTIONS).join(', ')}` }, { status: 400 });
    }

    const startedAt = Date.now();

    switch (action) {
      case 'benchmark': {
        const result = runRetrievalBenchmarkSuite();
        return Response.json({
          success: true,
          action: 'benchmark',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: result,
        });
      }

      case 'before-after': {
        const comparison = runBeforeAfterComparison();
        return Response.json({
          success: true,
          action: 'before-after',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: comparison,
        });
      }

      case 'latency-test': {
        const iterations = Math.min(Math.max(body.iterations || 10, 5), 50);
        const query = body.query || 'cloud migration enterprise AI adoption';
        const result = runLatencyBenchmark(query, 5, iterations);
        return Response.json({
          success: true,
          action: 'latency-test',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: result,
        });
      }

      case 'cost-compare': {
        const indexSize = body.indexSize || 1000;
        const topK = body.topK || 5;
        const result = compareRetrievalCosts(indexSize, topK);
        return Response.json({
          success: true,
          action: 'cost-compare',
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          data: result,
        });
      }

      case 'clear': {
        clearRetrievalValidationStore();
        return Response.json({
          success: true,
          action: 'clear',
          message: 'Retrieval validation store cleared.',
        });
      }

      default:
        return Response.json({ error: `Action '${action}' not implemented` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[ai/retrieval-metrics] POST failed: ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
}
