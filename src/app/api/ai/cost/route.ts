/**
 * S5-3.6 — Unified AI Cost Tracking API
 *
 * GET    /api/ai/cost               — Get unified cost report (by route, model, provider)
 * GET    /api/ai/cost?hours=24      — Customize time window
 * GET    /api/ai/cost?daily=true    — Get today's in-memory daily summary
 * GET    /api/ai/cost?models=true   — Get model cost registry
 * POST   /api/ai/cost               — Configure budget limits
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import {
  getUnifiedCostReport,
  getDailyCostSummary,
  getModelCosts,
  setBudgetConfig,
} from '@/lib/unified-ai-cost-tracking';

export async function GET(req: NextRequest) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const daily = searchParams.get('daily') === 'true';
    const models = searchParams.get('models') === 'true';

    if (daily) {
      return apiSuccess(getDailyCostSummary());
    }

    if (models) {
      return apiSuccess({ models: getModelCosts() });
    }

    const report = await getUnifiedCostReport(
      Math.max(1, Math.min(720, hours)) // Clamp: 1h - 30 days
    );

    return apiSuccess(report);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await checkApiAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { dailyLimit, routeLimits, alertThresholdPercent } = body;

    setBudgetConfig({
      dailyLimit: typeof dailyLimit === 'number' ? dailyLimit : undefined,
      routeLimits,
      alertThresholdPercent,
    });

    return apiSuccess({
      message: 'Budget configuration updated',
      dailyLimit,
      routeLimits: routeLimits || {},
      alertThresholdPercent: alertThresholdPercent || 80,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return apiError('Unauthorized', 401);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(msg, 500);
  }
}
