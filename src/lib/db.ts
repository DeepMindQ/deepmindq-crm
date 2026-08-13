import { PrismaClient } from "@prisma/client";
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Intelligence OS — Database Client
//
// Prisma client for PostgreSQL. Singleton pattern for hot-reload safety.
// ═══════════════════════════════════════════════════════════════════════════

const SLOW_QUERY_THRESHOLD_MS = 1000;

function parseConnectionLimit(): number {
  const envLimit = process.env.DATABASE_POOL_SIZE;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  try {
    const url = new URL(dbUrl);
    const raw = url.searchParams.get('connection_limit');
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // Not a valid URL — use defaults
  }

  return 10;
}

export const PrismaDiagnostics = {
  totalQueries: 0,
  slowQueries: 0,

  reset() {
    this.totalQueries = 0;
    this.slowQueries = 0;
  },

  snapshot() {
    return { totalQueries: this.totalQueries, slowQueries: this.slowQueries };
  },
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const isDev = process.env.NODE_ENV === 'development';
  const connectionLimit = parseConnectionLimit();

  const client = new PrismaClient({
    log: isDev
      ? [
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
    datasourceUrl: buildDatasourceUrl(connectionLimit),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('query', (event: { query: string; duration: number; target: string }) => {
    PrismaDiagnostics.totalQueries++;
    if (event.duration > SLOW_QUERY_THRESHOLD_MS) {
      PrismaDiagnostics.slowQueries++;
      logger.warn(`[PRISMA-SLOW] ${event.target} took ${event.duration}ms`, {
        target: event.target,
        duration: event.duration,
      });
    }
  });

  return client;
}

function buildDatasourceUrl(connectionLimit: number): string {
  const dbUrl = process.env.DATABASE_URL ?? '';
  try {
    const url = new URL(dbUrl);
    url.searchParams.set('connection_limit', String(connectionLimit));
    url.searchParams.set('pool_timeout', '30');
    if (process.env.VERCEL) {
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    return dbUrl;
  }
}

const prisma = createClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;
