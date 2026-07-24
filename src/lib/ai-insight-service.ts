/**
 * AI Insight Service — Centralized persistence and retrieval of AI insights.
 *
 * Every AI route should create insights through this service to ensure
 * consistent format, validation, and traceability.
 */

import { db } from './db';
import {
  type AIInsightInput,
  type AIInsightOutput,
  type AIInsightEvidence,
} from './ai-insight-types';

/**
 * Create a single AI insight and persist to database.
 */
export async function createInsight(input: AIInsightInput): Promise<AIInsightOutput> {
  const record = await db.aIInsight.create({
    data: {
      companyId: input.companyId || null,
      contactId: input.contactId || null,
      opportunityId: input.opportunityId || null,
      type: input.type,
      title: input.title,
      description: input.description,
      evidence: JSON.stringify(input.evidence || []),
      confidenceScore: input.confidenceScore,
      impactScore: input.impactScore,
      urgencyScore: input.urgencyScore,
      reasoning: input.reasoning || null,
      recommendedAction: input.recommendedAction || null,
      sourceType: input.sourceType || 'ai_generated',
      sourceRoute: input.sourceRoute || null,
      modelUsed: input.modelUsed || null,
      metadata: JSON.stringify(input.metadata || {}),
      expiresAt: input.expiresAt || null,
    },
  });

  return mapToOutput(record);
}

/**
 * Create multiple insights in a batch.
 */
export async function createInsights(inputs: AIInsightInput[]): Promise<AIInsightOutput[]> {
  const records = await db.aIInsight.createMany({
    data: inputs.map((input) => ({
      companyId: input.companyId || null,
      contactId: input.contactId || null,
      opportunityId: input.opportunityId || null,
      type: input.type,
      title: input.title,
      description: input.description,
      evidence: JSON.stringify(input.evidence || []),
      confidenceScore: input.confidenceScore,
      impactScore: input.impactScore,
      urgencyScore: input.urgencyScore,
      reasoning: input.reasoning || null,
      recommendedAction: input.recommendedAction || null,
      sourceType: input.sourceType || 'ai_generated',
      sourceRoute: input.sourceRoute || null,
      modelUsed: input.modelUsed || null,
      metadata: JSON.stringify(input.metadata || {}),
      expiresAt: input.expiresAt || null,
    })),
  });

  // Fetch them back for proper output format
  const ids = (records as unknown as { id: string }[]).map((r) => r.id);
  const created = await db.aIInsight.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: 'desc' } });
  return created.map(mapToOutput);
}

/**
 * Get insights for a company, optionally filtered by type.
 */
export async function getCompanyInsights(
  companyId: string,
  options?: { type?: string; status?: string; limit?: number; includeExpired?: boolean }
): Promise<AIInsightOutput[]> {
  const where: Record<string, unknown> = { companyId };

  if (options?.type) where.type = options.type;
  if (options?.status) where.status = options.status;
  if (!options?.includeExpired) {
    where.OR = [{ status: 'active' }, { expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  const records = await db.aIInsight.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });

  return records.map(mapToOutput);
}

/**
 * Get insights for a contact.
 */
export async function getContactInsights(
  contactId: string,
  options?: { type?: string; limit?: number }
): Promise<AIInsightOutput[]> {
  const where: Record<string, unknown> = {
    contactId,
    status: 'active',
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };

  if (options?.type) where.type = options.type;

  const records = await db.aIInsight.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 20,
  });

  return records.map(mapToOutput);
}

/**
 * Get high-urgency insights across all companies (for dashboards).
 */
export async function getUrgentInsights(limit = 20): Promise<AIInsightOutput[]> {
  const records = await db.aIInsight.findMany({
    where: {
      status: 'active',
      urgencyScore: { gte: 70 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ urgencyScore: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      company: { select: { rawName: true } },
      contact: { select: { rawName: true, email: true } },
    },
  });

  return records.map((r) => ({
    ...mapToOutput(r),
    companyName: (r as unknown as { company?: { rawName: string } }).company?.rawName || null,
    contactName: (r as unknown as { contact?: { rawName: string } }).contact?.rawName || null,
  }));
}

/**
 * Mark an insight as consumed.
 */
export async function markInsightConsumed(id: string): Promise<void> {
  await db.aIInsight.update({
    where: { id },
    data: { status: 'consumed', consumedAt: new Date() },
  });
}

/**
 * Submit feedback on an insight.
 */
export async function submitInsightFeedback(
  id: string,
  feedback: 'positive' | 'negative' | 'neutral',
  note?: string
): Promise<void> {
  await db.aIInsight.update({
    where: { id },
    data: { feedback, feedbackNote: note || null },
  });
}

/**
 * Expire stale insights (called by freshness decay).
 */
export async function expireStaleInsights(): Promise<number> {
  const result = await db.aIInsight.updateMany({
    where: {
      status: 'active',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'expired' },
  });
  return result.count;
}

// ── Internal Helpers ──────────────────────────────────────────────────

function mapToOutput(record: any): AIInsightOutput {
  let evidence: AIInsightEvidence[] = [];
  try {
    evidence = typeof record.evidence === 'string' ? JSON.parse(record.evidence) : record.evidence || [];
  } catch {
    evidence = [];
  }

  return {
    id: record.id,
    companyId: record.companyId,
    contactId: record.contactId,
    opportunityId: record.opportunityId,
    type: record.type,
    title: record.title,
    description: record.description,
    evidence,
    confidenceScore: record.confidenceScore,
    impactScore: record.impactScore,
    urgencyScore: record.urgencyScore,
    reasoning: record.reasoning,
    recommendedAction: record.recommendedAction,
    sourceType: record.sourceType,
    sourceRoute: record.sourceRoute,
    modelUsed: record.modelUsed,
    status: record.status,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}