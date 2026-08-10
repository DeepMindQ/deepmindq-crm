/**
 * P3.3 — AI Output Versioning
 *
 * Every AI generation gets a versioned snapshot. Allows comparison:
 * "What did the intelligence say about Company X last month vs today?"
 *
 * Pattern:
 *   1. After governedAICall() succeeds, save a snapshot
 *   2. Version is auto-incremented per entity+generationType
 *   3. Previous version linked for diff capability
 *   4. Query API for version history and comparison
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIGenerationSnapshotData {
  entityType: string;
  entityId?: string;
  generationType: string;
  input: Record<string, unknown>;
  output: string; // truncated to 10000 chars to prevent DB bloat
  confidence: number;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  governanceChecks?: Record<string, unknown>;
  hallucinationRisk?: number;
}

export interface AIVersionHistoryEntry {
  id: string;
  version: number;
  confidence: number;
  model: string | null;
  createdAt: Date;
  outputPreview: string;
}

export interface AIVersionComparison {
  v1: { version: number; confidence: number; createdAt: Date; outputPreview: string };
  v2: { version: number; confidence: number; createdAt: Date; outputPreview: string };
  confidenceDelta: number;
  daysBetween: number;
  outputSimilarity: number; // simple Jaccard on word sets
}

// ── Constants ────────────────────────────────────────────────────────────────

const OUTPUT_MAX_LENGTH = 10000;
const DEFAULT_HISTORY_LIMIT = 20;

// ── Save Snapshot ────────────────────────────────────────────────────────────

/**
 * Save a versioned AI output snapshot.
 * Version is auto-incremented per entity+generationType combination.
 * Previous version is linked via previousVersionId for chain traversal.
 *
 * Returns the snapshot ID on success, null on failure (non-fatal).
 */
export async function saveAISnapshot(data: AIGenerationSnapshotData): Promise<string | null> {
  try {
    // 1. Find the current latest version for this entity+type
    const latest = await db.aIGenerationSnapshot.findFirst({
      where: {
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        generationType: data.generationType,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    // 2. Create the new snapshot
    const snapshot = await db.aIGenerationSnapshot.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        generationType: data.generationType,
        version: nextVersion,
        input: JSON.parse(JSON.stringify(data.input)), // deep clone, sanitize
        output: data.output.substring(0, OUTPUT_MAX_LENGTH),
        confidence: data.confidence,
        model: data.model,
        promptTokens: data.promptTokens ?? 0,
        completionTokens: data.completionTokens ?? 0,
        costUsd: data.costUsd ?? 0,
        governanceChecks: data.governanceChecks ? JSON.parse(JSON.stringify(data.governanceChecks)) : {},
        hallucinationRisk: data.hallucinationRisk,
        previousVersionId: latest?.id ?? null,
      },
    });

    logger.info('[ai-versioning] Snapshot saved', {
      entityType: data.entityType,
      entityId: data.entityId,
      generationType: data.generationType,
      version: nextVersion,
      previousVersion: latest?.version ?? null,
    });

    return snapshot.id;
  } catch (err) {
    logger.error('[ai-versioning] Failed to save snapshot (non-fatal):', { error: err });
    return null;
  }
}

// ── Version History ──────────────────────────────────────────────────────────

/**
 * Get the version history for a given entity+generationType.
 * Returns entries ordered by version desc (newest first).
 */
export async function getAIVersionHistory(params: {
  entityType: string;
  entityId: string;
  generationType: string;
  limit?: number;
}): Promise<AIVersionHistoryEntry[]> {
  const limit = params.limit ?? DEFAULT_HISTORY_LIMIT;

  const snapshots = await db.aIGenerationSnapshot.findMany({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
      generationType: params.generationType,
    },
    orderBy: { version: 'desc' },
    take: limit,
    select: {
      id: true,
      version: true,
      confidence: true,
      model: true,
      createdAt: true,
      output: true,
    },
  });

  return snapshots.map(s => {
    const rawOutput = typeof s.output === 'string' ? s.output : JSON.stringify(s.output);
    return {
      id: s.id,
      version: s.version,
      confidence: s.confidence,
      model: s.model,
      createdAt: s.createdAt,
      outputPreview: rawOutput.substring(0, 300),
    };
  });
}

// ── Version Comparison ───────────────────────────────────────────────────────

/**
 * Simple Jaccard similarity on word sets.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter(Boolean));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Compare two AI output versions.
 * Returns confidence delta, days between, and output similarity.
 * Returns null if either version is not found.
 */
export async function compareAIVersions(versionId1: string, versionId2: string): Promise<AIVersionComparison | null> {
  const [snap1, snap2] = await Promise.all([
    db.aIGenerationSnapshot.findUnique({ where: { id: versionId1 } }),
    db.aIGenerationSnapshot.findUnique({ where: { id: versionId2 } }),
  ]);

  if (!snap1 || !snap2) return null;

  const rawOutput1 = typeof snap1.output === 'string' ? snap1.output : JSON.stringify(snap1.output);
  const rawOutput2 = typeof snap2.output === 'string' ? snap2.output : JSON.stringify(snap2.output);

  const daysMs = Math.abs(snap2.createdAt.getTime() - snap1.createdAt.getTime());
  const daysBetween = Math.round(daysMs / (1000 * 60 * 60 * 24) * 100) / 100;

  return {
    v1: {
      version: snap1.version,
      confidence: snap1.confidence,
      createdAt: snap1.createdAt,
      outputPreview: rawOutput1.substring(0, 500),
    },
    v2: {
      version: snap2.version,
      confidence: snap2.confidence,
      createdAt: snap2.createdAt,
      outputPreview: rawOutput2.substring(0, 500),
    },
    confidenceDelta: Math.round((snap2.confidence - snap1.confidence) * 1000) / 1000,
    daysBetween,
    outputSimilarity: Math.round(jaccardSimilarity(rawOutput1, rawOutput2) * 1000) / 1000,
  };
}
