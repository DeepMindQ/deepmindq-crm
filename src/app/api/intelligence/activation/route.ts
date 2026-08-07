/**
 * WI-17A — Intelligence Activation API
 *
 * POST /api/intelligence/activation   — Trigger activation for a company
 * POST /api/intelligence/activation/batch — Trigger batch activation
 * GET  /api/intelligence/activation/health — Health check all WI-16 dependencies
 * GET  /api/intelligence/activation/stats  — Activation statistics
 */

import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import {
  activateIntelligence,
  activateIntelligenceBatch,
  getActivationStats,
  checkIntelligenceHealth,
  type ActivationTrigger,
} from '@/lib/intelligence-activation';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════
// POST — Activate intelligence for a single company
// ═══════════════════════════════════════════════════
export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { companyId, trigger = 'manual_trigger', contactIds, skipExpensiveSteps, priority } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const result = await activateIntelligence({
      companyId,
      trigger: trigger as ActivationTrigger,
      contactIds,
      skipExpensiveSteps,
      priority,
    });

    return NextResponse.json({
      success: result.success,
      companyId: result.companyId,
      steps: result.steps.map(s => ({
        step: s.step,
        status: s.status,
        durationMs: s.durationMs,
        detail: s.detail,
        error: s.error,
      })),
      totalDurationMs: result.totalDurationMs,
      error: result.error,
    });
  } catch (error) {
    logger.error('[Activation API] POST failed:', { error });
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════
// GET — Activation stats and health
// ═══════════════════════════════════════════════════
export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'stats';

  if (view === 'health') {
    const health = await checkIntelligenceHealth();
    return NextResponse.json(health);
  }

  const stats = getActivationStats();
  return NextResponse.json(stats);
}
