import { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import {
  getScoringConfig,
  updateScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from '@/lib/scoring-config';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-strategy/scoring-config
   Returns the current scoring configuration (weights, tier
   thresholds, signal recency window).

   Query params:
     - reset=true → return defaults without loading from DB
   ═══════════════════════════════════════════════════════════════ */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resetParam = searchParams.get('reset');

    if (resetParam === 'true') {
      return apiSuccess({
        config: DEFAULT_SCORING_CONFIG,
        isDefault: true,
      });
    }

    const config = await getScoringConfig();
    const isDefault =
      JSON.stringify(config) === JSON.stringify(DEFAULT_SCORING_CONFIG);

    return apiSuccess({
      config,
      isDefault,
    });
  } catch (error) {
    console.error('[scoring-config] GET error:', error);
    return apiError('Failed to fetch scoring configuration');
  }
}

/* ═══════════════════════════════════════════════════════════════
   PUT /api/g-strategy/scoring-config
   Update scoring configuration (partial updates deep-merged).

   Body: Partial<ScoringConfig>
     e.g. { "weights": { "staticFit": 0.50 } }
     e.g. { "tierThresholds": { "hot": 85 } }
     e.g. { "signalRecencyDays": 60 }

   Validates:
     - Weights sum to 1.0 (±0.01 tolerance)
     - Weights are non-negative
     - Tier thresholds are 0–100 with hot > active > nurture
     - Signal recency days is 1–365
   ═══════════════════════════════════════════════════════════════ */

const updateScoringConfigSchema = z.object({
  weights: z
    .object({
      staticFit: z.number().min(0).max(1).optional(),
      dynamicIntelligence: z.number().min(0).max(1).optional(),
      timingUrgency: z.number().min(0).max(1).optional(),
    })
    .optional(),
  tierThresholds: z
    .object({
      hot: z.number().min(0).max(100).int().optional(),
      active: z.number().min(0).max(100).int().optional(),
      nurture: z.number().min(0).max(100).int().optional(),
    })
    .optional(),
  signalRecencyDays: z.number().int().min(1).max(365).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Check for reset request
    if (body?.reset === true) {
      const config = await updateScoringConfig(DEFAULT_SCORING_CONFIG);
      return apiSuccess({
        message: 'Scoring config reset to defaults',
        config,
        isDefault: true,
      });
    }

    const parsed = validateBody(updateScoringConfigSchema, body);
    if (parsed instanceof Response) return parsed;

    if (!parsed) {
      return apiError('Request body must be a valid object', 400);
    }

    // updateScoringConfig handles all validation (weight sum, threshold ordering, etc.)
    const config = await updateScoringConfig(parsed);

    return apiSuccess({
      message: 'Scoring config updated and persisted',
      config,
      isDefault: false,
    });
  } catch (error: any) {
    console.error('[scoring-config] PUT error:', error);
    // Return validation errors with 400 status
    if (error?.message?.includes('must sum') || error?.message?.includes('must be') || error?.message?.includes('must be between')) {
      return apiError(error.message, 400);
    }
    return apiError('Failed to update scoring configuration');
  }
}