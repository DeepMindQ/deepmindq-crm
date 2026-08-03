/**
 * WI-18.4 Phase 4 Hardening — System Performance & Health API
 *
 * Provides comprehensive performance metrics for enterprise monitoring:
 *   - Database performance (p50/p95/p99)
 *   - API latency metrics
 *   - Memory and resource health
 *   - AI cache statistics
 *   - Rate limiter health
 */

import { NextResponse } from 'next/server';
import { getDbPerformanceStats, validateLatencyTargets } from '@/lib/database-performance-monitor';
import { PrismaDiagnostics } from '@/lib/db';
import { getApiMetrics } from '@/lib/api-observability';
import { getMemoryHealth } from '@/lib/memory-resource-monitor';
import { AICacheLayer } from '@/lib/ai-cache-layer';
import { getRateLimitHealth } from '@/lib/distributed-rate-limit';

export async function GET() {
  try {
    const dbStats = getDbPerformanceStats();
    const apiMetrics = getApiMetrics();
    const memoryHealth = getMemoryHealth();
    const latencyWarnings = validateLatencyTargets();

    let aiCacheStats = { totalEntries: 0, totalHits: 0, totalCostSaved: 0, avgTtlDays: 7 };
    try {
      aiCacheStats = await AICacheLayer.getStats();
    } catch {
      // Cache stats unavailable
    }

    const rateLimitHealth = getRateLimitHealth();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        ...dbStats,
        prismaDiagnostics: PrismaDiagnostics.snapshot(),
        latencyWarnings,
        targets: {
          p95TargetMs: 200,
          p99TargetMs: 500,
        },
      },
      api: apiMetrics,
      memory: memoryHealth,
      ai: {
        cache: aiCacheStats,
      },
      rateLimiting: rateLimitHealth,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
