/**
 * Human Intelligence Inbox
 *
 * Manages human-submitted intelligence through an inbox workflow:
 *   submit → review → approve/reject → convert to IntelligenceObject
 *
 * Part of the DeepMindQ Sprint 3 intelligence acquisition layer.
 */

import { db } from '@/lib/db';
import { ALL_CATEGORIES } from './types';
import type { KnowledgeCategory } from './types';

// ─── Exported Interfaces ──────────────────────────────────────────

/** Input for submitting a new intelligence item to the inbox. */
export interface SubmitInboxInput {
  companyId: string;
  submittedBy: string;
  content: string;
  summary?: string;
  category?: string;
  source?: string;
  sourceUrl?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
}

/** Filter options for querying inbox items. */
export interface InboxFilters {
  companyId?: string;
  status?: string;
  submittedBy?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Aggregated inbox statistics. */
export interface InboxStats {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Ensure tags are stored as a JSON string array. */
function serializeTags(tags?: string[]): string {
  if (!tags || !Array.isArray(tags)) {
    return JSON.stringify([]);
  }
  return JSON.stringify(tags);
}

/** Validate that a category string is a recognised KnowledgeCategory. */
function validateCategory(category: string): void {
  if (!(ALL_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(
      `Invalid category "${category}". Must be one of: ${ALL_CATEGORIES.join(', ')}`
    );
  }
}

// ─── Exported Functions ──────────────────────────────────────────

/**
 * Submit a new intelligence item to the human review inbox.
 *
 * Validates that the referenced company exists and that the category
 * (if provided) is recognised. The item is created with status `pending`.
 *
 * @param input - The submission payload.
 * @returns The created HumanIntelligenceInbox record.
 * @throws Error if the company does not exist or the category is invalid.
 */
export async function submitToIntelligenceInbox(
  input: SubmitInboxInput
): Promise<import('@prisma/client').HumanIntelligenceInbox> {
  const company = await db.company.findUnique({ where: { id: input.companyId } });
  if (!company) {
    throw new Error(`Company with id "${input.companyId}" not found.`);
  }

  if (input.category) {
    validateCategory(input.category);
  }

  const tagsJson = serializeTags(input.tags);

  return db.humanIntelligenceInbox.create({
    data: {
      companyId: input.companyId,
      submittedBy: input.submittedBy,
      content: input.content,
      summary: input.summary ?? null,
      category: (input.category as KnowledgeCategory) ?? null,
      source: input.source ?? 'manual',
      sourceUrl: input.sourceUrl ?? null,
      status: 'pending',
      priority: input.priority ?? 'normal',
      tags: tagsJson,
    },
  });
}

/**
 * Review an inbox item by approving or rejecting it.
 *
 * Only items in `pending` status can be reviewed. The reviewer's
 * identity and optional notes are recorded on the item.
 *
 * @param id - The inbox item id.
 * @param action - Either `'approve'` or `'reject'`.
 * @param reviewerId - The id of the user performing the review.
 * @param notes - Optional review notes.
 * @returns The updated HumanIntelligenceInbox record.
 * @throws Error if the item is not found or not in pending status.
 */
export async function reviewInboxItem(
  id: string,
  action: 'approve' | 'reject',
  reviewerId: string,
  notes?: string
): Promise<import('@prisma/client').HumanIntelligenceInbox> {
  const item = await db.humanIntelligenceInbox.findUnique({ where: { id } });
  if (!item) {
    throw new Error(`HumanIntelligenceInbox item with id "${id}" not found.`);
  }
  if (item.status !== 'pending') {
    throw new Error(
      `Cannot review item with status "${item.status}". Only pending items can be reviewed.`
    );
  }

  return db.humanIntelligenceInbox.update({
    where: { id },
    data: {
      status: action,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    },
  });
}

/**
 * Convert an approved inbox item into a full IntelligenceObject.
 *
 * The inbox item must be in `approved` status. A new IntelligenceObject
 * is created with `sourceType='human'` and `origin='human_submission'`.
 * The inbox item is then updated to `converted` status with a back-reference
 * to the new IntelligenceObject.
 *
 * @param id - The inbox item id.
 * @returns The updated inbox item and the newly created IntelligenceObject.
 * @throws Error if the item is not found or not in approved status.
 */
export async function convertApprovedItem(
  id: string
): Promise<{
  inboxItem: import('@prisma/client').HumanIntelligenceInbox;
  intelligenceObject: any;
}> {
  const inboxItem = await db.humanIntelligenceInbox.findUnique({ where: { id } });
  if (!inboxItem) {
    throw new Error(`HumanIntelligenceInbox item with id "${id}" not found.`);
  }
  if (inboxItem.status !== 'approved') {
    throw new Error(
      `Cannot convert item with status "${inboxItem.status}". Only approved items can be converted.`
    );
  }

  const tags: string[] = (() => {
    try {
      const parsed = JSON.parse(inboxItem.tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const intelligenceObject = await db.intelligenceObject.create({
    data: {
      companyId: inboxItem.companyId,
      content: inboxItem.content,
      summary: inboxItem.summary ?? null,
      sourceType: 'human',
      origin: 'human_submission',
      sourceName: `human:${inboxItem.submittedBy}`,
      sourceUrl: inboxItem.sourceUrl ?? null,
      capturedAt: inboxItem.createdAt,
      originalConfidence: 0.85,
      confidenceBreakdown: null,
      status: 'active',
      metadata: JSON.stringify({
        category: inboxItem.category,
        priority: inboxItem.priority,
        tags,
        inboxId: id,
      }),
      evidenceId: null,
      connectorId: null,
      connectorRunId: null,
    },
  });

  const updatedInboxItem = await db.humanIntelligenceInbox.update({
    where: { id },
    data: {
      status: 'converted',
      intelligenceObjectId: intelligenceObject.id,
    },
  });

  return { inboxItem: updatedInboxItem, intelligenceObject };
}

/**
 * Query the intelligence inbox with optional filters and pagination.
 *
 * Results are ordered by `createdAt` descending (newest first).
 *
 * @param filters - Optional filter criteria and pagination options.
 * @returns The matching inbox items and the total count across all pages.
 */
export async function getInboxItems(
  filters: InboxFilters = {}
): Promise<{ items: any[]; total: number }> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.status) where.status = filters.status;
  if (filters.submittedBy) where.submittedBy = filters.submittedBy;
  if (filters.priority) where.priority = filters.priority;
  if (filters.search) {
    where.content = { contains: filters.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    db.humanIntelligenceInbox.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.humanIntelligenceInbox.count({ where }),
  ]);

  return { items, total };
}

/**
 * Fetch a single inbox item by id, including the associated company
 * (only `id` and `rawName` are selected).
 *
 * @param id - The inbox item id.
 * @returns The inbox item with its company relation.
 * @throws Error if the item is not found.
 */
export async function getInboxItem(
  id: string
): Promise<import('@prisma/client').HumanIntelligenceInbox> {
  const item = await db.humanIntelligenceInbox.findUnique({
    where: { id },
    include: {
      company: {
        select: { id: true, rawName: true },
      },
    },
  });

  if (!item) {
    throw new Error(`HumanIntelligenceInbox item with id "${id}" not found.`);
  }

  return item;
}

/**
 * Get aggregated statistics about the intelligence inbox.
 *
 * Returns counts grouped by status and by priority, plus a grand total.
 *
 * @returns The inbox statistics.
 */
export async function getInboxStats(): Promise<InboxStats> {
  const [itemsByStatus, itemsByPriority, total] = await Promise.all([
    db.humanIntelligenceInbox.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    db.humanIntelligenceInbox.groupBy({
      by: ['priority'],
      _count: { priority: true },
    }),
    db.humanIntelligenceInbox.count(),
  ]);

  const byStatus: Record<string, number> = {
    pending: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    converted: 0,
  };
  for (const row of itemsByStatus) {
    byStatus[row.status] = row._count.status;
  }

  const byPriority: Record<string, number> = {
    low: 0,
    normal: 0,
    high: 0,
    critical: 0,
  };
  for (const row of itemsByPriority) {
    byPriority[row.priority] = row._count.priority;
  }

  return { byStatus, byPriority, total };
}

/**
 * Update editable fields on a pending inbox item.
 *
 * Only items in `pending` status can be edited. Accepted fields are
 * `content`, `summary`, `category`, `priority`, and `tags`.
 *
 * @param id - The inbox item id.
 * @param data - The fields to update.
 * @returns The updated HumanIntelligenceInbox record.
 * @throws Error if the item is not found or not in pending status.
 */
export async function updateInboxItem(
  id: string,
  data: {
    content?: string;
    summary?: string;
    category?: string;
    priority?: string;
    tags?: string[];
  }
): Promise<import('@prisma/client').HumanIntelligenceInbox> {
  const item = await db.humanIntelligenceInbox.findUnique({ where: { id } });
  if (!item) {
    throw new Error(`HumanIntelligenceInbox item with id "${id}" not found.`);
  }
  if (item.status !== 'pending') {
    throw new Error(
      `Cannot update item with status "${item.status}". Only pending items can be edited.`
    );
  }

  if (data.category) {
    validateCategory(data.category);
  }

  const updateData: Record<string, unknown> = {};
  if (data.content !== undefined) updateData.content = data.content;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.tags !== undefined) updateData.tags = serializeTags(data.tags);

  return db.humanIntelligenceInbox.update({
    where: { id },
    data: updateData,
  });
}