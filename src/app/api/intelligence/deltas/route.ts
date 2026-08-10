/**
 * GET /api/intelligence/deltas?limit=20&companyId=&minMagnitude=3
 * POST /api/intelligence/deltas — Capture a snapshot for delta tracking
 *
 * Intelligence Deltas API — "What changed since I last looked?"
 *
 * GET: Returns computed deltas by comparing consecutive IntelligenceSnapshots.
 *   - score_change: Intelligence score shifted by >=5 points
 *   - new_signal: New signals detected (>=2 new active signals)
 *   - evidence_update: New evidence added (>=3 new records)
 *   - priority_shift: Priority tier changed (HOT -> ACTIVE, etc.)
 *   - confidence_change: High-severity signal count changed
 *
 * POST: Captures a point-in-time intelligence snapshot for a company.
 *   Body: { companyId: string, reason?: 'enrichment' | 'score_refresh' | 'signal_detected' | 'scheduled' }
 *
 * Non-throwing: always returns JSON envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { computeIntelligenceDeltas, captureIntelligenceSnapshot } from '@/lib/intelligence-delta-service';
import { checkApiAuth } from '@/lib/api-auth';
import { utilityGuard, RateLimitedError } from '@/lib/intelligence-api/guard';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/deltas — Compute Intelligence Deltas
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // ── Correlation-id + rate limiting guard ──
  let ctx;
  try {
    ctx = utilityGuard(request, 'deltas');
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return NextResponse.json({ error: 'Rate limited', code: 'RATE_LIMITED' }, { status: 429, headers: e.headers });
    }
    throw e;
  }

  const headers = { 'Content-Type': 'application/json', ...ctx.responseHeaders };

  try {
    const url = request.nextUrl;
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const companyId = url.searchParams.get('companyId') || undefined;
    const minMagnitude = parseInt(url.searchParams.get('minMagnitude') || '3', 10);

    const result = await computeIntelligenceDeltas({
      limit: Math.min(Math.max(limit, 1), 50),
      companyId,
      minMagnitude,
    });

    logger.info('[intelligence/deltas] Computed', {
      deltaCount: result.deltas.length,
      meta: result.meta,
    });

    return NextResponse.json(
      {
        success: result.success,
        data: result.deltas,
        error: result.error,
        meta: {
          endpoint: 'intelligence/deltas',
          timingMs: Date.now() - startedAt,
          ...result.meta,
        },
      },
      { headers },
    );
  } catch (err) {
    logger.error('[intelligence/deltas] Unhandled error', { error: err });
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: err instanceof Error ? err.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        meta: { endpoint: 'intelligence/deltas', timingMs: Date.now() - startedAt },
      },
      { status: 500, headers },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/intelligence/deltas — Capture Intelligence Snapshot
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  // ── Correlation-id + rate limiting guard ──
  let ctx;
  try {
    ctx = utilityGuard(request, 'deltas');
  } catch (e) {
    if (e instanceof RateLimitedError) {
      return NextResponse.json({ error: 'Rate limited', code: 'RATE_LIMITED' }, { status: 429, headers: e.headers });
    }
    throw e;
  }

  const headers = { 'Content-Type': 'application/json', ...ctx.responseHeaders };

  try {
    const body = await request.json().catch(() => ({}));
    const { companyId, reason } = body as {
      companyId?: string;
      reason?: 'enrichment' | 'score_refresh' | 'signal_detected' | 'scheduled';
    };

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'companyId is required',
          code: 'VALIDATION_FAILED',
          data: null,
          meta: { endpoint: 'intelligence/deltas', timingMs: Date.now() - startedAt },
        },
        { status: 400, headers },
      );
    }

    const captured = await captureIntelligenceSnapshot(companyId, reason);

    return NextResponse.json(
      {
        success: true,
        data: { captured, companyId, reason },
        error: null,
        meta: { endpoint: 'intelligence/deltas', timingMs: Date.now() - startedAt },
      },
      { headers },
    );
  } catch (err) {
    logger.error('[intelligence/deltas] Snapshot capture failed', { error: err });
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: err instanceof Error ? err.message : 'Snapshot capture failed',
        code: 'INTERNAL_ERROR',
        meta: { endpoint: 'intelligence/deltas', timingMs: Date.now() - startedAt },
      },
      { status: 500, headers },
    );
  }
}
