import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════
   Prisma DB client — PostgreSQL with Neon adapter

   - Vercel / serverless: uses @prisma/adapter-neon for
     connection pooling (pgbouncer-compatible).
   - Local dev: uses standard PrismaClient with direct
     PostgreSQL connection.
   - Fallback: if Neon adapter fails, falls back to direct
     PrismaClient connection.
   ═══════════════════════════════════════════════════════════════ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA;

  if (isServerless && process.env.DATABASE_URL) {
    // Serverless (Vercel) — try Neon adapter for connection pooling
    try {
      // Use dynamic require with try/catch for webpack compatibility
      const neonMod = require("@neondatabase/serverless");
      const adapterMod = require("@prisma/adapter-neon");

      if (neonMod?.neon && adapterMod?.PrismaNeon) {
        const neonPool = neonMod.neon(process.env.DATABASE_URL);
        const adapter = new adapterMod.PrismaNeon(neonPool);

        const client = new PrismaClient({
          adapter,
          log: ["error"],
        });

        console.log("[DB] Using Neon adapter for serverless connection");
        return client;
      }
    } catch (neonError) {
      console.warn("[DB] Neon adapter failed, falling back to direct connection:", neonError instanceof Error ? neonError.message : neonError);
    }
  }

  // Direct connection (local dev or Neon adapter fallback)
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
