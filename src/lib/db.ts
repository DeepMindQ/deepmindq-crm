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
