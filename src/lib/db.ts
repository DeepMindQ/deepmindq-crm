import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Prisma DB client — Neon PostgreSQL with serverless pooling
   
   Uses @prisma/adapter-neon for connection pooling
   on Vercel serverless. Falls back to direct connection
   for local development.
   ═══════════════════════════════════════════════════ */

let prisma: PrismaClient;

if (process.env.DATABASE_URL?.startsWith('postgresql://')) {
  // Serverless / Neon environment: use connection pooling
  const { Pool } = require('@neondatabase/serverless');
  const { PrismaNeon } = require('@prisma/adapter-neon');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Max connections per serverless function
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
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const db = prisma;
