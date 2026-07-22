/**
 * Phase 7.5: Evidence Adapter
 *
 * Converts IntelligenceObject data into frozen Evidence records.
 * This is the ONLY module that writes to the Evidence table from Phase 7.5.
 *
 * The adapter NEVER throws — it always returns an EvidenceAdapterResult,
 * capturing any error in the `error` field.
 */

import { db } from '@/lib/db';
import { sourceTypeToQualityTier } from './types';
import type { SourceType } from './types';

interface EvidenceAdapterInput {
  intelligenceObjectId: string;
  companyId: string;
  sourceType: string; // csv, excel, website, rss, document, human
  sourceName?: string;
  sourceUrl?: string;
  content: string;
  summary?: string;
  capturedAt?: Date;
  originalConfidence: number;
  metadata?: Record<string, unknown>; // may contain 'category', 'title', etc.
}

interface EvidenceAdapterResult {
  success: boolean;
  evidenceId?: string;
  error?: string;
}

export async function adaptToEvidence(
  input: EvidenceAdapterInput
): Promise<EvidenceAdapterResult> {
  try {
    // Map IntelligenceObject fields to Evidence fields
    const sourceUrl =
      input.sourceUrl ||
      `internal://acquisition/${input.intelligenceObjectId}`;
    const snippet = input.summary || input.content.substring(0, 500);
    const sourceTitle = (input.metadata?.title as string) || undefined;
    const sourceQualityTier = sourceTypeToQualityTier(
      input.sourceType as SourceType
    );
    const metadataCategory = input.metadata?.category as string | undefined;

    const evidence = await db.evidence.create({
      data: {
        companyId: input.companyId,
        sourceUrl,
        sourceTitle,
        sourceName: input.sourceName || input.sourceType,
        snippet,
        extractedField: metadataCategory || undefined,
        extractedValue: input.content.substring(0, 1000),
        relevanceScore: input.originalConfidence,
        confidence: input.originalConfidence,
        sourceDate: input.capturedAt || new Date(),
        sourceQualityTier,
        status: 'active',
      },
    });

    return { success: true, evidenceId: evidence.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown adapter error';
    return { success: false, error: message };
  }
}