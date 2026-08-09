/**
 * Company Deduplication Engine — Production-Grade
 *
 * Scans the entire Company table for duplicate candidates,
 * groups them into clusters, and generates merge recommendations.
 * Supports single merge, bulk merge, and skip actions.
 *
 * Key design principles:
 * - Idempotent: running twice produces no new merges
 * - Audit trail: every merge/skip recorded in MergeRecord
 * - Uses deduplicator.ts matching logic (no duplication)
 * - Graceful error handling with structured logging
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { audit } from '@/lib/audit-logger';
import { invalidateDedupCache } from './deduplicator';
import { normalizeForMatch, levenshtein, companySimilarity } from './dedup-matching-utils';

// ── Types ───────────────────────────────────────────────────────────────

export type MergeStrategy = 'keep_survivor' | 'keep_duplicate' | 'keep_most_recent';

export interface DuplicateEdge {
  companyIdA: string;
  companyIdB: string;
  confidence: number;
  matchType: 'domain' | 'name' | 'domain_name';
}

export interface DuplicateCluster {
  id: string;
  companies: ClusteredCompany[];
  recommendedSurvivorId: string;
  highestConfidence: number;
  survivalReason: string;
}

export interface ClusteredCompany {
  id: string;
  rawName: string;
  normalizedName: string;
  domain: string | null;
  industry: string | null;
  createdAt: Date;
  contactCount: number;
  signalCount: number;
  noteCount: number;
  intelligenceScore: number;
  status: string;
}

export interface MergeRequest {
  survivorId: string;
  duplicateId: string;
  strategy: MergeStrategy;
}

export interface MergeResult {
  success: boolean;
  mergeRecordId?: string;
  survivorId: string;
  duplicateId: string;
  error?: string;
  fieldsKept?: Record<string, string>;
}

export interface BulkMergeResult {
  totalRequested: number;
  succeeded: number;
  failed: number;
  results: MergeResult[];
}

export interface ScanResult {
  scanId: string;
  totalCompaniesScanned: number;
  clustersFound: number;
  clusters: DuplicateCluster[];
  scannedAt: string;
  durationMs: number;
}

export interface MergeHistoryEntry {
  id: string;
  survivorId: string;
  duplicateId: string;
  entityType: string;
  mergedBy: string | null;
  mergedAt: string;
  mergeReason: string;
  fieldsKept: Record<string, string> | null;
  survivorName?: string;
  duplicateName?: string;
}

// ── Union-Find for clustering ────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const node of this.parent.keys()) {
      const root = this.find(node);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(node);
    }
    return clusters;
  }
}

// ── Name Normalization (mirrors deduplicator.ts logic) ──────────────────

// Matching functions are now imported from dedup-matching-utils.ts
// to eliminate code duplication with deduplicator.ts.

// ── Full Company Scan ───────────────────────────────────────────────────

/**
 * Fetch all companies with their relation counts for dedup scanning.
 * Uses cursor-based pagination to avoid memory pressure on large datasets.
 */
async function fetchAllCompanies(): Promise<ClusteredCompany[]> {
  const BATCH_SIZE = 1000;
  const allCompanies: ClusteredCompany[] = [];
  let cursor: string | undefined = undefined;

  if (process.env.NODE_ENV === 'production') {
    logger.info('[dedup-engine] Starting cursor-based company scan for dedup');
  }

  while (true) {
    const companies: Array<{
      id: string;
      rawName: string;
      normalizedName: string;
      domain: string | null;
      industry: string | null;
      createdAt: Date;
      intelligenceScore: number;
      status: string;
      _count: { contacts: number; signals: number; notes: number };
    }> = await db.company.findMany({
      where: cursor ? { id: { gt: cursor } } : undefined,
      select: {
        id: true,
        rawName: true,
        normalizedName: true,
        domain: true,
        industry: true,
        createdAt: true,
        intelligenceScore: true,
        status: true,
        _count: {
          select: {
            contacts: true,
            signals: true,
            notes: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (companies.length === 0) break;

    for (const c of companies) {
      allCompanies.push({
        id: c.id,
        rawName: c.rawName,
        normalizedName: c.normalizedName,
        domain: c.domain,
        industry: c.industry,
        createdAt: c.createdAt,
        contactCount: c._count.contacts,
        signalCount: c._count.signals,
        noteCount: c._count.notes,
        intelligenceScore: c.intelligenceScore,
        status: c.status,
      });
    }

    cursor = companies[companies.length - 1].id;

    if (companies.length < BATCH_SIZE) break;
  }

  if (process.env.NODE_ENV === 'production') {
    logger.info('[dedup-engine] Cursor-based scan complete', { totalCompanies: allCompanies.length });
  }

  return allCompanies;
}

// ── Edge Detection ──────────────────────────────────────────────────────

/**
 * Find all duplicate edges between companies using matching strategies:
 * 1. Domain match (same domain = strong signal)
 * 2. Normalized name exact match
 * 3. Fuzzy name similarity >= 75
 */
function findDuplicateEdges(companies: ClusteredCompany[]): DuplicateEdge[] {
  const edges: DuplicateEdge[] = [];
  const seenPairs = new Set<string>();

  const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  // Strategy 1: Group by domain
  const byDomain = new Map<string, ClusteredCompany[]>();
  for (const c of companies) {
    const domain = (c.domain || '').toLowerCase().trim();
    if (!domain) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(c);
  }

  for (const [, group] of byDomain) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const key = pairKey(a.id, b.id);
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);

        // Same domain: check if names are also similar
        const nameSim = companySimilarity(a.rawName, b.rawName);
        if (nameSim >= 40) {
          edges.push({
            companyIdA: a.id,
            companyIdB: b.id,
            confidence: Math.min(95, nameSim + 15),
            matchType: 'domain_name',
          });
        } else {
          // Same domain alone is a moderate signal
          edges.push({
            companyIdA: a.id,
            companyIdB: b.id,
            confidence: 60,
            matchType: 'domain',
          });
        }
      }
    }
  }

  // Strategy 2: Normalized name exact match
  const byNormalizedName = new Map<string, ClusteredCompany[]>();
  for (const c of companies) {
    const norm = c.normalizedName.toLowerCase().trim();
    if (!norm) continue;
    if (!byNormalizedName.has(norm)) byNormalizedName.set(norm, []);
    byNormalizedName.get(norm)!.push(c);
  }

  for (const [, group] of byNormalizedName) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i].id, group[j].id);
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        edges.push({
          companyIdA: group[i].id,
          companyIdB: group[j].id,
          confidence: 90,
          matchType: 'name',
        });
      }
    }
  }

  // Strategy 3: Fuzzy name similarity >= 75
  // Only for companies that haven't been linked yet
  const alreadyLinked = new Set(seenPairs);
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i];
      const b = companies[j];
      const key = pairKey(a.id, b.id);
      if (alreadyLinked.has(key)) continue;

      const sim = companySimilarity(a.rawName, b.rawName);
      if (sim >= 75) {
        alreadyLinked.add(key);
        edges.push({
          companyIdA: a.id,
          companyIdB: b.id,
          confidence: sim,
          matchType: 'name',
        });
      }
    }
  }

  return edges;
}

// ── Cluster Building ────────────────────────────────────────────────────

/**
 * Build clusters from edges using union-find.
 * Filters out clusters with only 1 company.
 */
function buildClusters(
  edges: DuplicateEdge[],
  companiesMap: Map<string, ClusteredCompany>,
  alreadyMergedIds: Set<string>,
): DuplicateCluster[] {
  const uf = new UnionFind();

  // Only include edges where confidence >= 55 and neither company was already merged as a duplicate
  for (const edge of edges) {
    if (edge.confidence < 55) continue;
    if (alreadyMergedIds.has(edge.companyIdA) || alreadyMergedIds.has(edge.companyIdB)) continue;
    uf.union(edge.companyIdA, edge.companyIdB);
  }

  const rawClusters = uf.getClusters();
  const clusters: DuplicateCluster[] = [];
  let clusterIdx = 0;

  for (const [, memberIds] of rawClusters) {
    if (memberIds.length < 2) continue;

    const members = memberIds
      .map(id => companiesMap.get(id))
      .filter((c): c is ClusteredCompany => c !== undefined);

    if (members.length < 2) continue;

    // Determine recommended survivor
    const { survivorId, reason } = pickSurvivor(members);

    // Find highest confidence edge within this cluster
    let highestConfidence = 0;
    for (const edge of edges) {
      if (memberIds.includes(edge.companyIdA) && memberIds.includes(edge.companyIdB)) {
        highestConfidence = Math.max(highestConfidence, edge.confidence);
      }
    }

    clusters.push({
      id: `cluster-${clusterIdx++}`,
      companies: members,
      recommendedSurvivorId: survivorId,
      highestConfidence,
      survivalReason: reason,
    });
  }

  return clusters;
}

// ── Survival Rules ──────────────────────────────────────────────────────

/**
 * Pick the best company to survive in a cluster.
 * Rules (in priority order):
 * 1. Most data (contacts + signals + notes)
 * 2. Most recent
 * 3. Highest intelligence score
 * 4. Longest name (likely most complete)
 */
function pickSurvivor(
  members: ClusteredCompany[],
): { survivorId: string; reason: string } {
  // Score each member
  const scored = members.map(m => ({
    company: m,
    dataScore: m.contactCount * 10 + m.signalCount * 5 + m.noteCount * 3,
    recencyScore: m.createdAt.getTime(),
    intelligenceScore: m.intelligenceScore,
    nameLength: m.rawName.length,
  }));

  // Sort by data score descending
  scored.sort((a, b) => b.dataScore - a.dataScore);
  const bestByData = scored[0];

  // Check if there's a tie — break by recency
  const topData = scored.filter(s => s.dataScore === bestByData.dataScore);
  if (topData.length === 1) {
    return {
      survivorId: bestByData.company.id,
      reason: `Most data (${bestByData.dataScore} points: ${bestByData.company.contactCount} contacts, ${bestByData.company.signalCount} signals, ${bestByData.company.noteCount} notes)`,
    };
  }

  // Break tie by recency
  topData.sort((a, b) => b.recencyScore - a.recencyScore);
  const bestByRecency = topData[0];

  return {
    survivorId: bestByRecency.company.id,
    reason: `Most data (${bestByData.dataScore} points) + most recent (created ${bestByRecency.company.createdAt.toISOString()})`,
  };
}

// ── Scan ────────────────────────────────────────────────────────────────

/**
 * Perform a full dedup scan across all companies.
 * Returns clusters of duplicate candidates.
 */
export async function scanForDuplicates(): Promise<ScanResult> {
  const startTime = Date.now();
  const scanId = `scan-${Date.now()}`;

  logger.info('[DedupEngine] Starting full company dedup scan', { scanId });

  try {
    // Fetch all companies
    const companies = await fetchAllCompanies();
    const companiesMap = new Map(companies.map(c => [c.id, c]));

    // Get IDs of companies already merged as duplicates (idempotency)
    // This query is bounded by the number of past merges, not company count
    const existingMerges = await db.mergeRecord.findMany({
      select: { duplicateId: true },
      where: { entityType: 'company' },
    });
    const alreadyMergedIds = new Set(existingMerges.map(m => m.duplicateId));

    // Find duplicate edges
    const edges = findDuplicateEdges(companies);

    // Build clusters
    const clusters = buildClusters(edges, companiesMap, alreadyMergedIds);

    const durationMs = Date.now() - startTime;

    logger.info('[DedupEngine] Scan completed', {
      scanId,
      totalCompanies: companies.length,
      edgesFound: edges.length,
      clustersFound: clusters.length,
      durationMs,
    });

    return {
      scanId,
      totalCompaniesScanned: companies.length,
      clustersFound: clusters.length,
      clusters,
      scannedAt: new Date().toISOString(),
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('[DedupEngine] Scan failed', { scanId, error, durationMs });
    throw error;
  }
}

// ── Single Merge ─────────────────────────────────────────────────────────

/**
 * Merge a duplicate company into a survivor.
 * Moves all related records (contacts, signals, notes, timeline events, etc.)
 * to the survivor and creates an audit trail.
 *
 * Idempotent: if this exact merge was already done, returns success without
 * re-executing.
 */
export async function mergeDuplicate(
  request: MergeRequest,
  mergedBy?: string,
  mergeReason: string = 'manual_merge',
): Promise<MergeResult> {
  const { survivorId, duplicateId, strategy } = request;

  // ── Idempotency check ──
  const existingMerge = await db.mergeRecord.findFirst({
    where: {
      OR: [
        { survivorId, duplicateId, entityType: 'company' },
        { survivorId: duplicateId, duplicateId: survivorId, entityType: 'company' },
      ],
    },
  });

  if (existingMerge) {
    logger.info('[DedupEngine] Merge already performed (idempotent)', {
      survivorId,
      duplicateId,
      existingMergeId: existingMerge.id,
    });
    return {
      success: true,
      mergeRecordId: existingMerge.id,
      survivorId,
      duplicateId,
    };
  }

  // ── Validate companies exist ──
  const [survivor, duplicate] = await Promise.all([
    db.company.findUnique({ where: { id: survivorId } }),
    db.company.findUnique({ where: { id: duplicateId } }),
  ]);

  if (!survivor) {
    return { success: false, survivorId, duplicateId, error: `Survivor company ${survivorId} not found` };
  }
  if (!duplicate) {
    return { success: false, survivorId, duplicateId, error: `Duplicate company ${duplicateId} not found` };
  }
  if (survivorId === duplicateId) {
    return { success: false, survivorId, duplicateId, error: 'Cannot merge a company into itself' };
  }

  logger.info('[DedupEngine] Merging companies', {
    survivorId: survivor.id,
    survivorName: survivor.rawName,
    duplicateId: duplicate.id,
    duplicateName: duplicate.rawName,
    strategy,
  });

  try {
    // Determine effective survivor and duplicate based on strategy
    let effectiveSurvivorId = survivorId;
    let effectiveDuplicateId = duplicateId;

    if (strategy === 'keep_duplicate') {
      effectiveSurvivorId = duplicateId;
      effectiveDuplicateId = survivorId;
    } else if (strategy === 'keep_most_recent') {
      if (duplicate.createdAt > survivor.createdAt) {
        effectiveSurvivorId = duplicateId;
        effectiveDuplicateId = survivorId;
      }
    }

    // Track which fields were kept from which source
    const fieldsKept: Record<string, string> = {};
    const effectiveSurvivor = effectiveSurvivorId === survivorId ? survivor : duplicate;
    const effectiveDuplicate = effectiveSurvivorId === survivorId ? duplicate : survivor;

    // Fields to potentially fill from duplicate when survivor has null/empty
    const mergeableFields: (keyof typeof effectiveSurvivor)[] = [
      'domain', 'industry', 'sizeRange', 'location', 'country',
      'website', 'internalSummary', 'assignedTo',
    ];

    const updateData: Record<string, unknown> = {};

    for (const field of mergeableFields) {
 const survivorVal = effectiveSurvivor[field];
      const dupVal = effectiveDuplicate[field];
      // Fill in missing fields from duplicate
      if ((survivorVal === null || survivorVal === undefined || survivorVal === '') &&
          dupVal !== null && dupVal !== undefined && dupVal !== '') {
        updateData[field] = dupVal;
        fieldsKept[field as string] = 'duplicate';
      } else {
        fieldsKept[field as string] = 'survivor';
      }
    }

    // Merge tags: union of both tag arrays
    const survivorTags: string[] = Array.isArray((effectiveSurvivor.tags as unknown as string[]))
      ? (effectiveSurvivor.tags as unknown as string[]) : [];
    const dupTags: string[] = Array.isArray((effectiveDuplicate.tags as unknown as string[]))
      ? (effectiveDuplicate.tags as unknown as string[]) : [];
    const mergedTags = [...new Set([...survivorTags, ...dupTags])];
    if (mergedTags.length > survivorTags.length) {
      updateData.tags = mergedTags as unknown as any[];
      fieldsKept.tags = 'merged_union';
    } else {
      fieldsKept.tags = 'survivor';
    }

    // Take the higher intelligence score
    if (effectiveDuplicate.intelligenceScore > effectiveSurvivor.intelligenceScore) {
      updateData.intelligenceScore = effectiveDuplicate.intelligenceScore;
      fieldsKept.intelligenceScore = 'duplicate';
    } else {
      fieldsKept.intelligenceScore = 'survivor';
    }

    // Move related records to survivor
    // Using $transaction for atomicity
    await db.$transaction(async (tx) => {
      // Move contacts
      const contactCount = await tx.contact.count({ where: { companyId: effectiveDuplicateId } });
      if (contactCount > 0) {
        await tx.contact.updateMany({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.contacts = `moved ${contactCount} contacts to survivor`;
      }

      // Move signals
      const signalCount = await tx.companySignal.count({ where: { companyId: effectiveDuplicateId } });
      if (signalCount > 0) {
        await tx.companySignal.updateMany({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.signals = `moved ${signalCount} signals to survivor`;
      }

      // Move notes
      const noteCount = await tx.companyNote.count({ where: { companyId: effectiveDuplicateId } });
      if (noteCount > 0) {
        await tx.companyNote.updateMany({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.notes = `moved ${noteCount} notes to survivor`;
      }

      // Move timeline events
      const timelineCount = await tx.companyTimelineEvent.count({ where: { companyId: effectiveDuplicateId } });
      if (timelineCount > 0) {
        await tx.companyTimelineEvent.updateMany({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.timelineEvents = `moved ${timelineCount} timeline events to survivor`;
      }

      // Move evidence
      const evidenceCount = await tx.evidence.count({ where: { companyId: effectiveDuplicateId } });
      if (evidenceCount > 0) {
        await tx.evidence.updateMany({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.evidence = `moved ${evidenceCount} evidence records to survivor`;
      }

      // Move research card (1:1 — survivor takes precedence)
      const dupResearchCard = await tx.companyResearchCard.findUnique({
        where: { companyId: effectiveDuplicateId },
      });
      const survivorResearchCard = await tx.companyResearchCard.findUnique({
        where: { companyId: effectiveSurvivorId },
      });
      if (dupResearchCard && !survivorResearchCard) {
        await tx.companyResearchCard.update({
          where: { companyId: effectiveDuplicateId },
          data: { companyId: effectiveSurvivorId },
        });
        fieldsKept.researchCard = 'moved from duplicate';
      } else {
        fieldsKept.researchCard = 'survivor';
      }

      // Update survivor with any filled-in fields
      if (Object.keys(updateData).length > 0) {
        await tx.company.update({
          where: { id: effectiveSurvivorId },
          data: updateData,
        });
      }

      // Delete the duplicate company
      await tx.company.delete({
        where: { id: effectiveDuplicateId },
      });

      // Create merge record
      const mergeRecord = await tx.mergeRecord.create({
        data: {
          survivorId: effectiveSurvivorId,
          duplicateId: effectiveDuplicateId,
          entityType: 'company',
          mergedBy,
          mergeReason,
          fieldsKept: fieldsKept as any,
        },
      });

      fieldsKept._mergeRecordId = mergeRecord.id;
    });

    // Invalidate dedup cache
    invalidateDedupCache();

    // Audit trail
    await audit({
      action: 'Company merge',
      category: 'data_delete',
      severity: 'warn',
      actor: mergedBy,
      details: {
        survivorId: effectiveSurvivorId,
        survivorName: effectiveSurvivor.rawName,
        duplicateId: effectiveDuplicateId,
        duplicateName: effectiveDuplicate.rawName,
        strategy,
        mergeReason,
        fieldsKept,
      },
    });

    logger.info('[DedupEngine] Merge completed', {
      survivorId: effectiveSurvivorId,
      duplicateId: effectiveDuplicateId,
      strategy,
    });

    return {
      success: true,
      mergeRecordId: fieldsKept._mergeRecordId,
      survivorId: effectiveSurvivorId,
      duplicateId: effectiveDuplicateId,
      fieldsKept,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[DedupEngine] Merge failed', {
      survivorId,
      duplicateId,
      strategy,
      error: errorMsg,
    });

    return {
      success: false,
      survivorId,
      duplicateId,
      error: errorMsg,
    };
  }
}

// ── Bulk Merge ──────────────────────────────────────────────────────────

/**
 * Merge multiple duplicate pairs at once.
 * Processes sequentially to avoid race conditions.
 */
export async function bulkMerge(
  merges: MergeRequest[],
  mergedBy?: string,
): Promise<BulkMergeResult> {
  const results: MergeResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const mergeReq of merges) {
    const result = await mergeDuplicate(mergeReq, mergedBy, 'bulk_merge');
    results.push(result);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  logger.info('[DedupEngine] Bulk merge completed', {
    totalRequested: merges.length,
    succeeded,
    failed,
  });

  return {
    totalRequested: merges.length,
    succeeded,
    failed,
    results,
  };
}

// ── Skip (Mark as not duplicate) ─────────────────────────────────────────

/**
 * Mark a pair as not-duplicate by creating a merge record with reason 'not_duplicate'.
 * This prevents the pair from appearing in future scans.
 */
export async function skipDuplicate(
  companyIdA: string,
  companyIdB: string,
  reason: string,
  skippedBy?: string,
): Promise<{ success: boolean; error?: string }> {
  // Idempotency check
  const existing = await db.mergeRecord.findFirst({
    where: {
      OR: [
        { survivorId: companyIdA, duplicateId: companyIdB, entityType: 'company', mergeReason: 'not_duplicate' },
        { survivorId: companyIdB, duplicateId: companyIdA, entityType: 'company', mergeReason: 'not_duplicate' },
      ],
    },
  });

  if (existing) {
    return { success: true };
  }

  // Validate companies exist
  const [a, b] = await Promise.all([
    db.company.findUnique({ where: { id: companyIdA } }),
    db.company.findUnique({ where: { id: companyIdB } }),
  ]);

  if (!a) return { success: false, error: `Company ${companyIdA} not found` };
  if (!b) return { success: false, error: `Company ${companyIdB} not found` };

  await db.mergeRecord.create({
    data: {
      survivorId: companyIdA,
      duplicateId: companyIdB,
      entityType: 'company',
      mergedBy: skippedBy,
      mergeReason: 'not_duplicate',
      fieldsKept: { skipReason: reason },
    },
  });

  logger.info('[DedupEngine] Skip recorded', { companyIdA, companyIdB, reason });

  return { success: true };
}

// ── Merge History ────────────────────────────────────────────────────────

/**
 * Get paginated merge history.
 */
export async function getMergeHistory(options?: {
  page?: number;
  limit?: number;
  entityType?: string;
}): Promise<{ records: MergeHistoryEntry[]; total: number }> {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    ...(options?.entityType ? { entityType: options.entityType } : {}),
    mergeReason: { not: 'not_duplicate' },
  };

  const [records, total] = await Promise.all([
    db.mergeRecord.findMany({
      where,
      include: {
        survivor: { select: { rawName: true } },
        duplicate: { select: { rawName: true } },
      },
      orderBy: { mergedAt: 'desc' },
      take: limit,
      skip,
    }),
    db.mergeRecord.count({ where }),
  ]);

  return {
    records: records.map(r => ({
      id: r.id,
      survivorId: r.survivorId,
      duplicateId: r.duplicateId,
      entityType: r.entityType,
      mergedBy: r.mergedBy,
      mergedAt: r.mergedAt.toISOString(),
      mergeReason: r.mergeReason,
      fieldsKept: r.fieldsKept as Record<string, string> | null,
      survivorName: r.survivor.rawName,
      duplicateName: r.duplicate?.rawName ?? undefined,
    })),
    total,
  };
}
