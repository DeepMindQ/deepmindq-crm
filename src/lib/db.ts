import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Prisma DB client — PostgreSQL with Neon adapter

   - Vercel / serverless: uses @prisma/adapter-neon for
     connection pooling (pgbouncer-compatible).
   - Local dev: uses standard PrismaClient with direct
     PostgreSQL connection.
   ═══════════════════════════════════════════════════ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA;

  if (isServerless && process.env.DATABASE_URL) {
    // Serverless (Vercel) — use Neon adapter for connection pooling
    const { neon } = require("@neondatabase/serverless");
    const { PrismaNeon } = require("@prisma/adapter-neon");

    const neonPool = neon(process.env.DATABASE_URL!);
    const adapter = new PrismaNeon(neonPool);

    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  }

  // Local dev or non-serverless — direct connection
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

const prisma = createPrismaClient();

// Prevent hot-reload from creating multiple instances in dev
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;
