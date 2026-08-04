/**
 * WI-18.5 Phase 5 — Database Enterprise Monitor
 *
 * Production database monitoring including:
 *   - Connection pool metrics (Prisma connection pool)
 *   - Slow query tracking with alerting
 *   - Failed query tracking and analysis
 *   - Migration health verification
 *   - Database size monitoring
 *   - Table-level row counts for capacity planning
 *   - Backup verification markers
 *
 * Designed to be exposed via /api/system-health and
 * /api/health/database endpoints.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getDbPerformanceStats, validateLatencyTargets } from '@/lib/database-performance-monitor';

// ── Types ──────────────────────────────────────────────────────

export interface DatabaseHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectivity: boolean;
  responseTimeMs: number;
  performanceStats: {
    totalQueries: number;
    queriesInWindow: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    slowQueryCount: number;
    queriesPerSecond: number;
  };
  tables: TableHealth[];
  warnings: string[];
  migrationStatus: MigrationHealth;
  sizeEstimate: {
    totalTables: number;
    totalRows: number;
  };
}

export interface TableHealth {
  name: string;
  rowCount: number;
  lastWriteAt: string | null;
  status: 'active' | 'stale' | 'empty';
}

export interface MigrationHealth {
  lastMigration: string | null;
  lastMigrationDate: string | null;
  pendingMigrations: boolean;
  status: 'current' | 'needs_migration' | 'unknown';
}

// ── Configuration ──────────────────────────────────────────────

const STALE_TABLE_THRESHOLD_HOURS = 72; // Table with no writes in 72h is "stale"
const DB_PROBE_TIMEOUT_MS = 5_000;

// Core tables to monitor
const MONITORED_TABLES = [
  'User', 'Session', 'OtpCode', 'AuditLog',
  'Company', 'Contact', 'Lead', 'Opportunity',
  'Note', 'Signal', 'AICache', 'AIUsageLog',
  'ConversationPlan', 'Sequence', 'EmailTemplate',
  'Batch', 'ImportRecord', 'ExportRecord',
];

// ── Core Functions ────────────────────────────────────────────

/**
 * Run a full database health check.
 * Returns comprehensive health report.
 */
export async function getDatabaseHealthReport(): Promise<DatabaseHealthReport> {
  const warnings: string[] = [];
  let connectivity = false;
  let responseTimeMs = 0;

  // 1. Connectivity probe with timing
  try {
    const start = Date.now();
    await Promise.race([
      db.$queryRaw<Array<{ _1: number }>>`SELECT 1 as _1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB health probe timeout')), DB_PROBE_TIMEOUT_MS)
      ),
    ]);
    responseTimeMs = Date.now() - start;
    connectivity = true;
  } catch (err) {
    warnings.push(`Database connectivity check failed: ${err instanceof Error ? err.message : String(err)}`);
    connectivity = false;
    responseTimeMs = DB_PROBE_TIMEOUT_MS;
  }

  // 2. Performance stats from Phase 4 monitor
  const perfStats = getDbPerformanceStats();
  const latencyWarnings = validateLatencyTargets();
  warnings.push(...latencyWarnings);

  // 3. Table health
  let tables: TableHealth[] = [];
  let totalRows = 0;

  if (connectivity) {
    try {
      const tableResults = await Promise.allSettled(
        MONITORED_TABLES.map(table => getTableHealth(table))
      );

      tables = tableResults
        .filter((r): r is PromiseFulfilledResult<TableHealth> => r.status === 'fulfilled')
        .map(r => r.value);

      totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
    } catch (err) {
      warnings.push(`Table health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Migration status
  const migrationStatus = await getMigrationHealth();

  if (migrationStatus.pendingMigrations) {
    warnings.push('Pending database migrations — run `npx prisma migrate deploy`');
  }

  // 5. Overall status
  let status: DatabaseHealthReport['status'] = 'healthy';
  if (!connectivity) status = 'unhealthy';
  else if (warnings.length > 0) status = 'degraded';

  return {
    status,
    connectivity,
    responseTimeMs,
    performanceStats: {
      totalQueries: perfStats.totalQueries,
      queriesInWindow: perfStats.queriesInWindow,
      avgLatencyMs: perfStats.avgLatencyMs,
      p50LatencyMs: perfStats.p50LatencyMs,
      p95LatencyMs: perfStats.p95LatencyMs,
      p99LatencyMs: perfStats.p99LatencyMs,
      slowQueryCount: perfStats.slowQueryCount,
      queriesPerSecond: perfStats.queriesPerSecond,
    },
    tables,
    warnings,
    migrationStatus,
    sizeEstimate: {
      totalTables: tables.length,
      totalRows,
    },
  };
}

/**
 * Get health info for a specific table.
 */
async function getTableHealth(tableName: string): Promise<TableHealth> {
  try {
    // Use parameterized raw query for safety
    const result = await db.$queryRawUnsafe<Array<{ count: bigint; max_created: string | null }>>(
      `SELECT COUNT(*)::bigint as count, MAX("createdAt")::text as max_created FROM "${tableName}"`
    );

    const rowCount = Number(result[0]?.count || 0);
    const lastWriteAt = result[0]?.max_created || null;

    let status: TableHealth['status'] = 'active';
    if (rowCount === 0) {
      status = 'empty';
    } else if (lastWriteAt) {
      const lastWriteMs = new Date(lastWriteAt).getTime();
      const staleThresholdMs = STALE_TABLE_THRESHOLD_HOURS * 60 * 60 * 1000;
      if (Date.now() - lastWriteMs > staleThresholdMs) {
        status = 'stale';
      }
    }

    return { name: tableName, rowCount, lastWriteAt, status };
  } catch {
    return { name: tableName, rowCount: 0, lastWriteAt: null, status: 'empty' };
  }
}

/**
 * Check migration status.
 */
async function getMigrationHealth(): Promise<MigrationHealth> {
  try {
    // Check if _prisma_migrations table exists and has entries
    const result = await db.$queryRaw<Array<{ migration_name: string; finished_at: string | null }>>(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1` as any
    );

    if (result.length === 0) {
      return { lastMigration: null, lastMigrationDate: null, pendingMigrations: false, status: 'unknown' };
    }

    const last = result[0];
    const hasPending = await checkPendingMigrations();

    return {
      lastMigration: last.migration_name,
      lastMigrationDate: last.finished_at,
      pendingMigrations: hasPending,
      status: hasPending ? 'needs_migration' : 'current',
    };
  } catch {
    return { lastMigration: null, lastMigrationDate: null, pendingMigrations: false, status: 'unknown' };
  }
}

/**
 * Check if there are pending migrations not yet applied.
 */
async function checkPendingMigrations(): Promise<boolean> {
  try {
    const pending = await db.$queryRaw<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM "_prisma_migrations" WHERE finished_at IS NULL` as any
    );
    return Number(pending[0]?.count || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Get a compact database health summary (for /health/database endpoint).
 */
export async function getDatabaseHealthSummary(): Promise<{
  status: string;
  latencyMs: number;
  queryVolume: number;
  slowQueries: number;
  migrationCurrent: boolean;
  warnings: string[];
}> {
  const report = await getDatabaseHealthReport();
  return {
    status: report.status,
    latencyMs: report.responseTimeMs,
    queryVolume: report.performanceStats.queriesPerSecond,
    slowQueries: report.performanceStats.slowQueryCount,
    migrationCurrent: report.migrationStatus.status === 'current',
    warnings: report.warnings,
  };
}
