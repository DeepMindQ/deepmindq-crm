import { NextResponse } from 'next/server';
import { db, getPoolStats } from '@/lib/db';

/**
 * GET /api/health — Lightweight liveness probe (NO auth).
 *
 * Used by Vercel/Render health checks. Probes database connectivity
 * with a lightweight SELECT 1 query. Returns degraded status if DB
 * is unreachable but still returns 200 so the process is marked alive.
 *
 * For a deeper health view (DB counts, AI provider status, etc.) see
 * GET /api/system-health (requires auth).
 */
export const dynamic = 'force-dynamic';

const HEALTH_DB_TIMEOUT_MS = 3_000; // 3-second timeout for DB probe

export async function GET() {
  // Probe DB connectivity with a lightweight query and timeout
  let dbHealthy = false;
  if (process.env.DATABASE_URL) {
    try {
      await Promise.race([
        db.$queryRaw<Array<{ _1: number }>>`SELECT 1 as _1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB probe timeout')), HEALTH_DB_TIMEOUT_MS)
        ),
      ]);
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }
  }

  // Phase 4.6.6: Collect connection pool health metrics
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

  // Phase 1.6 — KG readiness check
  let kgReady = false;
  if (dbHealthy && process.env.USE_DB_PERSISTENCE === 'true') {
    try {
      const { getGraphStats } = await import('@/lib/ai-knowledge-graph');
      const stats = getGraphStats();
      kgReady = (stats.totalNodes > 0 || stats.totalEdges > 0);
    } catch {
      // KG not available
    }
  }

  return NextResponse.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // M4 Phase 3.6 — Build/deployment identifier for deployment pipeline validation
      version: process.env.NEXT_PUBLIC_BUILD_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      // Indicate which AI providers are configured WITHOUT exposing secret values.
      // Priority order: nvidia → fireworks → groq → gemini (see ai-config.ts)
      providers: {
        nvidia: Boolean(process.env.NVIDIA_API_KEY),
        fireworks: Boolean(process.env.FIREWORKS_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        tavily: Boolean(process.env.TAVILY_API_KEY),
      },
      db: dbHealthy,
      // Phase 4.6.6: Connection pool utilization metrics
      ...(poolMetrics ? { pool: poolMetrics } : {}),
      // Phase C: Connection pool health from pool monitor
      poolHealth: getPoolStats(),
      // Phase 1.6 — KG readiness
      kgReady,
      // G6 FIX: Persistence mode
      persistenceMode: process.env.PERSISTENCE_MODE || 'memory',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

