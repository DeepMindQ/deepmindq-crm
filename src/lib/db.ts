import { PrismaClient } from "@prisma/client";

/* ═══════════════════════════════════════════════════════════════════════════
   Prisma DB client — PostgreSQL (Neon)

   Uses standard PrismaClient. Works on both local dev and
   Vercel serverless. Neon's pgbouncer-compatible connection
   string works natively with PrismaClient.
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   Typed Select Constants — Ticket 1: Foundation Hardening

   These constants define explicit field selections for common queries.
   Using typed selects instead of SELECT * improves:
     1. Performance — only requested columns are fetched from PostgreSQL
     2. Security — sensitive fields are never accidentally exposed
     3. Maintainability — query intent is explicit and auditable

   Usage:
     const company = await db.company.findUnique({
       where: { id },
       select: COMPANY_PROFILE_SELECT,
     });
   ═══════════════════════════════════════════════════════════════════════════ */

/** Core fields for company list views (no heavy text fields) */
export const COMPANY_LIST_SELECT = {
  id: true,
  rawName: true,
  normalizedName: true,
  domain: true,
  industry: true,
  sizeRange: true,
  location: true,
  country: true,
  status: true,
  priorityTier: true,
  intelligenceScore: true,
  engagementScore: true,
  accountPriorityScore: true,
  lastEnrichedAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Full company profile for detail views */
export const COMPANY_PROFILE_SELECT = {
  id: true,
  rawName: true,
  normalizedName: true,
  domain: true,
  industry: true,
  sizeRange: true,
  location: true,
  country: true,
  website: true,
  status: true,
  lifecycleStage: true,
  priorityTier: true,
  source: true,
  intelligenceScore: true,
  engagementScore: true,
  accountPriorityScore: true,
  assignedTo: true,
  notes: true,
  lastEnrichedAt: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Core fields for contact list views */
export const CONTACT_LIST_SELECT = {
  id: true,
  rawName: true,
  normalizedName: true,
  email: true,
  title: true,
  role: true,
  phone: true,
  location: true,
  companyId: true,
  status: true,
  consentStatus: true,
  emailHealth: true,
  leadScore: true,
  source: true,
  lastActivityAt: true,
  createdAt: true,
} as const;

/** Full contact profile for detail views */
export const CONTACT_PROFILE_SELECT = {
  id: true,
  rawName: true,
  normalizedName: true,
  editedName: true,
  email: true,
  linkedinUrl: true,
  title: true,
  role: true,
  phone: true,
  location: true,
  companyId: true,
  batchId: true,
  status: true,
  consentStatus: true,
  emailHealth: true,
  leadScore: true,
  source: true,
  notes: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Signal fields for list views */
export const SIGNAL_LIST_SELECT = {
  id: true,
  companyId: true,
  signalType: true,
  title: true,
  summary: true,
  severity: true,
  impact: true,
  status: true,
  timingWindow: true,
  meaningCategory: true,
  confidence: true,
  source: true,
  sourceUrl: true,
  detectedAt: true,
  createdAt: true,
} as const;

/** Evidence fields for grounding/intelligence */
export const EVIDENCE_SELECT = {
  id: true,
  companyId: true,
  signalId: true,
  sourceType: true,
  sourceUrl: true,
  snippet: true,
  confidence: true,
  extractedField: true,
  createdAt: true,
} as const;

/** Intelligence event fields */
export const INTELLIGENCE_OBJECT_SELECT = {
  id: true,
  companyId: true,
  objectType: true,
  source: true,
  title: true,
  content: true,
  summary: true,
  priority: true,
  confidence: true,
  metadata: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** User fields for auth/session (no password hashes) */
export const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Job fields for queue processing */
export const JOB_SELECT = {
  id: true,
  type: true,
  status: true,
  priority: true,
  companyId: true,
  payload: true,
  result: true,
  error: true,
  attempts: true,
  maxAttempts: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} as const;

/** AI Call Log fields for audit */
export const AI_CALL_LOG_SELECT = {
  id: true,
  companyId: true,
  engine: true,
  model: true,
  tier: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  costUsd: true,
  durationMs: true,
  status: true,
  governancePassed: true,
  createdAt: true,
} as const;
