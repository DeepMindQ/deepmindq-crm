/**
 * Confidence Engine — DeepMindQ Sprint 2
 *
 * Computes, persists, and explains confidence scores for IntelligenceObject
 * records.  Confidence is a weighted composite of three sub-scores:
 *   - sourceQuality (35%): static reliability of the source type
 *   - freshness      (35%): time-decay based on when the intelligence was captured
 *   - contentValidation (30%): heuristic quality signal based on content length
 */

import { db } from '@/lib/db';
import { SOURCE_RELIABILITY, FRESHNESS_CONFIG, SourceType } from './types';

// ─── Public Interface ──────────────────────────────────────────

export interface ConfidenceResult {
  /** Final composite score in [0, 1] */
  composite: number;
  /** Static reliability of the source type, in [0, 1] */
  sourceQuality: number;
  /** Freshness details including the sub-score */
  freshness: { score: number; daysElapsed: number; maxDays: number };
  /** Heuristic content quality score in [0, 1] */
  contentValidation: number;
  /** Flat breakdown used for persistence (JSON serialisable) */
  breakdown: {
    sourceQuality: number;
    freshness: number;
    contentValidation: number;
  };
}

// ─── Helpers ───────────────────────────────────────────────────

/** Describe a numeric score in human-readable terms */
function qualifyLevel(score: number): string {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'moderate';
  return 'low';
}

/** Describe content length contribution in human-readable terms */
function describeContentValidation(score: number): string {
  if (score >= 0.9) return 'substantial content length';
  if (score >= 0.7) return 'moderate content length';
  if (score >= 0.5) return 'brief content length';
  return 'very short content length';
}

// ─── 1. Freshness Calculation ──────────────────────────────────

/**
 * Calculate a freshness score for a piece of intelligence based on how
 * long ago it was captured and the expected max lifetime of its source type.
 *
 * @param capturedAt - When the intelligence was captured (null = unknown age)
 * @param sourceType  - The type of source (e.g. 'csv', 'rss', 'website')
 * @returns An object with the freshness score, days elapsed, and max days
 */
export function calculateFreshness(
  capturedAt: Date | null,
  sourceType: string,
): { score: number; daysElapsed: number; maxDays: number } {
  // Unknown capture time → heavy penalty but not zero
  if (!capturedAt) {
    return { score: 0.3, daysElapsed: -1, maxDays: FRESHNESS_CONFIG[sourceType] ?? 90 };
  }

  const maxDays = FRESHNESS_CONFIG[sourceType] ?? 90;
  const now = Date.now();
  const capturedMs = new Date(capturedAt).getTime();
  const daysElapsed = Math.max(0, (now - capturedMs) / (1000 * 60 * 60 * 24));

  // Freshly captured
  if (daysElapsed <= 0) {
    return { score: 1.0, daysElapsed: 0, maxDays };
  }

  const score = Math.max(0, Math.min(1, 1 - daysElapsed / maxDays));

  return { score, daysElapsed: Math.round(daysElapsed * 10) / 10, maxDays };
}

// ─── 2. Composite Confidence Calculation ───────────────────────

/**
 * Calculate a full confidence result for an intelligence object.
 *
 * The composite score is a weighted average of three sub-scores:
 *   - sourceQuality    (35 %): from {@link SOURCE_RELIABILITY}
 *   - freshness         (35 %): from {@link calculateFreshness}
 *   - contentValidation (30 %): heuristic based on content length
 *
 * @param intelligenceObject - The object (or subset) to score
 * @returns A {@link ConfidenceResult} with all sub-scores and the breakdown
 */
export function calculateConfidence(
  intelligenceObject: {
    sourceType: string;
    capturedAt: Date | null;
    content: string;
    originalConfidence: number;
    metadata?: string;
  },
): ConfidenceResult {
  // 2a. Source quality
  const sourceQuality = SOURCE_RELIABILITY[intelligenceObject.sourceType as SourceType] ?? 0.5;

  // 2b. Freshness
  const freshness = calculateFreshness(
    intelligenceObject.capturedAt,
    intelligenceObject.sourceType,
  );

  // 2c. Content validation — length heuristic
  let contentValidation: number;
  const len = intelligenceObject.content?.length ?? 0;
  if (len > 500) {
    contentValidation = 0.9;
  } else if (len > 200) {
    contentValidation = 0.7;
  } else if (len > 50) {
    contentValidation = 0.5;
  } else {
    contentValidation = 0.3;
  }

  // Composite
  const composite =
    sourceQuality * 0.35 +
    freshness.score * 0.35 +
    contentValidation * 0.3;

  const clampedComposite = Math.max(0, Math.min(1, composite));

  return {
    composite: Math.round(clampedComposite * 1000) / 1000,
    sourceQuality,
    freshness,
    contentValidation,
    breakdown: {
      sourceQuality,
      freshness: freshness.score,
      contentValidation,
    },
  };
}

// ─── 3. Human-Readable Explanation ─────────────────────────────

/**
 * Generate a human-readable explanation of a confidence result.
 *
 * Example output:
 * > "Confidence: 72%. Source quality (85%) from CSV upload. Freshness (60%) -
 * > captured 45 days ago, decaying towards 90-day max. Content validation (70%) -
 * > moderate content length."
 *
 * @param result - A {@link ConfidenceResult} to explain
 * @returns A natural-language explanation string
 */
export function generateConfidenceExplanation(result: ConfidenceResult): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const level = qualifyLevel(result.composite);

  const parts: string[] = [
    `Confidence: ${pct(result.composite)} (${level}).`,
  ];

  // Source quality
  parts.push(
    `Source quality (${pct(result.sourceQuality)}) is ${qualifyLevel(result.sourceQuality)}.`,
  );

  // Freshness
  if (result.freshness.daysElapsed < 0) {
    parts.push(
      `Freshness (${pct(result.freshness.score)}) — unknown capture time, applying penalty.`,
    );
  } else {
    parts.push(
      `Freshness (${pct(result.freshness.score)}) — captured ${result.freshness.daysElapsed} days ago, ` +
        `decaying towards ${result.freshness.maxDays}-day maximum.`,
    );
  }

  // Content validation
  parts.push(
    `Content validation (${pct(result.contentValidation)}) — ${describeContentValidation(result.contentValidation)}.`,
  );

  return parts.join(' ');
}

// ─── 4. Recalculate Single Object ──────────────────────────────

/**
 * Recalculate the confidence for a single IntelligenceObject, persist the
 * updated score and breakdown, and return everything the caller needs.
 *
 * @param objectId - Prisma ID of the IntelligenceObject
 * @returns The updated object, the computed result, and an explanation
 * @throws {Error} If the object does not exist
 */
export async function recalculateObjectConfidence(objectId: string): Promise<{
  intelligenceObject: any;
  result: ConfidenceResult;
  explanation: string;
}> {
  const obj = await db.intelligenceObject.findUnique({ where: { id: objectId } });

  if (!obj) {
    throw new Error(`IntelligenceObject with id "${objectId}" not found`);
  }

  const result = calculateConfidence({
    sourceType: obj.sourceType,
    capturedAt: obj.capturedAt,
    content: obj.content,
    originalConfidence: obj.originalConfidence,
    metadata: obj.metadata,
  });

  const explanation = generateConfidenceExplanation(result);

  const updated = await db.intelligenceObject.update({
    where: { id: objectId },
    data: {
      originalConfidence: result.composite,
      confidenceBreakdown: JSON.stringify(result.breakdown),
    },
  });

  return { intelligenceObject: updated, result, explanation };
}

// ─── 5. Recalculate All Objects for a Company ──────────────────

/**
 * Recalculate confidence scores for every non-archived, non-rejected
 * IntelligenceObject belonging to a company, persist the results in a
 * single batch, and return a summary of changes.
 *
 * @param companyId - Prisma ID of the Company
 * @returns A summary with the count of updated objects and per-object deltas
 */
export async function recalculateCompanyConfidence(companyId: string): Promise<{
  updated: number;
  results: Array<{ objectId: string; oldConfidence: number; newConfidence: number }>;
}> {
  const objects = await db.intelligenceObject.findMany({
    where: {
      companyId,
      status: { notIn: ['archived', 'rejected'] },
    },
    select: {
      id: true,
      sourceType: true,
      capturedAt: true,
      content: true,
      originalConfidence: true,
      metadata: true,
    },
  });

  if (objects.length === 0) {
    return { updated: 0, results: [] };
  }

  const results: Array<{
    objectId: string;
    oldConfidence: number;
    newConfidence: number;
  }> = [];

  // Build Prisma update payloads
  const updatePayloads = objects.map((obj) => {
    const result = calculateConfidence({
      sourceType: obj.sourceType,
      capturedAt: obj.capturedAt,
      content: obj.content,
      originalConfidence: obj.originalConfidence,
      metadata: obj.metadata,
    });

    results.push({
      objectId: obj.id,
      oldConfidence: obj.originalConfidence,
      newConfidence: result.composite,
    });

    return db.intelligenceObject.update({
      where: { id: obj.id },
      data: {
        originalConfidence: result.composite,
        confidenceBreakdown: JSON.stringify(result.breakdown),
      },
    });
  });

  await Promise.all(updatePayloads);

  return { updated: results.length, results };
}