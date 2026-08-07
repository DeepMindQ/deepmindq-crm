/**
 * Source Reliability Scoring API (Session 8 — Component 4.3)
 *
 * Routes:
 *   GET  /api/scoring/reliability/sources     — List all source types with scores and tiers
 *   GET  /api/scoring/reliability/domain/:domain — Get composite reliability for a specific domain
 *   GET  /api/scoring/reliability/validation   — Run cross-validation of static vs feedback scores
 *   POST /api/scoring/reliability/evaluate     — Evaluate a specific source/domain combination
 */

import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import {
  SourceReliabilityEngine,
} from '@/lib/scoring/source-reliability-engine';

// ═══════════════════════════════════════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════

const EvaluateBodySchema = z.object({
  sourceType: z.string().min(1, 'sourceType is required'),
  domain: z.string().optional(),
  staticScore: z.number().min(0).max(100).optional(),
  domainReliability: z.number().min(0).max(1).optional(),
  domainFeedbackCount: z.number().int().min(0).optional(),
});

const TrustScoreBodySchema = z.object({
  source: z.string().min(1, 'source is required'),
  confidence: z.number().min(0).max(100, 'confidence must be 0-100'),
  freshnessAge: z.number().min(0).optional(),
  evidenceCount: z.number().int().min(0).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// Route Handlers
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route: /api/scoring/reliability/sources
    if (pathname.endsWith('/sources')) {
      return handleListSources();
    }

    // Route: /api/scoring/reliability/domain/:domain
    if (pathname.includes('/domain/')) {
      const domain = pathname.split('/domain/')[1];
      if (!domain) {
        return apiError('Domain parameter is required', 400);
      }
      return handleDomainReliability(domain, url);
    }

    // Route: /api/scoring/reliability/validation
    if (pathname.endsWith('/validation')) {
      return handleValidation(url);
    }

    return apiError(
      'Unknown action. Use /sources, /domain/:domain, or /validation.',
      404,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('Source reliability GET error', { error: message });
    return apiError(message, 500);
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route: /api/scoring/reliability/evaluate
    if (pathname.endsWith('/evaluate')) {
      return handleEvaluate(request);
    }

    // Route: /api/scoring/reliability/trust-score
    if (pathname.endsWith('/trust-score')) {
      return handleTrustScore(request);
    }

    return apiError(
      'Unknown action. Use /evaluate or /trust-score.',
      404,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('Source reliability POST error', { error: message });
    return apiError(message, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Action Handlers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/scoring/reliability/sources
 *
 * Returns all known source types with their static TRUST scores,
 * descriptions, and quality tiers.
 */
async function handleListSources() {
  const sources = SourceReliabilityEngine.getAllSourceTypes();

  const enriched = sources.map((s) => ({
    ...s,
    tier: SourceReliabilityEngine.getSourceQualityTier(s.staticScore),
  }));

  logger.info('Listed source types', { count: enriched.length });

  return apiSuccess({
    sources: enriched,
    total: enriched.length,
  });
}

/**
 * GET /api/scoring/reliability/domain/:domain?sourceType=web_intelligence
 *
 * Returns the composite reliability score for a specific domain,
 * cross-validating the static TRUST score for the source type against
 * the domain's Bayesian feedback reliability.
 *
 * Query params:
 *   sourceType — Source type to use for the static score (default: 'web_intelligence')
 */
async function handleDomainReliability(domain: string, url: URL) {
  const sourceType = url.searchParams.get('sourceType') || 'web_intelligence';

  const result = await SourceReliabilityEngine.getCompositeReliability({
    sourceType,
    domain,
  });

  logger.info('Fetched domain reliability', {
    domain,
    sourceType,
    compositeScore: result.compositeScore,
    tier: result.tier,
  });

  return apiSuccess({
    domain,
    sourceType,
    ...result,
  });
}

/**
 * GET /api/scoring/reliability/validation?minFeedbackSamples=5
 *
 * Runs a cross-validation pass comparing static TRUST scores against
 * observed Bayesian feedback for all domains with sufficient samples.
 *
 * Query params:
 *   minFeedbackSamples — Minimum samples to include (default: 5)
 */
async function handleValidation(url: URL) {
  const rawMin = url.searchParams.get('minFeedbackSamples');
  const minFeedbackSamples = rawMin
    ? Math.max(1, parseInt(rawMin, 10) || 5)
    : 5;

  const result = await SourceReliabilityEngine.validateSourceScores({
    minFeedbackSamples,
  });

  logger.info('Ran source score validation', {
    evaluated: result.evaluated,
    aligned: result.aligned,
    drift: result.drift,
    mismatch: result.mismatch,
    critical: result.critical,
  });

  return apiSuccess(result);
}

/**
 * POST /api/scoring/reliability/evaluate
 *
 * Evaluate a specific source/domain combination with explicit parameters.
 *
 * Body:
 *   sourceType           — Required. Source type key.
 *   domain               — Optional. Domain for Bayesian lookup.
 *   staticScore          — Optional 0-100. Override for static TRUST score.
 *   domainReliability    — Optional 0-1. Override for Bayesian reliability.
 *   domainFeedbackCount  — Optional. Override for feedback sample count.
 */
async function handleEvaluate(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateBody(EvaluateBodySchema, body);
  if (parsed instanceof Response) return parsed;

  const result = await SourceReliabilityEngine.getCompositeReliability({
    sourceType: parsed.sourceType,
    domain: parsed.domain,
    staticScore: parsed.staticScore,
    domainReliability: parsed.domainReliability,
    domainFeedbackCount: parsed.domainFeedbackCount,
  });

  logger.info('Evaluated source reliability', {
    sourceType: parsed.sourceType,
    domain: parsed.domain ?? 'none',
    compositeScore: result.compositeScore,
    tier: result.tier,
  });

  return apiSuccess({
    params: {
      sourceType: parsed.sourceType,
      domain: parsed.domain ?? null,
    },
    ...result,
  });
}

/**
 * POST /api/scoring/reliability/trust-score
 *
 * Compute a full TRUST composite score with dimensional breakdown.
 *
 * Body:
 *   source        — Required. Source type key.
 *   confidence    — Required 0-100. Confidence level.
 *   freshnessAge  — Optional. Days since capture (default: 0).
 *   evidenceCount — Optional. Number of evidence sources (default: 1).
 */
async function handleTrustScore(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateBody(TrustScoreBodySchema, body);
  if (parsed instanceof Response) return parsed;

  const result = SourceReliabilityEngine.computeTrustScore({
    source: parsed.source,
    confidence: parsed.confidence,
    freshnessAge: parsed.freshnessAge,
    evidenceCount: parsed.evidenceCount,
  });

  logger.info('Computed TRUST score', {
    source: parsed.source,
    compositeScore: result.compositeScore,
    grade: result.grade,
  });

  return apiSuccess(result);
}
