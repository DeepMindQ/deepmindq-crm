import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getScoringConfig, updateScoringConfig, getCachedScoringConfig } from '@/lib/scoring-config';
import { checkApiAuth } from '@/lib/api-auth';
import { swrGet, swrInvalidate } from '@/lib/swr-cache';
import { withApiLogging } from '@/lib/api-logging-middleware';

/**
 * GET /api/scoring-config
 * Returns the current scoring configuration.
 * Uses SWR cache for fast reads; falls back to DB on cache miss.
 * Cache is warmed at startup via instrumentation.ts.
 */
async function scoringConfigGetHandler() {
  try {
    await checkApiAuth();

    // Use SWR cache: serve from cache (even if slightly stale), revalidate in background
    const result = await swrGet({
      key: 'ref:scoring-config',
      fetcher: async () => getScoringConfig(),
      staleTtlMs: 5 * 60 * 1000,   // 5 minutes: serve fresh without revalidation
      maxTtlMs: 15 * 60 * 1000,    // 15 minutes: force revalidation after this
      redisTtlMs: 15 * 60 * 1000,   // Redis backing: 15 minutes
    });

    if (result.data) {
      return NextResponse.json({
        success: true,
        data: result.data,
        source: result.stale ? 'swr_cache' : 'fresh',
        cacheAge: result.age,
      });
    }

    // SWR failed — fall back to in-memory cache
    const cached = getCachedScoringConfig();
    return NextResponse.json({
      success: true,
      data: cached,
      source: 'memory_fallback',
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
 * Persists to SystemSetting table and invalidates SWR cache.
 */
async function scoringConfigPutHandler(request: NextRequest) {
  try {
    await checkApiAuth(request);

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

    // Invalidate SWR cache so next GET fetches fresh data
    swrInvalidate('ref:scoring-config');

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Scoring configuration updated, persisted, and cache invalidated',
    });
  } catch (err: any) {
    if (err?.message?.includes('Unauthorized') || err?.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validation errors from updateScoringConfig
    if (err?.message?.includes('must sum to') || err?.message?.includes('must be') || err?.message?.includes('must be greater than')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    logger.error('[scoring-config] PUT error', { error: err });
    return NextResponse.json({ error: 'Failed to update scoring config' }, { status: 500 });
  }
}

export const GET = withApiLogging(scoringConfigGetHandler, '/api/scoring-config');
export const PUT = withApiLogging(scoringConfigPutHandler, '/api/scoring-config');
