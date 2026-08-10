/**
 * P5.4 — Connection Pool Monitor
 *
 * Tracks Prisma connection pool health and alerts on exhaustion.
 * Uses Prisma's built-in $on('beforeExit') and metrics.
 */

import { logger } from '@/lib/logger';

interface PoolStats {
  activeConnections: number;
  totalConnections: number;
  connectionLimit: number;
  waitingForConnection: number;
  poolTimeoutCount: number;
  lastCheckedAt: number;
}

let stats: PoolStats = {
  activeConnections: 0,
  totalConnections: 0,
  connectionLimit: 20,
  waitingForConnection: 0,
  poolTimeoutCount: 0,
  lastCheckedAt: Date.now(),
};

export function recordPoolTimeout(): void {
  stats.poolTimeoutCount++;
  logger.warn(`[pool-monitor] Connection pool timeout detected (total timeouts: ${stats.poolTimeoutCount})`);
}

export function updatePoolStats(active: number, total: number, limit: number): void {
  stats.activeConnections = active;
  stats.totalConnections = total;
  stats.connectionLimit = limit;
  stats.lastCheckedAt = Date.now();
}

export function getPoolStats(): PoolStats & { health: 'healthy' | 'warning' | 'critical' } {
  const utilization = stats.connectionLimit > 0 ? stats.activeConnections / stats.connectionLimit : 0;
  const health = utilization >= 0.9 ? 'critical' : utilization >= 0.7 ? 'warning' : 'healthy';
  return { ...stats, health };
}
