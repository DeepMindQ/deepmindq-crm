/**
 * AI Evaluation Dashboard — WI-16E
 * ====================================
 *
 * API route for AI quality metrics visibility and dashboard data.
 * Provides the backend for the AI Quality Dashboard UI.
 *
 * Endpoints:
 *   GET  /api/ai/evaluation?view=stats       — Overall evaluation statistics
 *   GET  /api/ai/evaluation?view=quality&period=30 — Quality report
 *   GET  /api/ai/evaluation?view=trends&dimension=accuracy — Trends
 *   GET  /api/ai/evaluation?view=benchmarks  — Benchmark suite info
 *   GET  /api/ai/evaluation?view=alerts      — Active regression alerts
 *   POST /api/ai/evaluation  { action: "evaluate" }  — Run single evaluation
 *   POST /api/ai/evaluation  { action: "compare" }    — A/B comparison
 *
 * INTEGRATION POINTS:
 *   - Reads from: ai-evaluation-engine.ts (evaluation store)
 *   - Reads from: ai-evaluation-benchmarks.ts (benchmark metadata)
 *   - Feeds: AI Quality Dashboard UI (frontend component)
 *   - Hooks: CI pipeline (automated regression gates)
 *
 * NON-THROWING: All handlers return JSON responses, never throw.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runEvaluation,
  generateQualityReport,
  getQualityTrends,
  getEvaluationStats,
  compareVersions,
  type EvaluationInput,
  type EvaluationResult,
  type QualityReport,
  type QualityTrend,
  type EvaluatedEngine,
  type EvaluationDimension,
} from '@/lib/ai-evaluation-engine';
import {
  getBenchmarkSuites,
  getBenchmarkStats,
} from '@/lib/ai-evaluation-benchmarks';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalEvaluations: number;
  averageCompositeScore: number;
  enterpriseReadyRate: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  byEngine: Array<{ engine: string; count: number; avgScore: number }>;
  byCategory: Array<{ category: string; count: number; avgScore: number }>;
  recentCriticalFindings: number;
  storeUtilization: number;
  lastUpdated: string;
}

export interface TrendResponse {
  dimension: EvaluationDimension;
  engine?: EvaluatedEngine;
  period: number;
  trend: QualityTrend;
}

export interface BenchmarkInfo {
  totalSuites: number;
  totalCases: number;
  activeCases: number;
  suites: Array<{
    id: string;
    name: string;
    description: string;
    caseCount: number;
  }>;
}

export interface AlertResponse {
  regressions: Array<{
    dimension: string;
    engine: string;
    previousScore: number;
    currentScore: number;
    delta: number;
    severity: 'critical' | 'warning';
    detectedAt: string;
  }>;
  criticalFindings: number;
  hasAlerts: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

function err(message: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/ai/evaluation — Dashboard entry point
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'stats';

    switch (view) {
      case 'stats':
        return handleStats();
      case 'quality':
        return handleQualityReport(request);
      case 'trends':
        return handleTrends(request);
      case 'benchmarks':
        return handleBenchmarks();
      case 'alerts':
        return handleAlerts();
      default:
        return err(`Unknown view: "${view}". Use: stats, quality, trends, benchmarks, alerts.`);
    }
  } catch (error) {
    logger.error('AI Evaluation Dashboard GET error', { error: String(error) });
    return err('Internal server error processing evaluation dashboard request.', 500);
  }
}

// ── Stats Handler ───────────────────────────────────────────────────────────

async function handleStats(): Promise<NextResponse> {
  const stats = getEvaluationStats();

  const response: DashboardStats = {
    totalEvaluations: stats.totalEvaluations,
    averageCompositeScore: stats.averageCompositeScore,
    enterpriseReadyRate: stats.enterpriseReadyRate,
    overallGrade: scoreToGrade(stats.averageCompositeScore),
    byEngine: Object.entries(stats.byEngine).map(([engine, data]) => ({
      engine,
      count: data.count,
      avgScore: Math.round(data.avgScore),
    })),
    byCategory: Object.entries(stats.byCategory).map(([category, data]) => ({
      category,
      count: data.count,
      avgScore: Math.round(data.avgScore),
    })),
    recentCriticalFindings: stats.recentCriticalFindings.length,
    storeUtilization: Math.round(stats.storeUtilization * 100),
    lastUpdated: new Date().toISOString(),
  };

  return ok(response);
}

// ── Quality Report Handler ──────────────────────────────────────────────────

async function handleQualityReport(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get('period') || '30', 10);

  if (![7, 30, 90].includes(period)) {
    return err('Invalid period. Use 7, 30, or 90 days.');
  }

  const report: QualityReport = generateQualityReport(period);
  return ok(report);
}

// ── Trends Handler ──────────────────────────────────────────────────────────

async function handleTrends(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const dimension = (searchParams.get('dimension') || 'accuracy') as EvaluationDimension;
  const engine = searchParams.get('engine') as EvaluatedEngine | null;
  const period = parseInt(searchParams.get('period') || '30', 10);

  const validDimensions: EvaluationDimension[] = [
    'accuracy', 'hallucination_rate', 'citation_accuracy',
    'confidence_calibration', 'response_quality', 'business_usefulness',
  ];

  if (!validDimensions.includes(dimension)) {
    return err(`Invalid dimension: "${dimension}". Use: ${validDimensions.join(', ')}`);
  }

  const trend = getQualityTrends(dimension, engine || undefined, period);

  const response: TrendResponse = {
    dimension,
    engine: engine || undefined,
    period,
    trend,
  };

  return ok(response);
}

// ── Benchmarks Handler ───────────────────────────────────────────────────────

async function handleBenchmarks(): Promise<NextResponse> {
  const suites = getBenchmarkSuites();
  const stats = getBenchmarkStats();

  const response: BenchmarkInfo = {
    totalSuites: stats.totalSuites,
    totalCases: stats.totalCases,
    activeCases: stats.activeCases,
    suites: suites.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      caseCount: s.cases.length,
    })),
  };

  return ok(response);
}

// ── Alerts Handler ──────────────────────────────────────────────────────────

async function handleAlerts(): Promise<NextResponse> {
  const report = generateQualityReport(7);

  const response: AlertResponse = {
    regressions: report.regressions.map(r => ({
      dimension: r.dimension,
      engine: r.engine,
      previousScore: r.previousScore,
      currentScore: r.currentScore,
      delta: r.delta,
      severity: r.severity,
      detectedAt: r.detectedAt,
    })),
    criticalFindings: report.criticalFindings.length,
    hasAlerts: report.regressions.length > 0 || report.criticalFindings.length > 0,
  };

  return ok(response);
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/ai/evaluation — Run evaluation or comparison
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (!action) {
      return err('Missing "action" field. Use: "evaluate", "compare".');
    }

    switch (action) {
      case 'evaluate':
        return handleEvaluate(body);
      case 'compare':
        return handleCompare(body);
      default:
        return err(`Unknown action: "${action}". Use: "evaluate" or "compare".`);
    }
  } catch (error) {
    logger.error('AI Evaluation Dashboard POST error', { error: String(error) });
    return err('Internal server error processing evaluation request.', 500);
  }
}

// ── Evaluate Handler ─────────────────────────────────────────────────────────

async function handleEvaluate(body: Record<string, unknown>): Promise<NextResponse> {
  const input = body.input as EvaluationInput | undefined;

  if (!input) {
    return err('Missing "input" field. Provide an EvaluationInput object.');
  }

  if (!input.aiOutput) {
    return err('Missing "aiOutput" in input. Provide the AI output text to evaluate.');
  }

  if (!input.engine) {
    return err('Missing "engine" in input. Specify which engine produced the output.');
  }

  if (!input.category) {
    return err('Missing "category" in input. Specify the intelligence category.');
  }

  const result: EvaluationResult = runEvaluation(input);

  logger.info('Manual evaluation triggered via dashboard API', {
    evaluationId: result.evaluationId,
    engine: result.engine,
    score: result.compositeScore,
    grade: result.compositeGrade,
  });

  return ok(result);
}

// ── Compare Handler ──────────────────────────────────────────────────────────

async function handleCompare(body: Record<string, unknown>): Promise<NextResponse> {
  const { labelA, resultsA, labelB, resultsB, comparisonType } = body as {
    labelA: string;
    resultsA: EvaluationResult[];
    labelB: string;
    resultsB: EvaluationResult[];
    comparisonType?: 'prompt_version' | 'model' | 'engine_version' | 'configuration';
  };

  if (!labelA || !labelB) {
    return err('Missing "labelA" or "labelB". Provide labels for both sides of the comparison.');
  }

  if (!Array.isArray(resultsA) || !Array.isArray(resultsB)) {
    return err('Missing "resultsA" or "resultsB". Provide arrays of EvaluationResult objects.');
  }

  if (resultsA.length === 0 || resultsB.length === 0) {
    return err('Both result arrays must contain at least one evaluation.');
  }

  const result = compareVersions(
    labelA,
    resultsA,
    labelB,
    resultsB,
    comparisonType || 'prompt_version',
  );

  return ok(result);
}
