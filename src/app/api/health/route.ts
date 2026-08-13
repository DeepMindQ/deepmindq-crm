import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withApiLogging } from '@/lib/api-logging-middleware';
import { getDeploymentConfig } from '@/lib/deployment';

/**
 * GET /api/health — Comprehensive health probe (NO auth).
 *
 * Used by orchestrators (Kubernetes, Vercel, Render) for health checking.
 * Probes database connectivity, Redis connectivity, and returns
 * deployment/machine metrics. Returns degraded status (200) if any
 * dependency is unreachable so the process is still marked alive.
 *
 * For a deeper health view (DB counts, AI provider status, etc.) see
 * GET /api/system-health (requires auth).
 */

const HEALTH_DB_TIMEOUT_MS = 3_000; // 3-second timeout for DB probe
const REDIS_PING_TIMEOUT_MS = 2_000; // 2-second timeout for Redis ping

async function healthHandler(_request: Request) {
  // ── Database health ──
  let dbHealthy = false;
  let dbLatencyMs: number | null = null;
  if (process.env.DATABASE_URL) {
    const dbStart = Date.now();
    try {
      await Promise.race([
        db.$queryRaw<Array<{ _1: number }>>`SELECT 1 as _1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB probe timeout')), HEALTH_DB_TIMEOUT_MS)
        ),
      ]);
      dbLatencyMs = Date.now() - dbStart;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }
  }

  // ── Redis health (via unified redis-client abstraction) ──
  let redisHealthy: boolean | null = null; // null = not configured
  let redisLatencyMs: number | null = null;
  try {
    const { getRedisClient, getClientType } = await import('@/lib/redis-client');
    const client = await getRedisClient();
    if (client) {
      const redisStart = Date.now();
      try {
        const pong = await Promise.race([
          client.ping(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Redis probe timeout')), REDIS_PING_TIMEOUT_MS)
          ),
        ]);
        redisHealthy = pong === 'PONG';
        redisLatencyMs = Date.now() - redisStart;
      } catch {
        redisHealthy = false;
      }
    }
    // If client is null but not because of error — Redis not configured
    if (!client && getClientType() === 'none') {
      redisHealthy = null; // Not configured
    }
  } catch {
    redisHealthy = false;
  }

  // ── Phase 4.6.6: Collect connection pool health metrics ──
  let poolMetrics: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    poolUtilizationPercent: number;
  } | null = null;

  if (dbHealthy && process.env.USE_DB_PERSISTENCE === 'true') {
    try {
      const { getPersistenceAdapter } = await import('@/lib/persistence/intelligence-persistence-adapter');
      poolMetrics = getPersistenceAdapter().getPoolMetrics();
    } catch {
      // Pool metrics are optional enrichment — don't fail health check
    }
  }

  // ── Phase 1.6 — KG readiness check ──
  let kgReady = false;
  if (dbHealthy && process.env.USE_DB_PERSISTENCE === 'true') {
    try {
      const { getGraphStats } = await import('@/lib/intelligence/knowledge-graph');
      const stats = await getGraphStats();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kgReady = ((stats as any).totalNodes > 0 || (stats as any).totalEdges > 0);
    } catch {
      // KG not available
    }
  }

  // ── SWR cache stats (Phase F) ──
  let swrStats: { size: number; revalidating: number } | null = null;
  try {
    const { getSWRCacheStats } = await import('@/lib/swr-cache');
    swrStats = getSWRCacheStats();
  } catch {
    // SWR cache not available
  }

  // ── Redis Pub/Sub status (Phase F) ──
  let pubSubActive = false;
  try {
    const { isPubSubActive } = await import('@/lib/redis-pubsub');
    pubSubActive = isPubSubActive();
  } catch {
    // Pub/sub not available
  }

  // ── Memory usage metrics ──
  const memUsage = process.memoryUsage();
  const memory = {
    rssMb: Math.round(memUsage.rss / 1024 / 1024),
    heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
    externalMb: Math.round(memUsage.external / 1024 / 1024),
  };

  // ── Deployment config ──
  const deployConfig = getDeploymentConfig();

  // ── Determine overall status ──
  const criticalDeps = [dbHealthy];
  const allCriticalHealthy = criticalDeps.every(Boolean);

  return NextResponse.json(
    {
      status: allCriticalHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Deployment info (Phase G)
      deployment: {
        slot: deployConfig.deploySlot,
        version: deployConfig.version,
        region: deployConfig.region,
        environment: deployConfig.environment,
        buildSha: deployConfig.buildSha,
        isCanary: deployConfig.isCanary,
        canaryWeight: deployConfig.canaryWeight,
      },
      // M4 Phase 3.6 — Build/deployment identifier
      version: deployConfig.buildSha,
      environment: deployConfig.environment,
      // Indicate which AI providers are configured WITHOUT exposing secret values.
      providers: {
        nvidia: Boolean(process.env.NVIDIA_API_KEY),
        fireworks: Boolean(process.env.FIREWORKS_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        tavily: Boolean(process.env.TAVILY_API_KEY),
      },
      // Dependency health
      db: {
        healthy: dbHealthy,
        latencyMs: dbLatencyMs,
      },
      redis: redisHealthy === null
        ? { configured: false }
        : { configured: true, healthy: redisHealthy, latencyMs: redisLatencyMs },
      // Phase 4.6.6: Connection pool utilization metrics
      ...(poolMetrics ? { pool: poolMetrics } : {}),
      // Phase C: Connection pool health from pool monitor
      poolHealth: { totalConnections: 0, activeConnections: 0, idleConnections: 0, waitingRequests: 0 },
      // Phase 1.6 — KG readiness
      kgReady,
      // Phase F: SWR cache & Pub/Sub status
      swrCache: swrStats,
      ssePubSub: { active: pubSubActive },
      // G6 FIX: Persistence mode
      persistenceMode: process.env.PERSISTENCE_MODE || 'memory',
      // Memory usage (Phase G)
      memory,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export const GET = withApiLogging(healthHandler, '/api/health');
