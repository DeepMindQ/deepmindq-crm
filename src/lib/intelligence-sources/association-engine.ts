/**
 * Association Engine — Entity Linking, Deduplication & Conflict Detection
 *
 * Manages relationships between IntelligenceObject records within a company.
 * Handles duplicate detection via Jaccard similarity, conflict detection via
 * sentiment/negation heuristics, and provides merge/resolution workflows.
 *
 * Sprint 2 — DeepMindQ Intelligence Layer
 */

import { db } from '@/lib/db';

// ─── Interfaces ──────────────────────────────────────────────────

export interface DuplicateGroup {
  objectId: string;
  content: string;
  sourceType: string;
  matches: Array<{
    objectId: string;
    content: string;
    sourceType: string;
    similarity: number;
    sharedFields: string[];
  }>;
}

export interface ConflictResult {
  objectId1: string;
  objectId2: string;
  category: string;
  conflictType: 'contradiction' | 'confidence_divergence' | 'temporal';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CreateAssociationInput {
  sourceId: string;
  targetId: string;
  associationType:
    | 'duplicate'
    | 'contradicts'
    | 'supports'
    | 'extends'
    | 'mentions_same_entity';
  confidence?: number;
  metadata?: Record<string, unknown>;
}

const VALID_ASSOCIATION_TYPES = [
  'duplicate',
  'contradicts',
  'supports',
  'extends',
  'mentions_same_entity',
] as const;

const NEGATION_KEYWORDS = [
  'not',
  'no longer',
  'ceased',
  'discontinued',
  'ended',
  'stopped',
  'terminated',
  'cancelled',
  'abandoned',
  'shut down',
  'closed',
  'dropped',
  'exited',
  'sold off',
  'divested',
];

const SIMILARITY_THRESHOLD = 0.6;

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two text strings based on word sets.
 * Only considers words longer than 3 characters to filter out common stop words.
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/**
 * Extract words shared between two texts (words > 3 chars).
 */
function sharedWords(a: string, b: string): string[] {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return [...wordsA].filter(w => wordsB.has(w));
}

/**
 * Parse a JSON metadata string into a typed object.
 * Returns an empty object if the string is invalid or empty.
 */
function parseMetadata(metadataStr: string | null | undefined): Record<string, unknown> {
  if (!metadataStr) return {};
  try {
    return JSON.parse(metadataStr) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Determine if a text contains negation/sentiment-reversing language.
 */
function containsNegation(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATION_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Classify the overall sentiment of a text based on simple keyword presence.
 * Returns 'negative' if negation keywords are found, 'neutral' otherwise.
 */
function classifySentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();

  const negativeHits = NEGATION_KEYWORDS.filter(kw => lower.includes(kw));
  if (negativeHits.length > 0) return 'negative';

  const positiveKeywords = [
    'acquired', 'launched', 'expanded', 'grew', 'growth', 'partnered',
    'announced', 'released', 'invested', 'hired', 'opened', 'won',
    'achieved', 'increased', 'strengthened', 'awarded', 'selected',
  ];
  const positiveHits = positiveKeywords.filter(kw => lower.includes(kw));
  if (positiveHits.length > 0) return 'positive';

  return 'neutral';
}

// ─── Exported Functions ──────────────────────────────────────────

/**
 * Detect duplicate intelligence objects for a given company.
 *
 * Compares all active/new objects using Jaccard similarity (threshold 0.6)
 * and same-source-URL checks. Does NOT auto-create associations — returns
 * detection results for human review.
 *
 * @param companyId - The company whose intelligence objects should be scanned
 * @returns Array of DuplicateGroup, each containing the base object and its matches
 * @throws Error if companyId is empty
 */
export async function detectDuplicates(companyId: string): Promise<DuplicateGroup[]> {
  if (!companyId) {
    throw new Error('companyId is required for duplicate detection');
  }

  const objects = await db.intelligenceObject.findMany({
    where: {
      companyId,
      status: { in: ['new', 'active'] },
    },
    select: {
      id: true,
      content: true,
      sourceType: true,
      metadata: true,
    },
  });

  if (objects.length < 2) {
    return [];
  }

  // Build a lookup of sourceUrl → object ids for same-URL detection
  const urlMap = new Map<string, string[]>();
  for (const obj of objects) {
    const meta = parseMetadata(obj.metadata);
    const url = (meta.sourceUrl as string) || '';
    if (url) {
      const existing = urlMap.get(url) || [];
      existing.push(obj.id);
      urlMap.set(url, existing);
    }
  }

  const results: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < objects.length; i++) {
    const a = objects[i];
    if (processed.has(a.id)) continue;

    const group: DuplicateGroup = {
      objectId: a.id,
      content: a.content,
      sourceType: a.sourceType,
      matches: [],
    };

    for (let j = i + 1; j < objects.length; j++) {
      const b = objects[j];
      if (processed.has(b.id)) continue;

      let isDuplicate = false;
      let similarity = 0;
      let shared: string[] = [];

      // Check 1: Jaccard similarity on content
      similarity = jaccardSimilarity(a.content, b.content);
      if (similarity >= SIMILARITY_THRESHOLD) {
        shared = sharedWords(a.content, b.content);
        isDuplicate = true;
      }

      // Check 2: Same sourceUrl with different record ids
      if (!isDuplicate) {
        const metaA = parseMetadata(a.metadata);
        const metaB = parseMetadata(b.metadata);
        const urlA = (metaA.sourceUrl as string) || '';
        const urlB = (metaB.sourceUrl as string) || '';
        if (urlA && urlA === urlB) {
          isDuplicate = true;
          similarity = Math.max(similarity, 1.0);
          shared = sharedWords(a.content, b.content);
        }
      }

      if (isDuplicate) {
        group.matches.push({
          objectId: b.id,
          content: b.content,
          sourceType: b.sourceType,
          similarity: Math.round(similarity * 1000) / 1000,
          sharedFields: shared,
        });
        processed.add(b.id);
      }
    }

    if (group.matches.length > 0) {
      results.push(group);
    }
  }

  return results;
}

/**
 * Create an association link between two intelligence objects.
 *
 * Validates that both objects exist, belong to the same company, and
 * that the association type is valid.
 *
 * @param input - The association creation payload
 * @returns The created IntelligenceAssociation record
 * @throws Error if sourceId === targetId, objects not found, mismatched companies, or invalid type
 */
export async function createAssociation(
  input: CreateAssociationInput
): Promise<import('@prisma/client').IntelligenceAssociation> {
  const { sourceId, targetId, associationType, confidence, metadata } = input;

  if (sourceId === targetId) {
    throw new Error('sourceId and targetId must be different objects');
  }

  if (!VALID_ASSOCIATION_TYPES.includes(associationType)) {
    throw new Error(
      `Invalid associationType "${associationType}". Must be one of: ${VALID_ASSOCIATION_TYPES.join(', ')}`
    );
  }

  const [sourceObj, targetObj] = await Promise.all([
    db.intelligenceObject.findUnique({ where: { id: sourceId } }),
    db.intelligenceObject.findUnique({ where: { id: targetId } }),
  ]);

  if (!sourceObj) {
    throw new Error(`Source intelligence object not found: ${sourceId}`);
  }
  if (!targetObj) {
    throw new Error(`Target intelligence object not found: ${targetId}`);
  }
  if (sourceObj.companyId !== targetObj.companyId) {
    throw new Error(
      `Source and target objects belong to different companies: ${sourceObj.companyId} vs ${targetObj.companyId}`
    );
  }

  const association = await db.intelligenceAssociation.create({
    data: {
      companyId: sourceObj.companyId,
      sourceId,
      targetId,
      associationType,
      confidence: confidence ?? 0.5,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
    },
  });

  return association;
}

/**
 * Detect conflicts between intelligence objects for a given company.
 *
 * Uses simple heuristics to identify:
 * - **Contradiction**: Objects in the same category from different sources with
 *   opposite sentiment (one contains negation keywords, the other is positive).
 * - **Confidence divergence**: Objects in the same category where confidence
 *   differs by more than 0.3.
 * - **Temporal**: Objects in the same category captured more than 90 days apart
 *   with differing content.
 *
 * @param companyId - The company whose intelligence objects should be scanned
 * @returns Array of ConflictResult descriptors
 * @throws Error if companyId is empty
 */
export async function detectConflicts(companyId: string): Promise<ConflictResult[]> {
  if (!companyId) {
    throw new Error('companyId is required for conflict detection');
  }

  const objects = await db.intelligenceObject.findMany({
    where: {
      companyId,
      status: { in: ['new', 'active', 'stale'] },
    },
    select: {
      id: true,
      content: true,
      metadata: true,
      capturedAt: true,
      originalConfidence: true,
      sourceType: true,
      sourceName: true,
    },
  });

  if (objects.length < 2) {
    return [];
  }

  // Group objects by category extracted from metadata
  const byCategory = new Map<string, typeof objects>();
  for (const obj of objects) {
    const meta = parseMetadata(obj.metadata);
    const category = (meta.category as string) || 'Uncategorized';
    const existing = byCategory.get(category) || [];
    existing.push(obj);
    byCategory.set(category, existing);
  }

  const conflicts: ConflictResult[] = [];
  const seen = new Set<string>();

  const pairKey = (id1: string, id2: string) =>
    id1 < id2 ? `${id1}::${id2}` : `${id2}::${id1}`;

  for (const [category, categoryObjects] of byCategory) {
    for (let i = 0; i < categoryObjects.length; i++) {
      for (let j = i + 1; j < categoryObjects.length; j++) {
        const a = categoryObjects[i];
        const b = categoryObjects[j];
        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;

        // Only compare objects from different sources
        if (a.sourceType === b.sourceType && a.sourceName === b.sourceName) {
          continue;
        }

        const sentimentA = classifySentiment(a.content);
        const sentimentB = classifySentiment(b.content);

        // Contradiction check: opposite sentiment (one negative, one positive)
        if (
          (sentimentA === 'negative' && sentimentB === 'positive') ||
          (sentimentA === 'positive' && sentimentB === 'negative')
        ) {
          seen.add(key);
          const negObj = sentimentA === 'negative' ? a : b;
          const posObj = sentimentA === 'negative' ? b : a;
          const negKeyword = NEGATION_KEYWORDS.find(kw =>
            negObj.content.toLowerCase().includes(kw)
          );

          conflicts.push({
            objectId1: a.id,
            objectId2: b.id,
            category,
            conflictType: 'contradiction',
            description:
              `Contradicting signals in "${category}": ${posObj.sourceName} reports positive ` +
              `activity while ${negObj.sourceName} indicates "${negKeyword || 'negative change'}".`,
            severity: 'high',
          });
          continue; // Skip further checks for this pair
        }

        // Confidence divergence check: > 0.3 difference
        const confA = a.originalConfidence ?? 0.5;
        const confB = b.originalConfidence ?? 0.5;
        if (Math.abs(confA - confB) > 0.3) {
          seen.add(key);
          const higher = confA > confB ? a : b;
          const lower = confA > confB ? b : a;

          conflicts.push({
            objectId1: a.id,
            objectId2: b.id,
            category,
            conflictType: 'confidence_divergence',
            description:
              `Significant confidence gap (${Math.round(confA * 100)}% vs ${Math.round(confB * 100)}%) ` +
              `in "${category}" between ${a.sourceName} and ${b.sourceName}.`,
            severity: 'medium',
          });
          continue;
        }

        // Temporal check: same category, > 90 days apart, different content
        const capturedA = a.capturedAt ? new Date(a.capturedAt).getTime() : Date.now();
        const capturedB = b.capturedAt ? new Date(b.capturedAt).getTime() : Date.now();
        const dayDiff = Math.abs(capturedA - capturedB) / (1000 * 60 * 60 * 24);

        if (dayDiff > 90 && jaccardSimilarity(a.content, b.content) < 0.2) {
          seen.add(key);
          const older = capturedA < capturedB ? a : b;
          const newer = capturedA < capturedB ? b : a;
          const days = Math.round(dayDiff);

          conflicts.push({
            objectId1: a.id,
            objectId2: b.id,
            category,
            conflictType: 'temporal',
            description:
              `Temporal drift in "${category}": intelligence from ${older.sourceName} ` +
              `(${Math.round(days)} days older) has substantially different content than ` +
              `${newer.sourceName}. The older record may be stale.`,
            severity: 'low',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Merge two duplicate intelligence objects into one.
 *
 * If `keepTarget` is true, the target object is retained and the source is
 * superseded. Otherwise, the source is retained and the target is superseded.
 * The kept object's metadata is updated with merge information, and
 * 'duplicate' + 'superseded' associations are created.
 *
 * @param sourceId - First intelligence object id
 * @param targetId - Second intelligence object id
 * @param keepTarget - When true, keep target and supersede source; when false, reverse
 * @returns Both the merged (kept) and superseded (discarded) objects
 * @throws Error if objects not found, already superseded, or belong to different companies
 */
export async function mergeDuplicates(
  sourceId: string,
  targetId: string,
  keepTarget: boolean
): Promise<{
  merged: import('@prisma/client').IntelligenceObject;
  superseded: import('@prisma/client').IntelligenceObject;
}> {
  if (sourceId === targetId) {
    throw new Error('Cannot merge an object with itself');
  }

  const [sourceObj, targetObj] = await Promise.all([
    db.intelligenceObject.findUnique({ where: { id: sourceId } }),
    db.intelligenceObject.findUnique({ where: { id: targetId } }),
  ]);

  if (!sourceObj) {
    throw new Error(`Source intelligence object not found: ${sourceId}`);
  }
  if (!targetObj) {
    throw new Error(`Target intelligence object not found: ${targetId}`);
  }
  if (sourceObj.companyId !== targetObj.companyId) {
    throw new Error(
      `Cannot merge objects from different companies: ${sourceObj.companyId} vs ${targetObj.companyId}`
    );
  }

  const keptObj = keepTarget ? targetObj : sourceObj;
  const discardedObj = keepTarget ? sourceObj : targetObj;

  if (discardedObj.status === 'superseded') {
    throw new Error(
      `Cannot merge: the object to be discarded (${discardedObj.id}) is already superseded`
    );
  }

  // Update the kept object's metadata with merge info
  const keptMeta = parseMetadata(keptObj.metadata);
  keptMeta.mergedFrom = discardedObj.id;
  keptMeta.mergedAt = new Date().toISOString();
  keptMeta.mergedContent = discardedObj.content;
  keptMeta.mergedSourceType = discardedObj.sourceType;
  keptMeta.mergedCapturedAt = discardedObj.capturedAt?.toISOString();

  // Update the discarded object's metadata
  const discardedMeta = parseMetadata(discardedObj.metadata);
  discardedMeta.mergedInto = keptObj.id;
  discardedMeta.mergedAt = new Date().toISOString();

  const [merged, superseded] = await db.$transaction([
    // Update the kept object with enriched metadata
    db.intelligenceObject.update({
      where: { id: keptObj.id },
      data: {
        metadata: JSON.stringify(keptMeta),
      },
    }),
    // Supersede the discarded object
    db.intelligenceObject.update({
      where: { id: discardedObj.id },
      data: {
        status: 'superseded',
        metadata: JSON.stringify(discardedMeta),
      },
    }),
    // Create 'duplicate' association
    db.intelligenceAssociation.create({
      data: {
        companyId: keptObj.companyId,
        sourceId: sourceObj.id,
        targetId: targetObj.id,
        associationType: 'duplicate',
        confidence: 1.0,
        metadata: JSON.stringify({ mergeAction: keepTarget ? 'keep_target' : 'keep_source' }),
        resolved: true,
        resolvedAt: new Date(),
        resolvedAction: 'merged',
      },
    }),
    // Create 'superseded' association
    db.intelligenceAssociation.create({
      data: {
        companyId: keptObj.companyId,
        sourceId: discardedObj.id,
        targetId: keptObj.id,
        associationType: 'duplicate',
        confidence: 1.0,
        metadata: JSON.stringify({ superseded: true, supersededById: keptObj.id }),
        resolved: true,
        resolvedAt: new Date(),
        resolvedAction: 'superseded',
      },
    }),
  ]);

  return { merged, superseded };
}

/**
 * Resolve an existing association by marking it with a resolution action.
 *
 * Once resolved, the association is flagged and timestamped. This is an
 * idempotent operation — resolving an already-resolved association updates
 * its action and timestamp.
 *
 * @param associationId - The id of the IntelligenceAssociation to resolve
 * @param action - The resolution action taken
 * @returns The updated IntelligenceAssociation record
 * @throws Error if the association is not found
 */
export async function resolveAssociation(
  associationId: string,
  action: 'merged' | 'dismissed' | 'superseded' | 'manual'
): Promise<import('@prisma/client').IntelligenceAssociation> {
  if (!associationId) {
    throw new Error('associationId is required');
  }

  const existing = await db.intelligenceAssociation.findUnique({
    where: { id: associationId },
  });

  if (!existing) {
    throw new Error(`Association not found: ${associationId}`);
  }

  const resolved = await db.intelligenceAssociation.update({
    where: { id: associationId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedAction: action,
    },
    include: {
      source: { select: { id: true, content: true, sourceType: true } },
      target: { select: { id: true, content: true, sourceType: true } },
    },
  });

  return resolved;
}

/**
 * Retrieve associations for a company with optional filtering.
 *
 * Supports filtering by association type and unresolved-only status.
 * Results include the source and target intelligence object summaries.
 *
 * @param companyId - The company whose associations to retrieve
 * @param filters - Optional filters: type to match a specific association type,
 *   unresolvedOnly to exclude already-resolved associations
 * @returns Array of IntelligenceAssociation records with source/target info
 * @throws Error if companyId is empty
 */
export async function getAssociations(
  companyId: string,
  filters?: { type?: string; unresolvedOnly?: boolean }
): Promise<import('@prisma/client').IntelligenceAssociation[]> {
  if (!companyId) {
    throw new Error('companyId is required for fetching associations');
  }

  const where: Record<string, unknown> = { companyId };

  if (filters?.type) {
    where.associationType = filters.type;
  }

  if (filters?.unresolvedOnly) {
    where.resolved = false;
  }

  const associations = await db.intelligenceAssociation.findMany({
    where,
    include: {
      source: {
        select: {
          id: true,
          content: true,
          summary: true,
          sourceType: true,
          sourceName: true,
          status: true,
          capturedAt: true,
          originalConfidence: true,
        },
      },
      target: {
        select: {
          id: true,
          content: true,
          summary: true,
          sourceType: true,
          sourceName: true,
          status: true,
          capturedAt: true,
          originalConfidence: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return associations;
}