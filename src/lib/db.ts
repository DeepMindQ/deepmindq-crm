import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Prisma DB client — Neon PostgreSQL with serverless pooling
   
   Uses @prisma/adapter-neon for connection pooling
   on Vercel serverless. Falls back to direct connection
   for local development.
   ═══════════════════════════════════════════════════ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

const DATABASE_URL = process.env.DATABASE_URL || '';

if (DATABASE_URL.startsWith('postgresql://') || DATABASE_URL.startsWith('pool:')) {
  // Serverless / Neon environment: use connection pooling
  const { Pool } = require('@neondatabase/serverless');
  const { PrismaNeon } = require('@prisma/adapter-neon');

  // Convert pool:// prefix back to postgresql:// for the Neon Pool
  const poolUrl = DATABASE_URL.replace(/^pool:/, 'postgresql://');

  const pool = new Pool({
    connectionString: poolUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaNeon(pool);

  prisma = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
} else {
  // Local development or non-Neon databases
  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Prevent hot-reload from creating multiple instances in dev
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
prisma = globalForPrisma.prisma;

export const db = prisma;
