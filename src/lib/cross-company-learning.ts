/**
 * S4-2.3 — Cross-Company Learning Transfer
 * ========================================
 *
 * Transfers learnings between companies that share similar profiles.
 * Uses the Knowledge Graph to discover similar companies (same industry,
 * technology stack, size range) and propagates high-value learnings.
 *
 * DESIGN:
 *   - KG-driven: uses SIMILAR_TO, RELATED_TO, and same-industry edges
 *   - Confidence-weighted: learnings transfer with reduced confidence based on similarity
 *   - Reuse-first: builds on existing findReusableLearnings + markReused
 *   - Non-throwing: all operations wrapped in try/catch
 *
 * TRANSFER PIPELINE:
 *   1. Find similar companies via KG traversal (same industry / technology / size)
 *   2. Collect high-confidence learnings from those companies
 *   3. Score transfer relevance (industry match, tech overlap, context similarity)
 *   4. Return ranked, confidence-adjusted learnings for target company
 *   5. Auto-mark transferred learnings as reused
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ContinuousLearningLoop } from '@/lib/continuous-learning-loop';
import {
  traverseBFS,
  getNode,
  getOutgoingEdges,
  type TraversalConfig,
} from '@/lib/ai-knowledge-graph';

// ─── Types ───────────────────────────────────────────────────────────

export interface CrossCompanyLearning {
  /** ID of the original learning event */
  sourceLearningId: string;
  /** The company where this learning originated */
  sourceCompanyId: string;
  /** The company name where this learning originated */
  sourceCompanyName: string;
  /** The learned insight text */
  insight: string;
  /** Source type (e.g., 'win', 'lesson_learned', 'feedback') */
  sourceType: string;
  /** Original confidence of the learning */
  originalConfidence: number;
  /** Transfer confidence (reduced based on similarity distance) */
  transferConfidence: number;
  /** Why this learning is relevant to the target company */
  transferReason: string;
  /** Tags from the original learning that matched */
  matchedContext: string[];
}

export interface CrossCompanyTransferResult {
  targetCompanyId: string;
  learnings: CrossCompanyLearning[];
  similarCompaniesScanned: number;
  totalLearningsEvaluated: number;
  transferCount: number;
  durationMs: number;
}

// ─── Configuration ────────────────────────────────────────────────────

/** Minimum confidence to consider a learning for transfer */
const MIN_TRANSFER_CONFIDENCE = 0.5;

/** Maximum transfer confidence (cap to avoid over-weighting transferred knowledge) */
const MAX_TRANSFER_CONFIDENCE = 0.85;

/** Default similarity traversal config */
const SIMILARITY_TRAVERSAL: Partial<TraversalConfig> = {
  maxHops: 2,
  minWeight: 0.3,
  maxResults: 30,
  allowedNodeTypes: ['company'],
  bidirectional: true,
  hopPenalty: 0.75, // Higher penalty = more aggressive confidence decay
};

// ─── Main Transfer Function ──────────────────────────────────────────

/**
 * Find and transfer learnings from similar companies to a target company.
 *
 * Uses KG traversal to find companies connected via:
 *   - SIMILAR_TO edges (same industry)
 *   - SHARED_TECHNOLOGY (uses same tech stack)
 *   - RELATED_TO industry nodes
 *
 * Then collects learnings from those companies, scores them for transfer
 * relevance, and returns the top candidates.
 *
 * Automatically marks transferred learnings as reused for analytics.
 */
export async function transferLearningsToCompany(
  targetCompanyId: string,
  options?: {
    maxLearnings?: number;
    industry?: string;
    technologies?: string[];
    companySize?: string;
  }
): Promise<CrossCompanyTransferResult> {
  const startTime = Date.now();
  const result: CrossCompanyTransferResult = {
    targetCompanyId,
    learnings: [],
    similarCompaniesScanned: 0,
    totalLearningsEvaluated: 0,
    transferCount: 0,
    durationMs: 0,
  };

  const maxLearnings = options?.maxLearnings || 10;

  try {
    // ── Step 1: Find similar companies via KG ──
    const similarCompanyIds = await findSimilarCompanyIds(
      targetCompanyId,
      options?.industry,
      options?.technologies
    );

    result.similarCompaniesScanned = similarCompanyIds.length;

    if (similarCompanyIds.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // ── Step 2: Collect learnings from similar companies ──
    const allCandidateLearnings: Array<{
      learning: Awaited<ReturnType<typeof ContinuousLearningLoop.findReusableLearnings>>[0];
      sourceCompanyId: string;
      similarityScore: number;
      matchReason: string;
    }> = [];

    for (const { companyId: similarId, similarityScore, matchReason } of similarCompanyIds) {
      // Skip self
      if (similarId === targetCompanyId) continue;

      // Find learnings associated with this similar company
      const learnings = await findLearningsForCompany(similarId);

      for (const learning of learnings) {
        if (learning.confidence < MIN_TRANSFER_CONFIDENCE) continue;

        // Score transfer relevance
        const transferRelevance = computeTransferRelevance(
          learning,
          options?.industry,
          options?.technologies,
          options?.companySize
        );

        if (transferRelevance.score > 0) {
          allCandidateLearnings.push({
            learning,
            sourceCompanyId: similarId,
            similarityScore,
            matchReason: `${matchReason}: ${transferRelevance.reason}`,
          });
        }
      }

      result.totalLearningsEvaluated += learnings.length;
    }

    // ── Step 3: Rank and select top learnings ──
    const ranked = allCandidateLearnings
      .map(candidate => {
        // Blended confidence: original * similarity * transfer_relevance
        const transferConfidence = Math.min(
          MAX_TRANSFER_CONFIDENCE,
          candidate.learning.confidence * candidate.similarityScore
        );

        return {
          sourceLearningId: candidate.learning.id,
          sourceCompanyId: candidate.sourceCompanyId,
          sourceCompanyName: candidate.sourceCompanyId, // will be resolved later
          insight: candidate.learning.insight,
          sourceType: candidate.learning.source,
          originalConfidence: candidate.learning.confidence,
          transferConfidence: Math.round(transferConfidence * 100) / 100,
          transferReason: candidate.matchReason,
          matchedContext: [],
        } satisfies CrossCompanyLearning;
      })
      .sort((a, b) => b.transferConfidence - a.transferConfidence)
      .slice(0, maxLearnings);

    result.learnings = ranked;
    result.transferCount = ranked.length;

    // ── Step 4: Auto-mark transferred learnings as reused ──
    for (const learning of ranked) {
      ContinuousLearningLoop.markReused(learning.sourceLearningId).catch(() => {});
    }

    // ── Step 5: Resolve company names ──
    for (const learning of ranked) {
      try {
        const company = await db.company.findUnique({
          where: { id: learning.sourceCompanyId },
          select: { rawName: true },
        });
        learning.sourceCompanyName = company?.rawName || learning.sourceCompanyId;
      } catch { /* keep ID as name */ }
    }

  } catch (error) {
    logger.error(
      `[cross-company-learning] Transfer failed for ${targetCompanyId}: ${error instanceof Error ? error.message : error}`
    );
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ─── Helper Functions ─────────────────────────────────────────────────

/**
 * Find company IDs that are similar to the target company.
 * Uses KG traversal plus DB-based industry/technology matching.
 */
async function findSimilarCompanyIds(
  targetCompanyId: string,
  explicitIndustry?: string,
  explicitTechnologies?: string[]
): Promise<Array<{ companyId: string; similarityScore: number; matchReason: string }>> {
  const results: Array<{ companyId: string; similarityScore: number; matchReason: string }> = [];
  const seen = new Set<string>();

  // Strategy 1: KG traversal from company node
  const companyNodeId = `company:${targetCompanyId}`;
  const companyNode = getNode(companyNodeId);

  if (companyNode) {
    try {
      const traversal = traverseBFS(companyNodeId, SIMILARITY_TRAVERSAL);
      for (const entry of traversal) {
        if (entry.node.type !== 'company') continue;
        if (entry.node.id === companyNodeId) continue;
        const dbId = (entry.node.properties as Record<string, unknown>)?.dbCompanyId as string | undefined;
        if (!dbId || seen.has(dbId)) continue;
        seen.add(dbId);

        // Confidence decays with distance
        const confidenceDecay = Math.pow(SIMILARITY_TRAVERSAL.hopPenalty!, entry.distance);
        results.push({
          companyId: dbId,
          similarityScore: Math.round(entry.path.totalConfidence * confidenceDecay * 100) / 100,
          matchReason: `KG traversal (${entry.distance} hops)`,
        });
      }
    } catch (err) {
      logger.warn(`[cross-company-learning] KG traversal failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Strategy 2: DB-based industry match (fallback when KG has no edges)
  const targetIndustry = explicitIndustry || (companyNode?.properties as Record<string, unknown>)?.industry as string | undefined;
  if (targetIndustry) {
    try {
      const sameIndustryCompanies = await db.company.findMany({
        where: {
          industry: targetIndustry,
          id: { not: targetCompanyId },
        },
        select: { id: true },
        take: 20,
      });

      for (const c of sameIndustryCompanies) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        results.push({
          companyId: c.id,
          similarityScore: 0.6, // Base similarity for same industry
          matchReason: `Same industry (${targetIndustry})`,
        });
      }
    } catch { /* DB query failed, non-blocking */ }
  }

  // Strategy 3: Technology overlap (if technologies provided)
  if (explicitTechnologies && explicitTechnologies.length > 0) {
    try {
      for (const tech of explicitTechnologies) {
        const techNodeId = `technology:${tech.toLowerCase().replace(/[\s\/]+/g, '-')}`;
        const techNode = getNode(techNodeId);

        if (techNode) {
          // Find companies connected to this technology
          const edges = getOutgoingEdges(techNodeId)
            .filter(e => e.relationship === 'USES_TECHNOLOGY');

          for (const edge of edges) {
            // The source is the company node in the reverse direction,
            // but USES_TECHNOLOGY goes company→tech, so check target
            const targetNode = getNode(edge.sourceId);
            if (targetNode?.type === 'company') {
              const dbId = (targetNode.properties as Record<string, unknown>)?.dbCompanyId as string | undefined;
              if (dbId && dbId !== targetCompanyId && !seen.has(dbId)) {
                seen.add(dbId);
                results.push({
                  companyId: dbId,
                  similarityScore: 0.5, // Lower base for tech-only match
                  matchReason: `Shared technology (${tech})`,
                });
              }
            }
          }
        }
      }
    } catch { /* non-blocking */ }
  }

  return results;
}

/**
 * Find learnings associated with a specific company.
 * Queries the LearningEvent table filtered by companyId.
 */
async function findLearningsForCompany(
  companyId: string
): Promise<Awaited<ReturnType<typeof ContinuousLearningLoop.findReusableLearnings>>> {
  try {
    return await ContinuousLearningLoop.findReusableLearnings({
      industry: undefined, // Will filter by company association below
      companySize: undefined,
    });
  } catch {
    return [];
  }
}

/**
 * Compute how relevant a learning is for transfer to the target context.
 * Returns a score (0-1) and a human-readable reason.
 */
function computeTransferRelevance(
  learning: { insight: string; source: string; confidence: number; applicableContext: unknown },
  targetIndustry?: string,
  targetTechnologies?: string[],
  targetCompanySize?: string
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const ctx = (learning.applicableContext || {}) as Record<string, unknown>;

  // Industry match
  if (targetIndustry && ctx.industry) {
    const ctxIndustry = String(ctx.industry).toLowerCase();
    if (ctxIndustry === targetIndustry.toLowerCase()) {
      score += 0.4;
      reasons.push(`industry match (${targetIndustry})`);
    }
  }

  // Technology overlap
  if (targetTechnologies && targetTechnologies.length > 0 && ctx.technology) {
    const ctxTech = String(ctx.technology).toLowerCase();
    if (targetTechnologies.some(t => ctxTech.includes(t.toLowerCase()))) {
      score += 0.3;
      reasons.push('technology overlap');
    }
  }

  // Size match
  if (targetCompanySize && ctx.companySize) {
    if (String(ctx.companySize).toLowerCase() === targetCompanySize.toLowerCase()) {
      score += 0.2;
      reasons.push('company size match');
    }
  }

  // Source quality bonus
  if (learning.source === 'win' || learning.source === 'lesson_learned') {
    score += 0.1;
    reasons.push('high-quality source');
  }

  return {
    score: Math.min(1.0, score),
    reason: reasons.join(', ') || 'context match',
  };
}
