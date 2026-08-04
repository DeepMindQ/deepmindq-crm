/**
 * WI-18.5 Phase 5 — Enterprise Health & Readiness Endpoints
 *
 * Comprehensive health monitoring infrastructure:
 *   - /health          → Liveness (unauthenticated)
 *   - /health/db       → Database health
 *   - /health/ai       → AI provider status
 *   - /health/cache    → Cache layer health
 *   - /health/deps     → Dependency health
 *   - /health/ready    → Readiness (all systems go)
 *
 * Each endpoint returns structured JSON with:
 *   - status: healthy | degraded | unhealthy
 *   - responseTime: ms for this specific check
 *   - details: component-specific data
 *   - warnings: list of issues found
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getDatabaseHealthSummary } from '@/lib/database-enterprise-monitor';
import { AICacheLayer } from '@/lib/ai-cache-layer';
import { getAIProviderStatus } from '@/lib/validate-env';
import { getDbPerformanceStats } from '@/lib/database-performance-monitor';

// ── Types ──────────────────────────────────────────────────────

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTimeMs: number;
  components: ComponentHealth[];
  warnings: string[];
  version: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTimeMs?: number;
  details?: Record<string, unknown>;
}

// ── Health Check Functions ──────────────────────────────────────

/**
 * Full health check — all components.
 */
export async function getFullHealthCheck(): Promise<HealthCheckResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const components: ComponentHealth[] = [];

  // 1. Database
  const dbHealth = await checkDatabaseHealth();
  components.push(dbHealth);
  if (dbHealth.status !== 'healthy') {
    warnings.push(`Database: ${dbHealth.status}`);
  }

  // 2. AI Providers
  const aiHealth = checkAIProviderHealth();
  components.push(aiHealth);
  if (aiHealth.status === 'degraded') {
    warnings.push('AI providers: no providers configured');
  }

  // 3. Cache Layer
  const cacheHealth = await checkCacheHealth();
  components.push(cacheHealth);

  // 4. Environment
  const envHealth = checkEnvironmentHealth();
  components.push(envHealth);
  warnings.push(...(envHealth.details?.warnings as string[] || []));

  // Overall status
  const hasUnhealthy = components.some(c => c.status === 'unhealthy');
  const hasDegraded = components.some(c => c.status === 'degraded');
  const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTimeMs: Date.now() - start,
    components,
    warnings,
    version: process.env.npm_package_version || 'unknown',
  };
}

/**
 * Check database health.
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await Promise.race([
      db.$queryRaw<Array<{ _1: number }>>`SELECT 1 as _1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5_000)
      ),
    ]);

    const perf = getDbPerformanceStats();
    return {
      name: 'database',
      status: perf.p95LatencyMs > 500 ? 'degraded' : 'healthy',
      responseTimeMs: Date.now() - start,
      details: {
        queriesPerSecond: perf.queriesPerSecond,
        avgLatencyMs: perf.avgLatencyMs,
        p95LatencyMs: perf.p95LatencyMs,
        p99LatencyMs: perf.p99LatencyMs,
        slowQueryCount: perf.slowQueryCount,
      },
    };
  } catch {
    return { name: 'database', status: 'unhealthy', responseTimeMs: Date.now() - start };
  }
}

/**
 * Check AI provider configuration.
 */
function checkAIProviderHealth(): ComponentHealth {
  const ai = getAIProviderStatus();
  return {
    name: 'ai-providers',
    status: ai.count === 0 ? 'degraded' : 'healthy',
    details: {
      configuredProviders: ai.providers,
      count: ai.count,
    },
  };
}

/**
 * Check cache layer health.
 */
async function checkCacheHealth(): Promise<ComponentHealth> {
  try {
    const stats = await AICacheLayer.getStats();
    return {
      name: 'ai-cache',
      status: 'healthy',
      details: {
        totalEntries: stats.totalEntries,
        totalHits: stats.totalHits,
        totalCostSaved: stats.totalCostSaved,
      },
    };
  } catch {
    return { name: 'ai-cache', status: 'degraded', details: { error: 'Cache stats unavailable' } };
  }
}

/**
 * Check environment configuration health.
 */
function checkEnvironmentHealth(): ComponentHealth {
  const warnings: string[] = [];
  const env = process.env;

  const hasDb = !!env.DATABASE_URL;
  const hasSecret = !!env.NEXTAUTH_SECRET;
  const hasAuthorizedEmail = !!env.AUTHORIZED_EMAIL;
  const hasTrackingSecret = !!env.TRACKING_SECRET;

  if (!hasDb) warnings.push('DATABASE_URL not set');
  if (!hasSecret) warnings.push('NEXTAUTH_SECRET not set');
  if (!hasAuthorizedEmail) warnings.push('AUTHORIZED_EMAIL not set');
  if (!hasTrackingSecret) warnings.push('TRACKING_SECRET not set');

  const ai = getAIProviderStatus();
  if (ai.count === 0) warnings.push('No AI providers configured');

  let status: ComponentHealth['status'] = 'healthy';
  if (!hasDb || !hasSecret) status = 'unhealthy';
  else if (warnings.length > 0) status = 'degraded';

  return {
    name: 'environment',
    status,
    details: {
      database: hasDb,
      auth: { secret: hasSecret, authorizedEmail: hasAuthorizedEmail },
      aiProviders: ai.count,
      tracking: hasTrackingSecret,
      nodeEnv: env.NODE_ENV || 'development',
      warnings,
    },
  };
}

/**
 * Readiness check — all critical systems must be healthy.
 * Used by Kubernetes / container orchestrators before routing traffic.
 */
export async function getReadinessCheck(): Promise<{
  ready: boolean;
  checks: Array<{ name: string; ready: boolean }>;
  timestamp: string;
}> {
  const checks: Array<{ name: string; ready: boolean }> = [];

  // Database must be reachable
  try {
    await Promise.race([
      db.$queryRaw<Array<{ _1: number }>>`SELECT 1 as _1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3_000)
      ),
    ]);
    checks.push({ name: 'database', ready: true });
  } catch {
    checks.push({ name: 'database', ready: false });
  }

  // Environment must be valid
  const hasDb = !!process.env.DATABASE_URL;
  const hasSecret = !!process.env.NEXTAUTH_SECRET;
  checks.push({ name: 'environment', ready: hasDb && hasSecret });

  const allReady = checks.every(c => c.ready);

  return {
    ready: allReady,
    checks,
    timestamp: new Date().toISOString(),
  };
}
