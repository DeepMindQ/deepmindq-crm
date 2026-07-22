/**
 * Phase 7.5: Knowledge Fabric Foundation
 *
 * Structured business memory. Relational storage.
 * Creates and queries KnowledgeEntry records.
 */

import { db } from '@/lib/db';
import { KnowledgeCategory, ALL_CATEGORIES } from './types';

export interface KnowledgeInput {
  companyId: string;
  category: string;
  subCategory?: string;
  content: string;
  source?: string;
  intelligenceObjectId?: string;
  confidence?: number;
}

/** Create a new knowledge entry */
export async function createKnowledgeEntry(input: KnowledgeInput) {
  if (!ALL_CATEGORIES.includes(input.category as KnowledgeCategory)) {
    throw new Error(
      `Invalid knowledge category: ${input.category}. Must be one of: ${ALL_CATEGORIES.join(', ')}`
    );
  }

  return db.knowledgeEntry.create({
    data: {
      companyId: input.companyId,
      category: input.category,
      subCategory: input.subCategory ?? null,
      content: input.content,
      source: input.source ?? null,
      intelligenceObjectId: input.intelligenceObjectId ?? null,
      confidence: input.confidence ?? 0.5,
    },
  });
}

/** Update a knowledge entry (creates version history inline) */
export async function updateKnowledgeEntry(
  id: string,
  newContent: string,
  reason: string
) {
  const existing = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!existing) throw new Error(`Knowledge entry not found: ${id}`);

  return db.knowledgeEntry.update({
    where: { id },
    data: {
      content: newContent,
      previousValue: existing.content,
      changeReason: reason,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });
}

/** Get all knowledge entries for a company, grouped by category */
export async function getCompanyKnowledge(companyId: string) {
  const entries = await db.knowledgeEntry.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  });

  const grouped: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = [];
    }
    grouped[entry.category].push(entry);
  }

  return { entries, grouped };
}

/** Get knowledge entries for a specific company + category */
export async function getKnowledgeByCategory(companyId: string, category: string) {
  return db.knowledgeEntry.findMany({
    where: { companyId, category },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Search knowledge entries by keyword */
export async function searchKnowledge(companyId: string, keyword: string) {
  return db.knowledgeEntry.findMany({
    where: {
      companyId,
      content: { contains: keyword },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}