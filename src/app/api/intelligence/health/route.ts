/**
 * GET /api/intelligence/health
 *
 * M5 Phase 6 — Intelligence Layer Health Check
 *
 * Comprehensive health check for the M5 intelligence subsystem:
 *   - Database connectivity (actual lightweight query)
 *   - Trust framework status
 *   - External connectors (Clearbit, Apollo)
 *   - Agent orchestration
 *   - Learning/feedback loop
 *
 * Non-throwing: standardized error responses.
 */

import { NextRequest } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { utilityGuard, RateLimitedError, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Component health checkers ────────────────────────────────────────────

/** Database connectivity — run actual lightweight query */
async function checkDatabase(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    // Lightweight: count companies (uses index, fast)
    await db.company.count({ take: 1 });
    const latencyMs = Date.now() - start;
    return {
      status: latencyMs < 500 ? 'healthy' : latencyMs < 2000 ? 'degraded' : 'unhealthy',
      latencyMs,
    };
  } catch {
    return { status: 'unhealthy', latencyMs: Date.now() - start };
  }
}

/** Trust framework — check evidence coverage */
async function checkTrustFramework(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
}> {
  try {
    const totalEvidence = await db.evidence.count();
    const activeEvidence = await db.evidence.count({
      where: { status: 'active' },
    });

    // Trust score: ratio of active evidence to total (evidence freshness)
    const score = totalEvidence > 0
      ? Math.round((activeEvidence / totalEvidence) * 100)
      : 0;

    // If no evidence at all, trust framework is operational but empty
    if (totalEvidence === 0) {
      return { status: 'degraded', score: 0 };
    }

    return {
      status: score >= 50 ? 'healthy' : score >= 25 ? 'degraded' : 'unhealthy',
      score,
    };
  } catch {
    return { status: 'unhealthy', score: 0 };
  }
}

/** Clearbit connector check */
function checkClearbit(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  rateLimitRemaining: number | null;
} {
  const hasKey = !!process.env.CLEARBIT_API_KEY;
  if (!hasKey) {
    return { status: 'unhealthy', rateLimitRemaining: null };
  }
  // Clearbit free tier: 50/month — we don't track usage in-app,
  // so report as healthy with null remaining (unknown)
  return { status: 'healthy', rateLimitRemaining: null };
}

/** Apollo connector check */
function checkApollo(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
} {
  const hasKey = !!process.env.APOLLO_API_KEY;
  return { status: hasKey ? 'healthy' : 'unhealthy' };
}

/** G4 FIX: SEC EDGAR connector check */
function checkSecEdgar(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  enabled: boolean;
  lastError: string | null;
} {
  const enabled = process.env.ENABLE_SEC_EDGAR_CONNECTOR === 'true';
  if (!enabled) return { status: 'degraded', enabled: false, lastError: null };
  // SEC is free, no API key needed — check if recently errored
  return { status: 'healthy', enabled: true, lastError: null };
}

/** G4 FIX: Crunchbase connector check */
function checkCrunchbase(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  enabled: boolean;
} {
  const enabled = process.env.ENABLE_CRUNCHBASE_CONNECTOR === 'true';
  const hasKey = !!process.env.CRUNCHBASE_API_KEY;
  if (!enabled) return { status: 'degraded', enabled: false };
  return { status: hasKey ? 'healthy' : 'degraded', enabled: true };
}

/** G4 FIX: Website connector check */
function checkWebsiteConnector(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
} {
  // Website connector has no external API key dependency
  return { status: 'healthy' };
}

/** G4 FIX: RSS connector check */
function checkRssConnector(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
} {
  return { status: 'healthy' };
}

/** Agent orchestration check */
async function checkAgents(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  count: number;
}> {
  try {
    const count = await db.agentRun.count({ take: 5000 });
    return { status: 'healthy', count };
  } catch {
    return { status: 'degraded', count: 0 };
  }
}

/** Learning/feedback loop check */
async function checkLearning(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  feedbackCount: number;
}> {
  try {
    const feedbackCount = await db.recommendationFeedback.count({ take: 10000 });
    return { status: 'healthy', feedbackCount };
  } catch {
    return { status: 'degraded', feedbackCount: 0 };
  }
}

// ── Route Handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  let ctx: { correlationId: string; responseHeaders: Record<string, string> };
  try {
    ctx = utilityGuard(request, 'health');
  } catch (rlErr) {
    if (rlErr instanceof RateLimitedError) {
      return new Response(JSON.stringify(rlErr.errorBody), { status: 429, headers: rlErr.headers });
    }
    throw rlErr;
  }
  const startedAt = Date.now();

  try {
    // Run all checks in parallel for speed
    const [database, trustFramework, agents, learning] = await Promise.all([
      checkDatabase(),
      checkTrustFramework(),
      checkAgents(),
      checkLearning(),
    ]);

    const clearbit = checkClearbit();
    const apollo = checkApollo();
    // G4 FIX: Phase 2 connector health checks
    const secEdgar = checkSecEdgar();
    const crunchbase = checkCrunchbase();
    const website = checkWebsiteConnector();
    const rss = checkRssConnector();

    // Phase 2.6 — Source diversity score
    let diversityScore: number | null = null;
    try {
      const { SourceReliabilityEngine } = await import('@/lib/scoring/source-reliability-engine');
      const evidenceSources = await db.evidence.findMany({
        select: { sourceName: true },
        where: { status: 'active' },
        take: 500,
      });
      const sourceNames = evidenceSources
        .map(e => e.sourceName)
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
      if (sourceNames.length > 0) {
        const diversity = SourceReliabilityEngine.computeSourceDiversity(sourceNames);
        diversityScore = Math.round(diversity.diversityScore * 100);
      }
    } catch {
      // Not available
    }

    // Determine overall status
    const allComponents = [database, trustFramework, clearbit, apollo, secEdgar, crunchbase, website, rss, agents, learning];
    const hasUnhealthy = allComponents.some(c => c.status === 'unhealthy');
    const hasDegraded = allComponents.some(c => c.status === 'degraded');
    const overallStatus = hasUnhealthy
      ? 'unhealthy' as const
      : hasDegraded
        ? 'degraded' as const
        : 'healthy' as const;

    const result = {
      status: overallStatus,
      components: {
        database,
        trustFramework,
        connectors: {
          clearbit,
          apollo,
          // G4 FIX: Phase 2 connectors
          secEdgar,
          crunchbase,
          websiteConnector: website,
          rssConnector: rss,
        },
        agents,
        learning,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Phase 2.6 — Source diversity score (0-100)
      diversityScore,
    };

    logger.info('[intelligence/health] Health check complete', {
      status: overallStatus,
      dbLatencyMs: database.latencyMs,
      trustScore: trustFramework.score,
    });

    return utilitySuccess(ctx, result, 'health', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Health check failed', Date.now() - startedAt);
  }
}
