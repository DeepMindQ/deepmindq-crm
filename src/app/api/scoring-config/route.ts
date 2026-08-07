import { NextRequest, NextResponse } from 'next/server';
import { getScoringConfig, updateScoringConfig, getCachedScoringConfig } from '@/lib/scoring-config';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * GET /api/scoring-config
 * Returns the current scoring configuration.
 * Reads from DB (async) to get the latest persisted config.
 */
export async function GET() {
  try {
    await checkApiAuth();
    const config = await getScoringConfig();
    return NextResponse.json({
      success: true,
      data: config,
      source: 'db', // Always reads from DB for admin accuracy
    });
  } catch (err: any) {
    if (err?.message?.includes('Unauthorized') || err?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Fallback: return cached config (safe for monitoring)
    const cached = getCachedScoringConfig();
    return NextResponse.json({
      success: true,
      data: cached,
      source: 'cache_fallback',
    });
  }
}

/**
 * PUT /api/scoring-config
 * Updates the scoring configuration.
 * Validates all weight sums and threshold constraints.
 * Persists to SystemSetting table and updates in-process cache.
 */
export async function PUT(request: NextRequest) {
  try {
    await checkApiAuth();

    const body = await request.json();

    // Validate that body is a partial scoring config
    const allowedKeys = ['weights', 'tierThresholds', 'signalRecencyDays', 'subDimensionWeights'];
    const hasValidKey = Object.keys(body).some(key => allowedKeys.includes(key));
    if (!hasValidKey) {
      return NextResponse.json(
        { error: 'No valid scoring config fields provided. Allowed: weights, tierThresholds, signalRecencyDays, subDimensionWeights' },
        { status: 400 }
      );
    }

    const updated = await updateScoringConfig(body);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Scoring configuration updated and persisted',
    });
  } catch (err: any) {
    if (err?.message?.includes('Unauthorized') || err?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validation errors from updateScoringConfig
    if (err?.message?.includes('must sum to') || err?.message?.includes('must be') || err?.message?.includes('must be greater than')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    console.error('[scoring-config] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update scoring config' }, { status: 500 });
  }
}
