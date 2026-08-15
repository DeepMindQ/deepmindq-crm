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

    // Try PostgreSQL pool metrics query
    const result = await db.$queryRaw<Array<{ count: string }>>`
      SELECT count(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const totalConnections = parseInt(result[0]?.count || '0', 10);
    const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '10', 10);

    // Estimate active vs idle from pool configuration
    const activeConnections = Math.min(
      Math.ceil(totalConnections * 0.3), // ~30% active estimate
      poolSize,
    );
    const idleConnections = Math.max(totalConnections - activeConnections, 0);

    return {
      totalConnections,
      activeConnections,
      idleConnections,
      waitingRequests: 0, // pg doesn't expose this easily via query
      poolUtilizationPercent: poolSize > 0 ? Math.round((activeConnections / poolSize) * 100) : 0,
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
