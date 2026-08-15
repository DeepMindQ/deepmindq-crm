import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Intelligence OS — Database Client
//
// Prisma client for SQLite. Singleton pattern for hot-reload safety.
// ═══════════════════════════════════════════════════════════════════════════

const SLOW_QUERY_THRESHOLD_MS = 1000;

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

  const client = new PrismaClient({
    log: isDev
      ? [
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
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

const prisma = createClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;

// Async initialization for SQLite WAL mode
async function initDb() {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    try {
      // Enable WAL mode for concurrent reads + single-writer (best SQLite concurrency)
      await db.$executeRaw`PRAGMA journal_mode=WAL`;
      // Set busy timeout to 5 seconds — writer waits for readers to finish
      await db.$executeRaw`PRAGMA busy_timeout=5000`;
      // Set WAL auto-checkpoint threshold (1000 pages ≈ 4MB)
      await db.$executeRaw`PRAGMA wal_autocheckpoint=1000`;
      logger.info('[DB] SQLite WAL mode enabled with busy_timeout=5000, auto_checkpoint=1000');
    } catch (e) {
      logger.warn('[DB] Failed to set SQLite pragmas', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
initDb().catch(() => {});
