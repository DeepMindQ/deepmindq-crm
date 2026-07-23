import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Prisma DB client — Direct PostgreSQL connection

   Single-customer dedicated deployment — no connection
   pooling adapter needed. Prisma connects directly to
   Neon PostgreSQL via DATABASE_URL.
   ═══════════════════════════════════════════════════ */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
});

// Prevent hot-reload from creating multiple instances in dev
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export const db = globalForPrisma.prisma;
