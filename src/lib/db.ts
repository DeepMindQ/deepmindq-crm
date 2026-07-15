import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════
   Prisma DB client — Neon PostgreSQL
   Works on both local dev and Vercel serverless.
   ═══════════════════════════════════════════════════ */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const db = prisma;