import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════
   Prisma DB client — PostgreSQL (Neon)

   Uses standard PrismaClient. Works on both local dev and
   Vercel serverless. Neon's pgbouncer-compatible connection
   string works natively with PrismaClient.
   ═══════════════════════════════════════════════════════════════ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prisma = createPrismaClient();

// Prevent hot-reload from creating multiple instances in dev
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;
