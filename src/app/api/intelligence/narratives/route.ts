/**
 * GET /api/intelligence/narratives?limit=10&companyId=&minConfidence=0&minSeverity=high
 *
 * Intelligence Narratives API — The Real Intelligence Interface
 *
 * Returns intelligence narratives built from the full engine pipeline:
 *   Signal Detection → GroundingEngine → Confidence Computation →
 *   Evidence Chain → Action Recommendation → Narrative Construction
 *
 * Every narrative carries:
 *   - Multi-factor confidence (NOT a hardcoded value)
 *   - Traceable evidence chain (NOT template text)
 *   - AI reasoning from real signal analysis
 *   - Actionable recommendations from opportunity engine
 *   - Full explainability: "Why did AI tell me this?"
 *
 * Non-throwing: always returns JSON envelope.
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import {
  generateCommandCenterNarratives,
  generateSignalNarrative,
  getSignalConfidenceDetail,
} from '@/lib/intelligence-narrative-service';
import { checkApiAuth } from '@/lib/api-auth';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/intelligence/narratives — Command Center Narratives
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // ── Auth guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = request.nextUrl;
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const companyId = url.searchParams.get('companyId') || undefined;
    const minConfidence = parseInt(url.searchParams.get('minConfidence') || '0', 10);
    const minSeverity = url.searchParams.get('minSeverity') || undefined;
    const signalId = url.searchParams.get('signalId') || undefined;

    // Single signal narrative mode
    if (signalId) {
      const result = await generateSignalNarrative(signalId);
      if (!result.success) {
        return Response.json({
          success: false,
          error: result.error,
          data: null,
          meta: { endpoint: 'intelligence/narratives', timingMs: Date.now() - startedAt },
        }, { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return Response.json({
        success: true,
        data: result.narrative,
        error: null,
        meta: {
          endpoint: 'intelligence/narratives',
          timingMs: Date.now() - startedAt,
          computationMs: result.narrative?.computationTimeMs,
        },
      }, { headers: { 'Content-Type': 'application/json' } });
    }

    // Confidence detail mode
    if (url.searchParams.has('confidenceDetail')) {
      const detailSignalId = url.searchParams.get('confidenceDetail') || '';
      if (!detailSignalId) {
        return Response.json({
          success: false,
          error: 'confidenceDetail parameter requires a signal ID',
          data: null,
        }, { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const detail = await getSignalConfidenceDetail(detailSignalId);
      return Response.json({
        success: detail.success,
        data: detail.success ? detail : null,
        error: detail.error || null,
        meta: { endpoint: 'intelligence/narratives', timingMs: Date.now() - startedAt },
      }, { headers: { 'Content-Type': 'application/json' } });
    }

    // Default: command center narratives
    const result = await generateCommandCenterNarratives({
      limit: Math.min(Math.max(limit, 1), 50),
      companyId,
      minConfidence,
      minSeverity,
    });

    logger.info('[intelligence/narratives] Generated', {
      narrativeCount: result.narratives.length,
      errors: result.errors.length,
      meta: result.meta,
    });

    return Response.json({
      success: result.success,
      data: result.narratives,
      error: result.errors.length > 0 ? result.errors : null,
      meta: {
        endpoint: 'intelligence/narratives',
        timingMs: Date.now() - startedAt,
        ...result.meta,
      },
    }, { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    logger.error('[intelligence/narratives] Unhandled error', { error: err });
    return Response.json({
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Internal server error',
      meta: { endpoint: 'intelligence/narratives', timingMs: Date.now() - startedAt },
    }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
