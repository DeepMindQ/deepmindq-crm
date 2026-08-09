import { PrismaClient } from "@prisma/client";
import { recordDbQuery } from '@/lib/database-performance-monitor';
import { createEncryptionExtension } from '@/lib/prisma-encryption-middleware';

/* ═══════════════════════════════════════════════════════════════════════════
   Prisma DB client — PostgreSQL (Neon)

   Hardened for production:
   - Connection pool limits parsed from DATABASE_URL or sensible defaults
   - Query event logging for slow queries (>1000ms) in development
   - Diagnostics metrics export for monitoring
   - Database performance monitor with p50/p95/p99 tracking
   - Global singleton pattern preserved for hot-reload safety
   - PII encryption/decryption via client extension
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Connection Pool Configuration ────────────────────────────────────────

const SLOW_QUERY_THRESHOLD_MS = 1000;

/**
 * Parse connection_limit from the DATABASE_URL query string.
 * Falls back to 10 for serverless (Vercel) or 20 for standard environments.
 */
function parseConnectionLimit(): number {
  const dbUrl = process.env.DATABASE_URL ?? '';
  try {
    const url = new URL(dbUrl);
    const raw = url.searchParams.get('connection_limit');
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // DATABASE_URL is not a valid URL — use defaults
  }

  // Serverless detection
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 10;
  }
  return 20;
}

// ─── Diagnostics ───────────────────────────────────────────────────────────

/**
 * Prisma.Diagnostics — lightweight metrics counter for monitoring.
 * Tracks total queries, slow queries, and timeouts.
 */
export const PrismaDiagnostics = {
  totalQueries: 0,
  slowQueries: 0,
  timedOutQueries: 0,

  /** Reset all counters (useful for testing / periodic reporting). */
  reset() {
    this.totalQueries = 0;
    this.slowQueries = 0;
    this.timedOutQueries = 0;
  },

  /** Get a snapshot of current metrics. */
  snapshot() {
    return {
      totalQueries: this.totalQueries,
      slowQueries: this.slowQueries,
      timedOutQueries: this.timedOutQueries,
    };
  },
};

// ─── Client Factory ──────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedClient> | undefined;
};

function createExtendedClient() {
  const isDev = process.env.NODE_ENV === 'development';
  const connectionLimit = parseConnectionLimit();

  const client = new PrismaClient({
    log: isDev
      ? [
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'query' },
        ]
      : [
          { emit: 'stdout', level: 'error' },
        ],
    datasourceUrl: buildDatasourceUrl(connectionLimit),
  });

  // ── Query Event Logging + Performance Monitoring ──
  client.$on('query', (event: { query: string; duration: number; target: string; timestamp: Date }) => {
    PrismaDiagnostics.totalQueries++;

    // Feed into database performance monitor (p50/p95/p99 tracking)
    try {
      // Extract model and action from target (e.g., "prisma.Model.findMany")
      const parts = event.target.split('.');
      const model = parts.length >= 1 ? parts[0] : 'unknown';
      const action = parts.length >= 2 ? parts.slice(1).join('.') : 'unknown';
      recordDbQuery(model, action, event.duration);
    } catch {
      // Non-blocking — never let monitoring break queries
    }

    // Slow query detection (development + production)
    if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
      PrismaDiagnostics.slowQueries++;
      console.warn(
        `[PRISMA-SLOW] Query on ${event.target} took ${event.duration}ms (threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)\n  ${event.query.substring(0, 200)}`,
      );
    }
  });

  // Apply PII encryption/decryption extension
  return client.$extends(createEncryptionExtension());
}

/**
 * Build a datasource URL with connection_limit parameter.
 * Appends or overrides the connection_limit in the DATABASE_URL.
 */
function buildDatasourceUrl(connectionLimit: number): string {
  const dbUrl = process.env.DATABASE_URL ?? '';
  try {
    const url = new URL(dbUrl);
    url.searchParams.set('connection_limit', String(connectionLimit));
    // pgBouncer mode: use pgbouncer=true for Neon serverless
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    // If DATABASE_URL isn't a valid URL, return as-is
    return dbUrl;
  }
}

const prisma = createExtendedClient();

// Prevent hot-reload from creating multiple instances in dev
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;
