/**
 * M5 WOW #4 — Enterprise Knowledge Intelligence API
 * ════════════════════════════════════════════════════
 *
 * COMPOSITION LAYER — does NOT rebuild engines.
 * Composes existing intelligence engines into a unified
 * knowledge-query experience:
 *
 *   Query → Hybrid Retrieval → Knowledge Graph → Memory
 *          → Evidence Synthesis → TRUST Metadata → Answer
 *
 * Answer format:
 *   Question → Reasoning → Evidence → Sources → Confidence → Answer
 *
 * Engines consumed (imported, NOT rebuilt):
 *   - ai-hybrid-retrieval.ts  — 6-signal hybrid retrieval
 *   - ai-knowledge-graph.ts   — Entity resolution, graph expansion
 *   - ai-memory.ts            — 4-layer memory search
 *   - trust-metadata.ts       — TRUST framework
 *   - ai-unified-confidence.ts — 6-dimension confidence scoring
 *
 * Usage (via API route):
 *   POST /api/intelligence/knowledge-query
 *   { query: "What do we know about healthcare AI adoption?", companyId?: string, maxResults?: number }
 */

import { logger } from '@/lib/logger';
import {
  hybridSearch,
  understandQuery,
  extractEntities,
  type EvidencePackage,
  type HybridResult,
  type HybridSearchInput,
  type QueryUnderstanding,
  type ExtractedEntity,
  type SourceTier,
} from '@/lib/ai-hybrid-retrieval';
import {
  resolveEntity,
  expandFromEntity,
  extractGraphEntities,
  getGraphStats,
  seedKnowledgeGraph,
  type GraphExpansionResult,
  type EvidenceChain,
  type GraphEntityType,
  type GraphNode,
} from '@/lib/ai-knowledge-graph';
import {
  searchMemories,
  buildMemoryContext,
  type MemoryRecallResult,
  type MemoryContext,
} from '@/lib/ai-memory';
import {
  aggregateTrust,
  platformComputedTrust,
  computeTrustScore,
  type TrustMetadata,
  type TrustConfidence,
} from '@/lib/intelligence-sources/trust-metadata';
import {
  computeUnifiedConfidence,
  type ConfidenceResult,
  type ConfidenceInput,
} from '@/lib/ai-unified-confidence';

// ── Public Types ──────────────────────────────────────────────────────────────

/** Input for a knowledge intelligence query. */
export interface KnowledgeQueryInput {
  /** Natural language question. */
  query: string;
  /** Optional company ID for scoped retrieval. */
  companyId?: string;
  /** Maximum results to consider (default 10). */
  maxResults?: number;
}

/** A single evidence data point supporting the answer. */
export interface EvidenceDatum {
  /** Short claim or fact. */
  claim: string;
  /** Supporting snippet from source. */
  snippet: string;
  /** Source name. */
  source: string | null;
  /** Source date. */
  sourceDate: string | null;
  /** Relevance score 0-1. */
  relevanceScore: number;
  /** Entity IDs this evidence relates to. */
  entityIds: string[];
}

/** A cited source in the answer. */
export interface CitedSource {
  /** Source name. */
  name: string;
  /** Source tier. */
  tier: SourceTier;
  /** Number of evidence items from this source. */
  evidenceCount: number;
  /** Most recent date from this source. */
  mostRecentDate: string | null;
}

/** The structured answer from the knowledge intelligence engine. */
export interface KnowledgeAnswer {
  /** Unique answer ID. */
  answerId: string;
  /** The original question. */
  question: string;
  /** How the answer was derived. */
  reasoning: string;
  /** Supporting evidence data points. */
  evidence: EvidenceDatum[];
  /** Sources cited in this answer. */
  sources: CitedSource[];
  /** Confidence assessment. */
  confidence: ConfidenceResult;
  /** The composed answer text. */
  answer: string;
  /** Whether any knowledge was found. */
  knowledgeFound: boolean;
  /** Knowledge graph entities involved. */
  graphEntities: Array<{ id: string; label: string; type: string }>;
  /** Memory context used. */
  memoryContextSummary: string;
  /** Retrieval quality metrics. */
  retrievalMetrics: {
    retrievalLatencyMs: number;
    graphLatencyMs: number;
    memoryLatencyMs: number;
    totalLatencyMs: number;
    hybridSignalCount: number;
    evidencePackageQuality: {
      averageConfidence: number;
      premiumSourceCount: number;
      signalDiversity: number;
    };
  };
  /** Timestamp. */
  timestamp: string;
}

/** Full output of queryKnowledgeIntelligence. */
export interface KnowledgeIntelligenceOutput {
  success: true;
  answer: KnowledgeAnswer;
  trust: TrustMetadata;
  trustScore: ReturnType<typeof computeTrustScore>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract unique entities from query understanding, trying to resolve
 * them in the knowledge graph.
 */
function resolveQueryEntities(
  queryUnderstanding: QueryUnderstanding,
): Array<{ node: GraphNode; extractedEntity: ExtractedEntity }> {
  const resolved: Array<{ node: GraphNode; extractedEntity: ExtractedEntity }> = [];
  const seen = new Set<string>();

  for (const entity of queryUnderstanding.entities) {
    if (seen.has(entity.normalized)) continue;
    seen.add(entity.normalized);

    const nodes = resolveEntity(entity.text);
    if (nodes.length > 0) {
      resolved.push({ node: nodes[0]!, extractedEntity: entity });
    }
  }

  return resolved;
}

/**
 * Build TRUST metadata for the knowledge answer.
 */
function buildAnswerTrust(
  evidencePackage: EvidencePackage,
  graphEntities: Array<{ node: GraphNode }>,
  memoryResults: MemoryRecallResult[],
  confidenceResult: ConfidenceResult,
): TrustMetadata {
  const totalEvidence = evidencePackage.results.length;
  const sourceTypes = new Set<string>();
  let premiumCount = 0;

  for (const r of evidencePackage.results) {
    if (r.source) sourceTypes.add(r.source);
    if (r.sourceTier === 'premium') premiumCount++;
  }

  const parts: string[] = [];
  parts.push(`Retrieved ${totalEvidence} evidence item(s) via ${evidencePackage.activeSignalCount} retrieval signal(s).`);
  if (graphEntities.length > 0) {
    parts.push(`Resolved ${graphEntities.length} entity(ies) in the knowledge graph.`);
  }
  if (memoryResults.length > 0) {
    parts.push(`${memoryResults.length} relevant memory item(s) found.`);
  }
  parts.push(`Unified confidence: ${confidenceResult.score}/100 (${confidenceResult.grade}).`);

  const trustLevel: TrustConfidence =
    confidenceResult.score >= 75 ? 'high' :
    confidenceResult.score >= 50 ? 'medium' : 'low';

  return platformComputedTrust(
    'knowledge_query',
    parts.join(' '),
    totalEvidence + memoryResults.length,
    trustLevel,
  );
}

/**
 * Build the reasoning narrative explaining how the answer was derived.
 */
function buildReasoning(
  queryUnderstanding: QueryUnderstanding,
  evidencePackage: EvidencePackage,
  graphEntities: Array<{ node: GraphNode }>,
  memoryContext: MemoryContext,
  confidenceResult: ConfidenceResult,
): string {
  const parts: string[] = [];

  // Query understanding
  parts.push(`Query classified as "${queryUnderstanding.intent}" intent (${queryUnderstanding.queryType} type).`);
  if (queryUnderstanding.entities.length > 0) {
    const entityTypes = [...new Set(queryUnderstanding.entities.map(e => e.type))];
    parts.push(`Identified ${queryUnderstanding.entities.length} entity reference(s): ${entityTypes.join(', ')}.`);
  }

  // Retrieval
  if (evidencePackage.results.length > 0) {
    parts.push(
      `Hybrid retrieval returned ${evidencePackage.results.length} result(s) ` +
      `across ${evidencePackage.activeSignalCount} signal(s) ` +
      `(vector, keyword, entity, knowledge graph) with average confidence ` +
      `${(evidencePackage.quality.averageConfidence * 100).toFixed(0)}%.`
    );
  } else {
    parts.push('Hybrid retrieval returned no results for this query.');
  }

  // Knowledge graph
  if (graphEntities.length > 0) {
    parts.push(
      `Knowledge graph resolved ${graphEntities.length} entity(ies): ` +
      graphEntities.map(e => e.node.label).join(', ') + '.'
    );
  }

  // Memory
  const totalMemories = memoryContext.totalMemories;
  if (totalMemories > 0) {
    parts.push(`Memory system contributed ${totalMemories} relevant item(s) across 4 layers.`);
  }

  // Confidence summary
  parts.push(`Final confidence: ${confidenceResult.score}/100 (${confidenceResult.trustClass} trust class).`);

  return parts.join(' ');
}

/**
 * Extract structured evidence data points from hybrid retrieval results.
 */
function extractEvidenceData(
  results: HybridResult[],
  maxResults: number,
): EvidenceDatum[] {
  return results.slice(0, maxResults).map(r => ({
    claim: r.snippet,
    snippet: r.content.length > 300 ? r.content.slice(0, 300) + '...' : r.content,
    source: r.source,
    sourceDate: r.sourceDate,
    relevanceScore: r.finalScore,
    entityIds: r.entities.map(e => e.normalized),
  }));
}

/**
 * Build cited sources from retrieval results.
 */
function buildCitedSources(results: HybridResult[]): CitedSource[] {
  const sourceMap = new Map<string, { tier: SourceTier; count: number; maxDate: string | null }>();

  for (const r of results) {
    const name = r.source || 'unknown';
    const existing = sourceMap.get(name);
    if (!existing) {
      sourceMap.set(name, { tier: r.sourceTier, count: 1, maxDate: r.sourceDate });
    } else {
      existing.count++;
      if (r.sourceDate && (!existing.maxDate || r.sourceDate > existing.maxDate)) {
        existing.maxDate = r.sourceDate;
      }
    }
  }

  return Array.from(sourceMap.entries())
    .map(([name, info]) => ({
      name,
      tier: info.tier,
      evidenceCount: info.count,
      mostRecentDate: info.maxDate,
    }))
    .sort((a, b) => b.evidenceCount - a.evidenceCount);
}

/**
 * Synthesize the final answer text from all gathered intelligence.
 */
function synthesizeAnswer(
  query: string,
  evidenceData: EvidenceDatum[],
  graphEntities: Array<{ node: GraphNode }>,
  memoryContext: MemoryContext,
  knowledgeFound: boolean,
): string {
  if (!knowledgeFound) {
    const parts: string[] = [
      `No specific knowledge was found for: "${query}".`,
    ];

    const graphStats = getGraphStats();
    if (graphStats.totalNodes > 0) {
      parts.push(
        `The knowledge base contains ${graphStats.totalNodes} entities and ${graphStats.totalEdges} relationships.` +
        ` Try a more specific query referencing known companies, technologies, or industries. `
        + `Available entity types include: company, person, technology, industry, capability, and signal.`
      );
    } else {
      parts.push('The knowledge base is currently empty. Ingest documents or seed the knowledge graph to populate it.');
    }

    const memoryStats = memoryContext;
    if (memoryStats.totalMemories > 0) {
      parts.push(`However, ${memoryStats.totalMemories} memory item(s) exist in the system — broader queries may yield results.`);
    }

    return parts.join(' ');
  }

  // Build a composed answer
  const parts: string[] = [];

  // Lead with the strongest evidence
  if (evidenceData.length > 0) {
    const topEvidence = evidenceData.slice(0, 3);
    parts.push(`Based on ${evidenceData.length} evidence item(s):`);

    for (const ev of topEvidence) {
      const sourceRef = ev.source ? ` (source: ${ev.source})` : '';
      parts.push(`— ${ev.claim}${sourceRef}`);
    }
  }

  // Add knowledge graph context
  if (graphEntities.length > 0) {
    const labels = graphEntities.map(e => e.node.label);
    parts.push(`Related knowledge graph entities: ${labels.join(', ')}.`);
  }

  // Add memory context
  const enterpriseMemories = memoryContext.enterprise;
  const institutionalMemories = memoryContext.institutional;
  if (enterpriseMemories.length > 0 || institutionalMemories.length > 0) {
    const total = enterpriseMemories.length + institutionalMemories.length;
    parts.push(`${total} organizational memory item(s) support this assessment.`);
  }

  return parts.join(' ');
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Enterprise Knowledge Intelligence query.
 *
 * Composes hybrid retrieval, knowledge graph, memory, confidence,
 * and TRUST metadata into a single structured answer.
 *
 * NON-THROWING: Returns structured result even on failure.
 */
export function queryKnowledgeIntelligence(
  input: KnowledgeQueryInput,
): KnowledgeIntelligenceOutput {
  const startTime = Date.now();
  const answerId = generateId('kiq');

  logger.info('[M5-WOW4] Knowledge intelligence query received', {
    answerId,
    query: input.query.slice(0, 100),
    companyId: input.companyId,
    maxResults: input.maxResults,
  });

  // ── Phase 1: Query Understanding ──────────────────────────────────
  const queryUnderstanding = understandQuery(input.query);

  // ── Phase 2: Hybrid Retrieval ────────────────────────────────────
  const retrievalStart = Date.now();
  const searchInput: HybridSearchInput = {
    query: input.query,
    topK: input.maxResults || 10,
    companyId: input.companyId,
    includeKnowledgeGraph: true,
  };

  const evidencePackage = hybridSearch(searchInput);
  const retrievalLatencyMs = Date.now() - retrievalStart;

  // ── Phase 3: Knowledge Graph Entity Resolution & Expansion ────────
  const graphStart = Date.now();
  const resolvedEntities = resolveQueryEntities(queryUnderstanding);

  // Expand from each resolved entity to discover related knowledge
  const graphExpansions: Array<{
    entity: GraphNode;
    expansion: GraphExpansionResult;
  }> = [];

  for (const { node } of resolvedEntities) {
    const expansion = expandFromEntity(node.id, {
      maxHops: 2,
      maxResults: 15,
      bidirectional: true,
    });
    graphExpansions.push({ entity: node, expansion });
  }

  // Collect all graph evidence chains
  const allEvidenceChains: EvidenceChain[] = [];
  for (const { expansion } of graphExpansions) {
    allEvidenceChains.push(...expansion.evidenceChains);
  }

  const graphLatencyMs = Date.now() - graphStart;

  // ── Phase 4: Memory Search ────────────────────────────────────────
  const memoryStart = Date.now();
  const memoryContext = buildMemoryContext({
    query: input.query,
    scopeEntityType: input.companyId ? 'company' : undefined,
    scopeEntityId: input.companyId,
    maxPerLayer: 5,
  });

  // Also do explicit memory search for broader recall
  const memorySearchResults = searchMemories({
    query: input.query,
    limit: 10,
    scopeEntityId: input.companyId,
  });
  const memoryLatencyMs = Date.now() - memoryStart;

  // ── Phase 5: Knowledge Assessment ─────────────────────────────────
  const knowledgeFound =
    evidencePackage.results.length > 0 ||
    resolvedEntities.length > 0 ||
    allEvidenceChains.length > 0 ||
    memoryContext.totalMemories > 0;

  // ── Phase 6: Evidence Synthesis ───────────────────────────────────
  const evidenceData = extractEvidenceData(
    evidencePackage.results,
    input.maxResults || 10,
  );

  const citedSources = buildCitedSources(evidencePackage.results);

  // ── Phase 7: Confidence Scoring ───────────────────────────────────
  const confidenceInput: ConfidenceInput = {
    entityId: input.companyId,
    entityType: 'company',

    // Data quality — how complete is the evidence
    dataCompleteness: evidencePackage.results.length > 0
      ? Math.min(1, evidencePackage.results.length / 5)
      : 0,

    // Source reliability
    sources: citedSources.map(s => ({
      name: s.name,
      reliability: s.tier === 'premium' ? 0.95 : s.tier === 'standard' ? 0.7 : 0.4,
      type: s.tier,
    })),
    averageSourceReliability: evidencePackage.quality.averageConfidence,

    // Freshness — use recency score from evidence package
    freshnessScore: Math.round(evidencePackage.quality.averageRecencyScore * 100),

    // Cross validation — multiple signals and graph corroboration
    crossValidatedFacts: evidencePackage.activeSignalCount >= 3 ? evidencePackage.results.length : 0,
    totalFacts: evidenceData.length,

    // Evidence coverage
    evidenceCount: evidenceData.length + allEvidenceChains.length + memorySearchResults.length,
    evidenceCoverage: Math.min(1, (evidenceData.length + allEvidenceChains.length) / 5),

    // AI certainty — derived from retrieval quality
    qualityGateScore: Math.round(evidencePackage.quality.signalDiversity * 100),
  };

  const confidenceResult = computeUnifiedConfidence(confidenceInput);

  // ── Phase 8: Build Answer ─────────────────────────────────────────
  const reasoning = buildReasoning(
    queryUnderstanding,
    evidencePackage,
    resolvedEntities,
    memoryContext,
    confidenceResult,
  );

  const answer = synthesizeAnswer(
    input.query,
    evidenceData,
    resolvedEntities,
    memoryContext,
    knowledgeFound,
  );

  // ── Phase 9: TRUST Metadata ───────────────────────────────────────
  const trust = buildAnswerTrust(
    evidencePackage,
    resolvedEntities,
    memorySearchResults,
    confidenceResult,
  );

  const trustScore = computeTrustScore(trust);

  // ── Phase 10: Assemble Output ─────────────────────────────────────
  const totalLatencyMs = Date.now() - startTime;

  const knowledgeAnswer: KnowledgeAnswer = {
    answerId,
    question: input.query,
    reasoning,
    evidence: evidenceData,
    sources: citedSources,
    confidence: confidenceResult,
    answer,
    knowledgeFound,
    graphEntities: resolvedEntities.map(e => ({
      id: e.node.id,
      label: e.node.label,
      type: e.node.type,
    })),
    memoryContextSummary:
      memoryContext.totalMemories > 0
        ? `${memoryContext.totalMemories} memory item(s) contributed (working: ${memoryContext.working.length}, conversation: ${memoryContext.conversation.length}, enterprise: ${memoryContext.enterprise.length}, institutional: ${memoryContext.institutional.length}).`
        : 'No relevant memories found.',
    retrievalMetrics: {
      retrievalLatencyMs,
      graphLatencyMs,
      memoryLatencyMs,
      totalLatencyMs,
      hybridSignalCount: evidencePackage.activeSignalCount,
      evidencePackageQuality: {
        averageConfidence: evidencePackage.quality.averageConfidence,
        premiumSourceCount: evidencePackage.quality.premiumSourceCount,
        signalDiversity: evidencePackage.quality.signalDiversity,
      },
    },
    timestamp: new Date().toISOString(),
  };

  logger.info('[M5-WOW4] Knowledge intelligence query completed', {
    answerId,
    knowledgeFound,
    resultCount: evidencePackage.results.length,
    graphEntities: resolvedEntities.length,
    confidence: confidenceResult.score,
    trustScore: trustScore.score,
    trustGrade: trustScore.grade,
    latencyMs: totalLatencyMs,
  });

  return {
    success: true,
    answer: knowledgeAnswer,
    trust,
    trustScore,
  };
}
