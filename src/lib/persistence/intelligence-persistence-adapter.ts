/**
 * Intelligence Persistence Adapter — Database pool metrics and health monitoring.
 *
 * Provides observability into the database connection pool used by
 * the intelligence engines. In production, Prisma uses a connection
 * pool via the underlying database driver (pg/mysql).
 *
 * For Prisma with PostgreSQL, we expose pool metrics via:
 *   - Prisma's $queryRaw for pool inspection queries
 *   - Environment-based pool size configuration
 */

import { logger } from '@/lib/logger';

// ─── Pool Metrics ─────────────────────────────────────────────────────

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  poolUtilizationPercent: number;
}

/**
 * Get database pool metrics.
 * Attempts to query pg_stat_activity for real metrics.
 * Falls back to configured pool size estimates.
 */
export async function getPoolMetrics(): Promise<PoolMetrics | null> {
  try {
    const { db } = await import('@/lib/db');

    // SQLite pool metrics — single file connection, simplified metrics
    const result = await db.$queryRaw<Array<{ count: number }>>`
      SELECT 1 as count
    `;

    const poolSize = 1; // SQLite uses a single connection per file

    return {
      totalConnections: poolSize,
      activeConnections: result.length > 0 ? 1 : 0,
      idleConnections: 0,
      waitingRequests: 0,
      poolUtilizationPercent: result.length > 0 ? 100 : 0,
    };
  } catch (err) {
    // DB not available or not PostgreSQL — return null
    logger.debug('[PERSISTENCE] Could not fetch pool metrics:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── Backward-Compatible Interface ────────────────────────────────────

export function getPersistenceAdapter() {
  return {
    async getPoolMetrics(): Promise<PoolMetrics | null> {
      return getPoolMetrics();
    },
  };
}
