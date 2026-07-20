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
   thresholds, signal recency window, sub-dimension weights).

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
     e.g. { "subDimensionWeights": { "dynamicIntelligence": { "intelligenceScore": 0.35 } } }

   Validates:
     - Dimension weights sum to 1.0 (±0.01 tolerance)
     - Sub-dimension weights sum to 1.0 (±0.01 tolerance)
     - All weights are non-negative
     - Tier thresholds are 0–100 with hot > active > nurture
     - Signal recency days is 1–365
   ═══════════════════════════════════════════════════════════════ */

const subWeightSchema = z.object({
  intelligenceScore: z.number().min(0).max(1).optional(),
  researchDepth: z.number().min(0).max(1).optional(),
  signalQuality: z.number().min(0).max(1).optional(),
  contactCoverage: z.number().min(0).max(1).optional(),
});

const timingSubWeightSchema = z.object({
  signalRecency: z.number().min(0).max(1).optional(),
  engagementRecency: z.number().min(0).max(1).optional(),
  growthIndicator: z.number().min(0).max(1).optional(),
});

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
  subDimensionWeights: z
    .object({
      dynamicIntelligence: subWeightSchema.optional(),
      timingUrgency: timingSubWeightSchema.optional(),
    })
    .optional(),
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
    // Cast: Zod schema produces deeply-optional fields, but updateScoringConfig
    // deep-merges with defaults so missing nested fields are safe.
    const config = await updateScoringConfig(parsed as unknown as Partial<import('@/lib/scoring-config').ScoringConfig>);

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