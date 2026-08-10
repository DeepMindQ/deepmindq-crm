/**
 * WI-16G — Knowledge Graph Intelligence Engine
 * ===============================================
 *
 * Transforms DeepMindQ from "AI that searches information" to
 * "AI that understands relationships."
 *
 * ARCHITECTURE:
 *   User Query → Hybrid Retrieval → Knowledge Graph Expansion
 *     → Related Entities → Evidence Chain → AI Reasoning
 *
 * COMPONENTS:
 *   1. Graph Data Model      — Typed entities, relationships, and graph nodes/edges
 *   2. Graph Construction     — Auto-extract entities and build edges from intelligence
 *   3. Graph Traversal       — BFS/DFS, multi-hop queries, path finding
 *   4. Relationship Scoring — Edge weights, confidence propagation, relevance ranking
 *   5. Graph Reasoning       — "Why approach this company now?" → evidence chains
 *   6. Graph API             — Query interface for graph operations
 *
 * RELATIONSHIP TO WI-16F:
 *   WI-16F hybrid retrieval feeds candidates to this engine.
 *   This engine expands candidates via relationship traversal,
 *   producing evidence chains and reasoning support.
 *
 * INTEGRATION POINTS:
 *   - Replaces the knowledgeGraphSearch() stub in ai-hybrid-retrieval.ts
 *   - Exported from engines/index.ts alongside other AI engines
 *   - Consumed by /api/intelligence/graph/ routes
 */

import { logger } from '@/lib/logger';
import {
  extractEntities,
  type ExtractedEntity,
  type EntityType,
} from '@/lib/ai-hybrid-retrieval';
import {
  writeNode as dbWriteNode,
  readNode as dbReadNode,
  deleteNode as dbDeleteNode,
  writeEdge as dbWriteEdge,
  readEdge as dbReadEdge,
  deleteEdge as dbDeleteEdge,
  getEdgesBySource as dbGetEdgesBySource,
  getEdgesByTarget as dbGetEdgesByTarget,
  searchNodes as dbSearchNodes,
  warmCacheFromDb as warmGraphCacheFromDb,
  nodeFromDb,
  edgeFromDb,
} from '@/lib/ai-knowledge-graph-db';

// ── Graph Data Model ──────────────────────────────────────────────

/**
 * All entity types recognized in the knowledge graph.
 * Extends the hybrid retrieval's EntityType with graph-specific types.
 */
export type GraphEntityType =
  | 'company'
  | 'person'
  | 'technology'
  | 'industry'
  | 'role'
  | 'location'
  | 'product'
  | 'financial'
  | 'event'
  | 'generic'
  | 'capability'
  | 'signal'
  | 'opportunity'
  | 'document'
  | 'conversation';

/**
 * All relationship types in the knowledge graph.
 * Each represents a typed, directed edge between two entities.
 */
export type RelationshipType =
  // Organizational
  | 'WORKS_AT'
  | 'WORKED_AT'
  | 'BOARD_MEMBER_OF'
  | 'REPORTS_TO'
  // Business
  | 'PARTNERS_WITH'
  | 'COMPETES_WITH'
  | 'ACQUIRED_BY'
  | 'INVESTED_IN'
  | 'SUPPLIES_TO'
  | 'VENDOR_FOR'
  // Technology
  | 'USES_TECHNOLOGY'
  | 'DEPLOYS_ON'
  | 'MIGRATED_FROM'
  | 'MIGRATED_TO'
  | 'INTEGRATES_WITH'
  | 'BUILDS_ON'
  // Intelligence
  | 'HAS_SIGNAL'
  | 'INDICATES_OPPORTUNITY'
  | 'MATCHES_CAPABILITY'
  | 'INFLUENCES'
  | 'MENTIONS'
  | 'SUPPORTS_CLAIM'
  | 'CONTRADICTS_CLAIM'
  // Temporal
  | 'HAPPENED_BEFORE'
  | 'HAPPENED_DURING'
  // Provenance
  | 'DERIVED_FROM'
  | 'EXTRACTED_FROM'
  // Generic
  | 'RELATED_TO'
  | 'SIMILAR_TO';

/**
 * A single node in the knowledge graph.
 * Nodes represent real-world entities with typed identity.
 */
export interface GraphNode {
  /** Unique node identifier. */
  id: string;
  /** Normalized label (e.g., "Microsoft", "Azure", "Jane Smith"). */
  label: string;
  /** Entity type classification. */
  type: GraphEntityType;
  /** All known aliases/surface forms for entity resolution. */
  aliases: string[];
  /** Key-value properties specific to this entity. */
  properties: Record<string, unknown>;
  /** Source provenance — where this node was extracted from. */
  source?: string;
  /** Creation timestamp. */
  createdAt: number;
  /** Last update timestamp. */
  updatedAt: number;
  /** Confidence in this node's accuracy (0-1). */
  confidence: number;
}

/**
 * A directed, typed edge between two graph nodes.
 * Edges carry weight, confidence, and temporal metadata.
 */
export interface GraphEdge {
  /** Unique edge identifier. */
  id: string;
  /** Source node ID (subject). */
  sourceId: string;
  /** Target node ID (object). */
  targetId: string;
  /** Relationship type. */
  relationship: RelationshipType;
  /** Edge weight for scoring (0-1). Higher = stronger relationship. */
  weight: number;
  /** Confidence in this relationship's accuracy (0-1). */
  confidence: number;
  /** When this relationship was established/observed. */
  observedAt?: string;
  /** Optional expiry — relationships can decay. */
  expiresAt?: string;
  /** Human-readable explanation of why this edge exists. */
  reason: string;
  /** Source provenance. */
  source?: string;
  /** Evidence IDs supporting this relationship. */
  evidenceIds: string[];
  /** Creation timestamp. */
  createdAt: number;
}

/**
 * A path through the graph: an ordered sequence of edges.
 * Used for multi-hop reasoning and evidence chain construction.
 */
export interface GraphPath {
  /** Path nodes in order. */
  nodes: Array<{ id: string; label: string; type: GraphEntityType }>;
  /** Path edges in order. */
  edges: Array<{
    id: string;
    relationship: RelationshipType;
    weight: number;
    confidence: number;
    reason: string;
  }>;
  /** Cumulative path score (product of edge weights, adjusted by hop penalty). */
  totalScore: number;
  /** Cumulative confidence (product of edge confidences). */
  totalConfidence: number;
  /** Number of hops (edges). */
  hops: number;
}

/**
 * An evidence chain: a graph-derived reasoning path
 * that connects a question to an answer through relationships.
 */
export interface EvidenceChain {
  /** Chain identifier. */
  chainId: string;
  /** The original query/question this chain answers. */
  question: string;
  /** Starting node. */
  originNode: { id: string; label: string; type: GraphEntityType };
  /** Target node(s) this chain leads to. */
  targetNodes: Array<{ id: string; label: string; type: GraphEntityType }>;
  /** The path(s) connecting origin to target. */
  paths: GraphPath[];
  /** Human-readable reasoning narrative. */
  narrative: string;
  /** Key signals/opportunities discovered along this chain. */
  discoveredSignals: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
  /** Overall chain confidence (0-1). */
  confidence: number;
  /** Entity IDs referenced in this chain. */
  referencedEntityIds: string[];
  /** Timestamp. */
  timestamp: string;
}

/**
 * A graph expansion result — entities discovered by traversing
 * relationships from a starting point.
 */
export interface GraphExpansionResult {
  /** Starting node. */
  originNode: { id: string; label: string; type: GraphEntityType };
  /** Discovered related entities, ranked by relevance. */
  entities: Array<{
    node: GraphNode;
    relationships: Array<{ edge: GraphEdge; viaNode?: { id: string; label: string } }>;
    score: number;
  }>;
  /** Total nodes discovered. */
  totalDiscovered: number;
  /** Hops traversed. */
  maxHops: number;
  /** Evidence chains produced from this expansion. */
  evidenceChains: EvidenceChain[];
  /** Latency in milliseconds. */
  latencyMs: number;
}

/**
 * Graph statistics for monitoring and dashboarding.
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<GraphEntityType, number>;
  edgesByRelationship: Partial<Record<RelationshipType, number>>;
  averageEdgeWeight: number;
  averageEdgeConfidence: number;
  connectedComponents: number;
  isolationRatio: number;
}

/**
 * Input for a graph-based recommendation query.
 */
export interface GraphRecommendationInput {
  /** Origin entity ID. */
  entityId: string;
  /** What kind of recommendation to produce. */
  type: 'similar_companies' | 'influence_mapping' | 'opportunity_signals'
    | 'technology_fit' | 'contact_suggestion' | 'competitive_landscape';
  /** Maximum hops to traverse (default 2). */
  maxHops?: number;
  /** Minimum edge weight to consider (default 0.3). */
  minWeight?: number;
  /** Limit on results (default 10). */
  limit?: number;
  /** Filter by entity type for target nodes. */
  targetType?: GraphEntityType[];
  /** Additional context for scoring. */
  context?: Record<string, unknown>;
}

/**
 * Output of a graph-based recommendation query.
 */
export interface GraphRecommendation {
  /** Recommendation identifier. */
  id: string;
  /** Type of recommendation. */
  type: string;
  /** The recommended entity. */
  entity: { id: string; label: string; type: GraphEntityType };
  /** Why this entity was recommended. */
  reason: string;
  /** Evidence path supporting this recommendation. */
  evidencePath: GraphPath;
  /** Recommendation confidence (0-1). */
  confidence: number;
  /** Relevant signals associated with this recommendation. */
  signals: Array<{ type: string; description: string; weight: number }>;
  /** Suggested actions. */
  suggestedActions: string[];
  /** Timestamp. */
  timestamp: string;
}

// ── In-Memory Graph Store ───────────────────────────────────────────

/** The in-memory node store, keyed by node ID. */
const nodeStore = new Map<string, GraphNode>();

/** The in-memory edge store, keyed by edge ID. */
const edgeStore = new Map<string, GraphEdge>();

/** Edge index: sourceId → edge IDs for fast traversal. */
const sourceEdgeIndex = new Map<string, string[]>();

/** Edge index: targetId → edge IDs for reverse traversal. */
const targetEdgeIndex = new Map<string, string[]>();

/** Node index: label → node IDs for entity resolution. */
const labelIndex = new Map<string, string[]>();

/** Node index: type → node IDs for type-scoped queries. */
const typeIndex = new Map<string, string[]>();

/** Edge index: relationship → edge IDs for relationship queries. */
const relationshipIndex = new Map<string, string[]>();

/** Seed flag to prevent re-seeding. */
let seeded = false;

// ── Graph Construction ─────────────────────────────────────────────

/**
 * Add a node to the graph (async — persists to DB).
 * If a node with the same ID exists, it is updated (upsert).
 */
export async function addNode(node: Omit<GraphNode, 'createdAt' | 'updatedAt'>): Promise<GraphNode> {
  const now = Date.now();
  const existing = nodeStore.get(node.id);

  const fullNode: GraphNode = {
    ...node,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    confidence: node.confidence ?? (existing?.confidence ?? 0.7),
  };

  // P1.2: Persist to DB first (source of truth)
  try {
    await dbWriteNode(fullNode);
  } catch (err) {
    logger.warn('[P1.2] addNode DB write failed, keeping in-memory only', {
      id: fullNode.id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Update in-memory hot cache
  nodeStore.set(node.id, fullNode);

  // Update indices
  // Label index
  const normalizedLabel = normalizeLabel(node.label);
  const labelNodes = labelIndex.get(normalizedLabel) || [];
  if (!labelNodes.includes(node.id)) {
    labelNodes.push(node.id);
    labelIndex.set(normalizedLabel, labelNodes);
  }

  // Type index
  const typeNodes = typeIndex.get(node.type) || [];
  if (!typeNodes.includes(node.id)) {
    typeNodes.push(node.id);
    typeIndex.set(node.type, typeNodes);
  }

  // Add aliases to label index
  for (const alias of node.aliases || []) {
    const normAlias = normalizeLabel(alias);
    const aliasNodes = labelIndex.get(normAlias) || [];
    if (!aliasNodes.includes(node.id)) {
      aliasNodes.push(node.id);
      labelIndex.set(normAlias, aliasNodes);
    }
  }

  return fullNode;
}

/**
 * Sync wrapper for addNode — backward compatibility.
 * Performs in-memory update only; DB write is fire-and-forget.
 */
export function addNodeSync(node: Omit<GraphNode, 'createdAt' | 'updatedAt'>): GraphNode {
  const now = Date.now();
  const existing = nodeStore.get(node.id);

  const fullNode: GraphNode = {
    ...node,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    confidence: node.confidence ?? (existing?.confidence ?? 0.7),
  };

  // Fire-and-forget DB write
  dbWriteNode(fullNode).catch(() => {});

  // Update in-memory hot cache
  nodeStore.set(node.id, fullNode);

  // Update indices
  const normalizedLabel = normalizeLabel(node.label);
  const labelNodes = labelIndex.get(normalizedLabel) || [];
  if (!labelNodes.includes(node.id)) {
    labelNodes.push(node.id);
    labelIndex.set(normalizedLabel, labelNodes);
  }

  const typeNodes = typeIndex.get(node.type) || [];
  if (!typeNodes.includes(node.id)) {
    typeNodes.push(node.id);
    typeIndex.set(node.type, typeNodes);
  }

  for (const alias of node.aliases || []) {
    const normAlias = normalizeLabel(alias);
    const aliasNodes = labelIndex.get(normAlias) || [];
    if (!aliasNodes.includes(node.id)) {
      aliasNodes.push(node.id);
      labelIndex.set(normAlias, aliasNodes);
    }
  }

  return fullNode;
}

/**
 * Add an edge to the graph (async — persists to DB).
 * If an edge with the same ID exists, it is updated.
 */
export async function addEdge(edge: Omit<GraphEdge, 'createdAt'>): Promise<GraphEdge> {
  const now = Date.now();
  const fullEdge: GraphEdge = { ...edge, createdAt: now };

  // P1.2: Persist to DB first (source of truth)
  try {
    await dbWriteEdge(fullEdge);
  } catch (err) {
    logger.warn('[P1.2] addEdge DB write failed, keeping in-memory only', {
      id: fullEdge.id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Update in-memory hot cache
  edgeStore.set(edge.id, fullEdge);

  // Source edge index
  const sourceEdges = sourceEdgeIndex.get(edge.sourceId) || [];
  if (!sourceEdges.includes(edge.id)) {
    sourceEdges.push(edge.id);
    sourceEdgeIndex.set(edge.sourceId, sourceEdges);
  }

  // Target edge index
  const targetEdges = targetEdgeIndex.get(edge.targetId) || [];
  if (!targetEdges.includes(edge.id)) {
    targetEdges.push(edge.id);
    targetEdgeIndex.set(edge.targetId, targetEdges);
  }

  // Relationship index
  const relEdges = relationshipIndex.get(edge.relationship) || [];
  if (!relEdges.includes(edge.id)) {
    relEdges.push(edge.id);
    relationshipIndex.set(edge.relationship, relEdges);
  }

  return fullEdge;
}

/**
 * Sync wrapper for addEdge — backward compatibility.
 * Performs in-memory update only; DB write is fire-and-forget.
 */
export function addEdgeSync(edge: Omit<GraphEdge, 'createdAt'>): GraphEdge {
  const now = Date.now();
  const fullEdge: GraphEdge = { ...edge, createdAt: now };

  // Fire-and-forget DB write
  dbWriteEdge(fullEdge).catch(() => {});

  // Update in-memory hot cache
  edgeStore.set(edge.id, fullEdge);

  // Source edge index
  const sourceEdges = sourceEdgeIndex.get(edge.sourceId) || [];
  if (!sourceEdges.includes(edge.id)) {
    sourceEdges.push(edge.id);
    sourceEdgeIndex.set(edge.sourceId, sourceEdges);
  }

  // Target edge index
  const targetEdges = targetEdgeIndex.get(edge.targetId) || [];
  if (!targetEdges.includes(edge.id)) {
    targetEdges.push(edge.id);
    targetEdgeIndex.set(edge.targetId, targetEdges);
  }

  // Relationship index
  const relEdges = relationshipIndex.get(edge.relationship) || [];
  if (!relEdges.includes(edge.id)) {
    relEdges.push(edge.id);
    relationshipIndex.set(edge.relationship, relEdges);
  }

  return fullEdge;
}

/**
 * Remove a node and all its connected edges from the graph (async — persists to DB).
 */
export async function removeNode(nodeId: string): Promise<boolean> {
  const node = nodeStore.get(nodeId);
  if (!node) return false;

  // Remove all connected edges (in-memory, sync)
  const edgeIds = new Set([
    ...(sourceEdgeIndex.get(nodeId) || []),
    ...(targetEdgeIndex.get(nodeId) || []),
  ]);
  for (const edgeId of edgeIds) {
    removeEdgeSync(edgeId);
  }

  // Remove from label index
  for (const [label, ids] of labelIndex) {
    labelIndex.set(label, ids.filter(id => id !== nodeId));
  }

  // Remove from type index
  typeIndex.set(node.type, (typeIndex.get(node.type) || []).filter(id => id !== nodeId));

  const deleted = nodeStore.delete(nodeId);

  // P1.2: Delete from DB (cascades edges)
  try {
    await dbDeleteNode(nodeId);
  } catch (err) {
    logger.warn('[P1.2] removeNode DB delete failed', {
      id: nodeId.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return deleted;
}

/**
 * Sync wrapper for removeNode — backward compatibility.
 * In-memory removal only; DB delete is fire-and-forget.
 */
export function removeNodeSync(nodeId: string): boolean {
  const node = nodeStore.get(nodeId);
  if (!node) return false;

  // Remove all connected edges (in-memory, sync)
  const edgeIds = new Set([
    ...(sourceEdgeIndex.get(nodeId) || []),
    ...(targetEdgeIndex.get(nodeId) || []),
  ]);
  for (const edgeId of edgeIds) {
    removeEdgeSync(edgeId);
  }

  // Remove from label index
  for (const [label, ids] of labelIndex) {
    labelIndex.set(label, ids.filter(id => id !== nodeId));
  }

  // Remove from type index
  typeIndex.set(node.type, (typeIndex.get(node.type) || []).filter(id => id !== nodeId));

  const deleted = nodeStore.delete(nodeId);

  // Fire-and-forget DB delete
  dbDeleteNode(nodeId).catch(() => {});

  return deleted;
}

/**
 * Remove an edge from the graph and update indices (async — persists to DB).
 */
export async function removeEdge(edgeId: string): Promise<boolean> {
  const edge = edgeStore.get(edgeId);
  if (!edge) return false;

  // Remove from source index
  const sourceEdges = sourceEdgeIndex.get(edge.sourceId) || [];
  sourceEdgeIndex.set(edge.sourceId, sourceEdges.filter(id => id !== edgeId));

  // Remove from target index
  const targetEdges = targetEdgeIndex.get(edge.targetId) || [];
  targetEdgeIndex.set(edge.targetId, targetEdges.filter(id => id !== edgeId));

  // Remove from relationship index
  const relEdges = relationshipIndex.get(edge.relationship) || [];
  relationshipIndex.set(edge.relationship, relEdges.filter(id => id !== edgeId));

  const deleted = edgeStore.delete(edgeId);

  // P1.2: Delete from DB
  try {
    await dbDeleteEdge(edgeId);
  } catch (err) {
    logger.warn('[P1.2] removeEdge DB delete failed', {
      id: edgeId.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return deleted;
}

/**
 * Sync wrapper for removeEdge — backward compatibility.
 * In-memory removal only; DB delete is fire-and-forget.
 */
export function removeEdgeSync(edgeId: string): boolean {
  const edge = edgeStore.get(edgeId);
  if (!edge) return false;

  // Remove from source index
  const sourceEdges = sourceEdgeIndex.get(edge.sourceId) || [];
  sourceEdgeIndex.set(edge.sourceId, sourceEdges.filter(id => id !== edgeId));

  // Remove from target index
  const targetEdges = targetEdgeIndex.get(edge.targetId) || [];
  targetEdgeIndex.set(edge.targetId, targetEdges.filter(id => id !== edgeId));

  // Remove from relationship index
  const relEdges = relationshipIndex.get(edge.relationship) || [];
  relationshipIndex.set(edge.relationship, relEdges.filter(id => id !== edgeId));

  const deleted = edgeStore.delete(edgeId);

  // Fire-and-forget DB delete
  dbDeleteEdge(edgeId).catch(() => {});

  return deleted;
}

/**
 * Resolve a label or alias to a graph node.
 * Returns all matching nodes (entity resolution may yield multiple candidates).
 * Falls back to DB when in-memory index misses.
 */
export async function resolveEntity(label: string): Promise<GraphNode[]> {
  const normalized = normalizeLabel(label);

  // In-memory first
  const ids = labelIndex.get(normalized) || [];
  const memNodes = ids.map(id => nodeStore.get(id)!).filter(Boolean);
  if (memNodes.length > 0) return memNodes;

  // DB fallback — search by label
  try {
    const dbRows = await dbSearchNodes(normalized, 20);
    const dbNodes = dbRows.map(r => nodeFromDb(r));
    // Cache in memory
    for (const node of dbNodes) {
      nodeStore.set(node.id, node);
      const nLabel = normalizeLabel(node.label);
      const existing = labelIndex.get(nLabel) || [];
      if (!existing.includes(node.id)) {
        labelIndex.set(nLabel, [...existing, node.id]);
      }
      const tIdx = typeIndex.get(node.type) || [];
      if (!tIdx.includes(node.id)) {
        typeIndex.set(node.type, [...tIdx, node.id]);
      }
    }
    return dbNodes;
  } catch {
    // DB search failed
  }

  return [];
}

/**
 * Find a node by its ID.
 * Falls back to DB when the in-memory store misses.
 */
export async function getNode(id: string): Promise<GraphNode | undefined> {
  // In-memory first
  const node = nodeStore.get(id);
  if (node) return node;

  // DB fallback
  try {
    const dbRow = await dbReadNode(id);
    if (dbRow) {
      const dbNode = nodeFromDb(dbRow);
      // Cache in memory
      nodeStore.set(dbNode.id, dbNode);
      const nLabel = normalizeLabel(dbNode.label);
      const existing = labelIndex.get(nLabel) || [];
      if (!existing.includes(dbNode.id)) {
        labelIndex.set(nLabel, [...existing, dbNode.id]);
      }
      const tIdx = typeIndex.get(dbNode.type) || [];
      if (!tIdx.includes(dbNode.id)) {
        typeIndex.set(dbNode.type, [...tIdx, dbNode.id]);
      }
      return dbNode;
    }
  } catch {
    // DB read failed
  }

  return undefined;
}

/**
 * Get all edges connected to a node (both outgoing and incoming).
 * Falls back to DB when in-memory indexes miss.
 */
export async function getNodeEdges(nodeId: string): Promise<GraphEdge[]> {
  // In-memory first
  const outgoingIds = sourceEdgeIndex.get(nodeId) || [];
  const incomingIds = targetEdgeIndex.get(nodeId) || [];
  const allIds = [...new Set([...outgoingIds, ...incomingIds])];
  const memEdges = allIds.map(id => edgeStore.get(id)!).filter(Boolean);

  if (memEdges.length > 0) return memEdges;

  // DB fallback
  try {
    const [dbOutRows, dbInRows] = await Promise.all([
      dbGetEdgesBySource(nodeId),
      dbGetEdgesByTarget(nodeId),
    ]);

    const allDbRows = [...dbOutRows, ...dbInRows];
    const dbEdges = allDbRows.map(r => edgeFromDb(r));

    // Cache edges in memory
    for (const edge of dbEdges) {
      edgeStore.set(edge.id, edge);
      const outIdx = sourceEdgeIndex.get(edge.sourceId) || [];
      if (!outIdx.includes(edge.id)) {
        sourceEdgeIndex.set(edge.sourceId, [...outIdx, edge.id]);
      }
      const inIdx = targetEdgeIndex.get(edge.targetId) || [];
      if (!inIdx.includes(edge.id)) {
        targetEdgeIndex.set(edge.targetId, [...inIdx, edge.id]);
      }
    }

    return dbEdges;
  } catch {
    // DB read failed
  }

  return [];
}

/**
 * Get outgoing edges from a node.
 */
export function getOutgoingEdges(nodeId: string): GraphEdge[] {
  const ids = sourceEdgeIndex.get(nodeId) || [];
  return ids.map(id => edgeStore.get(id)!).filter(Boolean);
}

/**
 * Get incoming edges to a node.
 */
export function getIncomingEdges(nodeId: string): GraphEdge[] {
  const ids = targetEdgeIndex.get(nodeId) || [];
  return ids.map(id => edgeStore.get(id)!).filter(Boolean);
}

// ── Entity Extraction & Graph Population ──────────────────────────

/**
 * Entity extraction result with relationship hints.
 * Extends the basic ExtractedEntity with graph construction hints.
 */
export interface GraphEntityExtraction {
  entity: ExtractedEntity;
  /** Suggested node type for the knowledge graph. */
  graphType: GraphEntityType;
  /** Suggested relationships this entity might have with other extracted entities. */
  suggestedRelationships: Array<{
    targetLabel: string;
    relationship: RelationshipType;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Extract entities from text and map them to graph types
 * with suggested relationships for graph construction.
 */
export function extractGraphEntities(text: string): GraphEntityExtraction[] {
  const baseEntities = extractEntities(text);
  const extractions: GraphEntityExtraction[] = [];

  for (const entity of baseEntities) {
    const graphType = mapToGraphType(entity.type);
    const suggestedRelationships = inferRelationships(entity, baseEntities);

    extractions.push({
      entity,
      graphType,
      suggestedRelationships,
    });
  }

  return extractions;
}

/**
 * Map hybrid retrieval entity types to knowledge graph entity types.
 */
function mapToGraphType(entityType: EntityType): GraphEntityType {
  const mapping: Partial<Record<EntityType, GraphEntityType>> = {
    company: 'company',
    person: 'person',
    technology: 'technology',
    industry: 'industry',
    role: 'role',
    location: 'location',
    product: 'product',
    financial: 'financial',
    event: 'event',
    generic: 'generic',
  };
  return mapping[entityType] || 'generic';
}

/**
 * Infer potential relationships between extracted entities based on
 * co-occurrence patterns and entity type pairs.
 */
function inferRelationships(
  entity: ExtractedEntity,
  allEntities: ExtractedEntity[],
): GraphEntityExtraction['suggestedRelationships'] {
  const relationships: GraphEntityExtraction['suggestedRelationships'] = [];

  for (const other of allEntities) {
    if (other.normalized === entity.normalized) continue;

    const relType = inferRelationshipType(entity.type, other.type);
    if (relType) {
      const confidence = estimateRelationshipConfidence(entity, other);
      relationships.push({
        targetLabel: other.normalized,
        relationship: relType,
        confidence,
        reason: `Co-occurrence: "${entity.text}" and "${other.text}" detected together`,
      });
    }
  }

  return relationships;
}

/**
 * Determine likely relationship type between two entity types.
 */
function inferRelationshipType(
  type1: EntityType,
  type2: EntityType,
): RelationshipType | null {
  const rules: Array<[EntityType, EntityType, RelationshipType]> = [
    ['person', 'company', 'WORKS_AT'],
    ['company', 'person', 'PARTNERS_WITH'],
    ['company', 'technology', 'USES_TECHNOLOGY'],
    ['technology', 'company', 'DEPLOYS_ON'],
    ['company', 'industry', 'RELATED_TO'],
    ['technology', 'technology', 'INTEGRATES_WITH'],
    ['person', 'role', 'REPORTS_TO'],
    ['company', 'company', 'COMPETES_WITH'],
    ['person', 'technology', 'USES_TECHNOLOGY'],
    ['event', 'company', 'HAS_SIGNAL'],
    ['financial', 'company', 'INVESTED_IN'],
    ['product', 'company', 'SUPPLIES_TO'],
  ];

  for (const [t1, t2, rel] of rules) {
    if ((type1 === t1 && type2 === t2) || (type1 === t2 && type2 === t1)) {
      return rel;
    }
  }

  return 'RELATED_TO';
}

/**
 * Estimate confidence for an inferred relationship (0-1).
 */
function estimateRelationshipConfidence(
  e1: ExtractedEntity,
  e2: ExtractedEntity,
): number {
  let confidence = 0.4; // Base confidence for co-occurrence

  // Strong entity types (company, person) boost confidence
  const strongTypes: EntityType[] = ['company', 'person'];
  if (strongTypes.includes(e1.type)) confidence += 0.15;
  if (strongTypes.includes(e2.type)) confidence += 0.15;

  return Math.min(0.95, confidence);
}

/**
 * Populate the graph from structured intelligence data.
 * This is the primary graph construction pipeline:
 * it takes extracted entities and relationships and builds nodes/edges.
 */
export function populateGraphFromIntelligence(
  entities: GraphEntityExtraction[],
  sourceDescription: string = 'unknown',
): { nodesAdded: number; edgesAdded: number } {
  let nodesAdded = 0;
  let edgesAdded = 0;

  // Phase 1: Create or update nodes
  const nodeIdMap = new Map<string, string>();

  for (const extraction of entities) {
    const { entity, graphType } = extraction;
    const nodeId = generateNodeId(graphType, entity.normalized);

    const existing = nodeStore.get(nodeId);
    if (!existing) {
      addNodeSync({
        id: nodeId,
        label: entity.normalized,
        type: graphType,
        aliases: entity.text !== entity.normalized ? [entity.text] : [],
        properties: {},
        source: sourceDescription,
        confidence: 0.5,
      });
      nodesAdded++;
    }

    nodeIdMap.set(entity.normalized, nodeId);
  }

  // Phase 2: Create edges from suggested relationships
  for (const extraction of entities) {
    const sourceNodeId = nodeIdMap.get(extraction.entity.normalized);
    if (!sourceNodeId) continue;

    for (const rel of extraction.suggestedRelationships) {
      const targetNodeId = nodeIdMap.get(rel.targetLabel);
      if (!targetNodeId) continue;

      const edgeId = generateEdgeId(sourceNodeId, rel.relationship, targetNodeId);
      const existing = edgeStore.get(edgeId);

      if (!existing) {
        addEdgeSync({
          id: edgeId,
          sourceId: sourceNodeId,
          targetId: targetNodeId,
          relationship: rel.relationship,
          weight: rel.confidence * 0.8,
          confidence: rel.confidence,
          reason: rel.reason,
          source: sourceDescription,
          evidenceIds: [],
        });
        edgesAdded++;
      }
    }
  }

  return { nodesAdded, edgesAdded };
}

// ── Graph Traversal ────────────────────────────────────────────────

/**
 * Traversal configuration for graph queries.
 */
export interface TraversalConfig {
  /** Maximum hops from origin (default 2). */
  maxHops: number;
  /** Minimum edge weight to traverse (default 0.2). */
  minWeight: number;
  /** Maximum number of results (default 50). */
  maxResults: number;
  /** Edge types to include (empty = all). */
  allowedRelationships?: RelationshipType[];
  /** Edge types to exclude. */
  excludedRelationships?: RelationshipType[];
  /** Node types to include (empty = all). */
  allowedNodeTypes?: GraphEntityType[];
  /** Whether to follow edges in both directions (default true). */
  bidirectional?: boolean;
  /** Hop penalty factor — score multiplied by this per hop (default 0.85). */
  hopPenalty?: number;
}

const DEFAULT_TRAVERSAL_CONFIG: TraversalConfig = {
  maxHops: 2,
  minWeight: 0.2,
  maxResults: 50,
  bidirectional: true,
  hopPenalty: 0.85,
};

/**
 * Breadth-first traversal from a starting node.
 * Returns all reachable nodes within the configured hop limit.
 */
export function traverseBFS(
  startNodeId: string,
  config: Partial<TraversalConfig> = {},
): Array<{ node: GraphNode; path: GraphPath; distance: number }> {
  const cfg = { ...DEFAULT_TRAVERSAL_CONFIG, ...config };
  const startNode = nodeStore.get(startNodeId);
  if (!startNode) return [];

  const results: Array<{ node: GraphNode; path: GraphPath; distance: number }> = [];
  const visited = new Set<string>([startNodeId]);
  const queue: Array<{
    nodeId: string;
    pathNodes: Array<{ id: string; label: string; type: GraphEntityType }>;
    pathEdges: GraphPath['edges'];
    distance: number;
    cumulativeScore: number;
    cumulativeConfidence: number;
  }> = [{
    nodeId: startNodeId,
    pathNodes: [{ id: startNodeId, label: startNode.label, type: startNode.type }],
    pathEdges: [],
    distance: 0,
    cumulativeScore: 1,
    cumulativeConfidence: 1,
  }];

  while (queue.length > 0 && results.length < cfg.maxResults) {
    const current = queue.shift()!;

    // Don't traverse further if we've exceeded hop limit
    if (current.distance >= cfg.maxHops) continue;

    // Get edges to traverse
    let edgesToTraverse: GraphEdge[] = [
      ...getOutgoingEdges(current.nodeId),
    ];

    if (cfg.bidirectional) {
      edgesToTraverse = [
        ...edgesToTraverse,
        ...getIncomingEdges(current.nodeId),
      ];
    }

    for (const edge of edgesToTraverse) {
      // Determine the target node
      const isOutgoing = edge.sourceId === current.nodeId;
      const nextNodeId = isOutgoing ? edge.targetId : edge.sourceId;

      if (visited.has(nextNodeId)) continue;
      if (edge.weight < cfg.minWeight) continue;
      if (cfg.allowedRelationships && !cfg.allowedRelationships.includes(edge.relationship)) continue;
      if (cfg.excludedRelationships && cfg.excludedRelationships.includes(edge.relationship)) continue;

      const nextNode = nodeStore.get(nextNodeId);
      if (!nextNode) continue;
      if (cfg.allowedNodeTypes && !cfg.allowedNodeTypes.includes(nextNode.type)) continue;

      visited.add(nextNodeId);

      const newDistance = current.distance + 1;
      const hopPenalty = cfg.hopPenalty || 0.85;
      const newCumulativeScore = current.cumulativeScore * edge.weight * hopPenalty;
      const newCumulativeConfidence = current.cumulativeConfidence * edge.confidence;

      const path: GraphPath = {
        nodes: [...current.pathNodes, { id: nextNodeId, label: nextNode.label, type: nextNode.type }],
        edges: [...current.pathEdges, {
          id: edge.id,
          relationship: edge.relationship,
          weight: edge.weight,
          confidence: edge.confidence,
          reason: edge.reason,
        }],
        totalScore: newCumulativeScore,
        totalConfidence: newCumulativeConfidence,
        hops: newDistance,
      };

      results.push({ node: nextNode, path, distance: newDistance });

      // Continue BFS if within hop limit
      if (newDistance < cfg.maxHops) {
        queue.push({
          nodeId: nextNodeId,
          pathNodes: path.nodes,
          pathEdges: path.edges,
          distance: newDistance,
          cumulativeScore: newCumulativeScore,
          cumulativeConfidence: newCumulativeConfidence,
        });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.path.totalScore - a.path.totalScore);
  return results;
}

/**
 * Find all paths between two nodes within a hop limit.
 * Used for evidence chain construction.
 */
export function findPaths(
  sourceId: string,
  targetId: string,
  config: Partial<TraversalConfig> = {},
): GraphPath[] {
  const cfg = { ...DEFAULT_TRAVERSAL_CONFIG, ...config };
  const sourceNode = nodeStore.get(sourceId);
  const targetNode = nodeStore.get(targetId);
  if (!sourceNode || !targetNode) return [];
  if (sourceId === targetId) return [];

  const results: GraphPath[] = [];
  const visited = new Set<string>([sourceId]);

  function dfs(
    currentId: string,
    pathNodes: Array<{ id: string; label: string; type: GraphEntityType }>,
    pathEdges: GraphPath['edges'],
    score: number,
    confidence: number,
  ): void {
    if (results.length >= (cfg.maxResults || 10)) return;

    if (currentId === targetId) {
      results.push({
        nodes: [...pathNodes],
        edges: [...pathEdges],
        totalScore: score,
        totalConfidence: confidence,
        hops: pathEdges.length,
      });
      return;
    }

    let edges = getOutgoingEdges(currentId);
    if (cfg.bidirectional) {
      edges = [...edges, ...getIncomingEdges(currentId)];
    }

    for (const edge of edges) {
      const nextId = edge.sourceId === currentId ? edge.targetId : edge.sourceId;
      if (visited.has(nextId)) continue;
      if (edge.weight < cfg.minWeight) continue;
      if (cfg.allowedRelationships && !cfg.allowedRelationships.includes(edge.relationship)) continue;
      if (cfg.excludedRelationships && cfg.excludedRelationships.includes(edge.relationship)) continue;

      const nextNode = nodeStore.get(nextId);
      if (!nextNode) continue;

      visited.add(nextId);

      const hopPenalty = cfg.hopPenalty || 0.85;
      dfs(
        nextId,
        [...pathNodes, { id: nextId, label: nextNode.label, type: nextNode.type }],
        [...pathEdges, { id: edge.id, relationship: edge.relationship, weight: edge.weight, confidence: edge.confidence, reason: edge.reason }],
        score * edge.weight * hopPenalty,
        confidence * edge.confidence,
      );

      visited.delete(nextId);
    }
  }

  dfs(sourceId, [{ id: sourceId, label: sourceNode.label, type: sourceNode.type }], [], 1, 1);

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Find the shortest path (by hops) between two nodes.
 */
export function findShortestPath(sourceId: string, targetId: string): GraphPath | null {
  const paths = findPaths(sourceId, targetId, { maxHops: 5, maxResults: 1 });
  return paths[0] || null;
}

// ── Graph Reasoning ────────────────────────────────────────────────

/**
 * Expand from a starting entity to discover related entities
 * and build evidence chains. This is the primary graph reasoning entry point.
 */
export function expandFromEntity(
  nodeId: string,
  config: Partial<TraversalConfig> = {},
): GraphExpansionResult {
  const startTime = Date.now();
  const node = nodeStore.get(nodeId);
  if (!node) {
    return {
      originNode: { id: nodeId, label: 'unknown', type: 'generic' },
      entities: [],
      totalDiscovered: 0,
      maxHops: config.maxHops || 2,
      evidenceChains: [],
      latencyMs: Date.now() - startTime,
    };
  }

  const traversalResults = traverseBFS(nodeId, config);
  const entities = traversalResults.map(({ node: discoveredNode, path }) => ({
    node: discoveredNode,
    relationships: path.edges.map(edge => {
      const viaNode = path.nodes.length > 2
        ? { id: path.nodes[path.nodes.length - 2].id, label: path.nodes[path.nodes.length - 2].label }
        : undefined;
      return { edge: edgeStore.get(edge.id)!, viaNode };
    }),
    score: path.totalScore,
  }));

  // Build evidence chains for high-scoring paths
  const evidenceChains = buildEvidenceChains(node, traversalResults);

  return {
    originNode: { id: node.id, label: node.label, type: node.type },
    entities,
    totalDiscovered: traversalResults.length,
    maxHops: config.maxHops || 2,
    evidenceChains,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Build evidence chains from traversal results.
 * An evidence chain connects the origin to a discovered entity
 * through a reasoning narrative.
 */
function buildEvidenceChains(
  origin: GraphNode,
  results: Array<{ node: GraphNode; path: GraphPath; distance: number }>,
): EvidenceChain[] {
  const chains: EvidenceChain[] = [];

  for (const result of results.slice(0, 5)) { // Top 5 results get evidence chains
    if (result.path.totalConfidence < 0.3) continue; // Skip low-confidence paths

    const narrative = buildChainNarrative(origin, result.node, result.path);
    const signals = extractSignalsFromPath(result.path);

    chains.push({
      chainId: `chain-${origin.id}-${result.node.id}-${Date.now()}`,
      question: `How is ${origin.label} related to ${result.node.label}?`,
      originNode: { id: origin.id, label: origin.label, type: origin.type },
      targetNodes: [{ id: result.node.id, label: result.node.label, type: result.node.type }],
      paths: [result.path],
      narrative,
      discoveredSignals: signals,
      confidence: result.path.totalConfidence,
      referencedEntityIds: result.path.nodes.map(n => n.id),
      timestamp: new Date().toISOString(),
    });
  }

  return chains;
}

/**
 * Build a human-readable narrative explaining a graph path.
 */
function buildChainNarrative(
  origin: GraphNode,
  target: GraphNode,
  path: GraphPath,
): string {
  if (path.edges.length === 0) return '';

  if (path.edges.length === 1) {
    const edge = path.edges[0];
    return `${origin.label} ${formatRelationship(edge.relationship, true)} ${target.label}. ${edge.reason}`;
  }

  // Multi-hop narrative
  const steps: string[] = [];
  for (let i = 0; i < path.edges.length; i++) {
    const edge = path.edges[i];
    const fromLabel = path.nodes[i].label;
    const toLabel = path.nodes[i + 1].label;
    steps.push(`${fromLabel} ${formatRelationship(edge.relationship, true)} ${toLabel}`);
  }

  return `Path: ${steps.join(' → ')}. ` +
    `This ${path.hops}-hop connection links ${origin.label} to ${target.label} ` +
    `with ${Math.round(path.totalConfidence * 100)}% confidence.`;
}

/**
 * Format a relationship type for human-readable narrative.
 */
function formatRelationship(relationship: RelationshipType, presentTense: boolean): string {
  const pastMapping: Partial<Record<RelationshipType, string>> = {
    WORKS_AT: 'works at',
    WORKED_AT: 'worked at',
    BOARD_MEMBER_OF: 'is a board member of',
    REPORTS_TO: 'reports to',
    PARTNERS_WITH: 'partners with',
    COMPETES_WITH: 'competes with',
    ACQUIRED_BY: 'was acquired by',
    INVESTED_IN: 'invested in',
    SUPPLIES_TO: 'supplies to',
    VENDOR_FOR: 'is a vendor for',
    USES_TECHNOLOGY: 'uses',
    DEPLOYS_ON: 'deploys on',
    MIGRATED_FROM: 'migrated from',
    MIGRATED_TO: 'is migrating to',
    INTEGRATES_WITH: 'integrates with',
    BUILDS_ON: 'builds on',
    HAS_SIGNAL: 'has signal',
    INDICATES_OPPORTUNITY: 'indicates opportunity for',
    MATCHES_CAPABILITY: 'matches capability',
    INFLUENCES: 'influences',
    MENTIONS: 'mentions',
    SUPPORTS_CLAIM: 'supports the claim about',
    CONTRADICTS_CLAIM: 'contradicts the claim about',
    HAPPENED_BEFORE: 'happened before',
    HAPPENED_DURING: 'happened during',
    DERIVED_FROM: 'was derived from',
    EXTRACTED_FROM: 'was extracted from',
    RELATED_TO: 'is related to',
    SIMILAR_TO: 'is similar to',
  };

  return pastMapping[relationship] || relationship.toLowerCase().replace(/_/g, ' ');
}

/**
 * Extract actionable signals from a graph path.
 */
function extractSignalsFromPath(path: GraphPath): EvidenceChain['discoveredSignals'] {
  const signals: EvidenceChain['discoveredSignals'] = [];

  for (const edge of path.edges) {
    if (edge.relationship === 'HAS_SIGNAL' || edge.relationship === 'INDICATES_OPPORTUNITY') {
      signals.push({
        type: edge.relationship,
        description: edge.reason,
        confidence: edge.confidence,
      });
    }

    // Technology change signals
    if (edge.relationship === 'MIGRATED_FROM' || edge.relationship === 'MIGRATED_TO') {
      signals.push({
        type: 'technology_migration',
        description: edge.reason,
        confidence: edge.confidence,
      });
    }

    // Leadership change signals
    if (edge.relationship === 'WORKS_AT' && path.nodes.length > 1) {
      signals.push({
        type: 'person_association',
        description: `${path.nodes[0].label} connects to ${path.nodes[path.nodes.length - 1].label} via personnel`,
        confidence: edge.confidence * 0.7,
      });
    }
  }

  return signals;
}

// ── Graph-Based Recommendations ────────────────────────────────────

/**
 * Generate graph-based recommendations.
 * This is the primary "intelligence reasoning" entry point.
 */
export function generateRecommendations(
  input: GraphRecommendationInput,
): GraphRecommendation[] {
  const recommendations: GraphRecommendation[] = [];
  const startNode = nodeStore.get(input.entityId);
  if (!startNode) return [];

  const maxHops = input.maxHops || 2;
  const minWeight = input.minWeight || 0.3;
  const limit = input.limit || 10;

  // Traverse from the entity
  const results = traverseBFS(input.entityId, {
    maxHops,
    minWeight,
    maxResults: limit * 3, // Over-fetch for filtering
    allowedNodeTypes: input.targetType,
  });

  for (const result of results.slice(0, limit)) {
    const rec = buildRecommendation(startNode, result, input.type);
    if (rec) recommendations.push(rec);
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build a single recommendation from a traversal result.
 */
function buildRecommendation(
  origin: GraphNode,
  result: { node: GraphNode; path: GraphPath; distance: number },
  recommendationType: string,
): GraphRecommendation | null {
  if (result.path.totalConfidence < 0.2) return null;

  const reason = buildRecommendationReason(origin, result.node, result.path, recommendationType);
  const signals = buildRecommendationSignals(result.path);
  const actions = buildSuggestedActions(origin, result.node, result.path, recommendationType);

  return {
    id: `rec-${origin.id}-${result.node.id}-${Date.now()}`,
    type: recommendationType,
    entity: { id: result.node.id, label: result.node.label, type: result.node.type },
    reason,
    evidencePath: result.path,
    confidence: result.path.totalConfidence,
    signals,
    suggestedActions: actions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a human-readable recommendation reason.
 */
function buildRecommendationReason(
  origin: GraphNode,
  target: GraphNode,
  path: GraphPath,
  type: string,
): string {
  const relationshipSummary = path.edges
    .map(e => formatRelationship(e.relationship, true))
    .join(' → ');

  switch (type) {
    case 'similar_companies':
      return `${origin.label} and ${target.label} share ${path.edges.length} relationship(s): ${relationshipSummary}. ` +
        `These connections suggest comparable business profiles and market positioning.`;

    case 'influence_mapping':
      return `${origin.label} is connected to ${target.label} through: ${relationshipSummary}. ` +
        `This ${path.hops}-hop influence path suggests ${target.label} may impact decisions related to ${origin.label}.`;

    case 'opportunity_signals':
      return `Signal path from ${origin.label} to ${target.label}: ${relationshipSummary}. ` +
        `This ${path.hops}-hop connection reveals potential opportunity indicators with ${Math.round(path.totalConfidence * 100)}% confidence.`;

    case 'technology_fit':
      return `Technology relationship: ${origin.label} — ${relationshipSummary} — ${target.label}. ` +
        `This suggests a technology alignment that could indicate modernization opportunity or migration potential.`;

    case 'contact_suggestion':
      return `${target.label} is reachable from ${origin.label} via ${relationshipSummary}. ` +
        `This connection may provide warm introduction potential for engagement.`;

    case 'competitive_landscape':
      return `Competitive connection: ${origin.label} — ${relationshipSummary} — ${target.label}. ` +
        `This ${path.hops}-hop competitive relationship suggests market overlap or competitive dynamics.`;

    default:
      return `${origin.label} is connected to ${target.label} through: ${relationshipSummary}.`;
  }
}

/**
 * Extract relevant signals from a recommendation path.
 */
function buildRecommendationSignals(
  path: GraphPath,
): GraphRecommendation['signals'] {
  const signals: GraphRecommendation['signals'] = [];

  for (const edge of path.edges) {
    // Signal-bearing relationships
    if (['HAS_SIGNAL', 'INDICATES_OPPORTUNITY', 'MIGRATED_FROM', 'MIGRATED_TO', 'INVESTED_IN'].includes(edge.relationship)) {
      signals.push({
        type: edge.relationship,
        description: edge.reason,
        weight: edge.weight,
      });
    }
  }

  return signals;
}

/**
 * Suggest actions based on recommendation type and path analysis.
 */
function buildSuggestedActions(
  origin: GraphNode,
  target: GraphNode,
  path: GraphPath,
  type: string,
): string[] {
  const actions: string[] = [];

  switch (type) {
    case 'opportunity_signals':
      actions.push(`Research ${target.label}'s recent ${path.edges[0]?.relationship === 'HAS_SIGNAL' ? 'signals' : 'changes'}`);
      if (path.hops <= 2) actions.push('Prioritize outreach — strong connection exists');
      actions.push('Check for matching capabilities in your solution portfolio');
      break;

    case 'technology_fit':
      actions.push(`Assess ${target.label}'s technology stack alignment`);
      actions.push('Prepare technology migration pitch if applicable');
      actions.push('Identify case studies from similar technology transitions');
      break;

    case 'contact_suggestion':
      actions.push(`Reach out to ${target.label} for warm introduction`);
      actions.push('Prepare shared context from common relationships');
      break;

    case 'competitive_landscape':
      actions.push(`Monitor ${target.label}'s competitive positioning`);
      actions.push('Identify differentiation opportunities');
      actions.push('Track competitive win/loss patterns');
      break;

    case 'similar_companies':
      actions.push(`Apply insights from ${origin.label} engagement to ${target.label}`);
      actions.push('Cross-reference success patterns');
      break;

    case 'influence_mapping':
      actions.push(`Map ${target.label}'s decision influence on ${origin.label}`);
      actions.push('Identify key stakeholders in the influence chain');
      break;
  }

  return actions;
}

// ── Cross-Entity Reasoning ─────────────────────────────────────────

/**
 * Answer complex multi-entity questions using graph traversal.
 * Example: "Why should we approach this company now?"
 *
 * This aggregates signals, relationships, and evidence chains
 * to produce a comprehensive reasoning output.
 */
export function reasonAboutEntity(
  entityId: string,
  questionType: 'why_now' | 'similar_to' | 'opportunity_for' | 'risk_from' | 'who_influences' | 'technology_fit',
  context?: Record<string, unknown>,
): {
  answer: string;
  evidenceChains: EvidenceChain[];
  keyEntities: Array<{ id: string; label: string; type: GraphEntityType; relevance: number }>;
  signals: Array<{ type: string; description: string; confidence: number }>;
  confidence: number;
  latencyMs: number;
} {
  const startTime = Date.now();
  const node = nodeStore.get(entityId);
  if (!node) {
    return {
      answer: `Entity ${entityId} not found in knowledge graph.`,
      evidenceChains: [],
      keyEntities: [],
      signals: [],
      confidence: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  // Expand from the entity with broader traversal for reasoning
  const expansion = expandFromEntity(entityId, { maxHops: 3, maxResults: 30 });

  // Collect all signals from evidence chains
  const allSignals = expansion.evidenceChains.flatMap(c => c.discoveredSignals);

  // Identify key entities by traversal score
  const keyEntities = expansion.entities.slice(0, 10).map(e => ({
    id: e.node.id,
    label: e.node.label,
    type: e.node.type,
    relevance: e.score,
  }));

  // Build the answer based on question type
  const answer = buildReasoningAnswer(node, expansion, questionType, context);

  // Calculate overall confidence
  const confidence = expansion.evidenceChains.length > 0
    ? Math.max(...expansion.evidenceChains.map(c => c.confidence))
    : expansion.entities.length > 0
      ? expansion.entities[0].score
      : 0;

  return {
    answer,
    evidenceChains: expansion.evidenceChains.slice(0, 3),
    keyEntities,
    signals: allSignals.slice(0, 10),
    confidence,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Build a contextual reasoning answer based on question type.
 */
function buildReasoningAnswer(
  node: GraphNode,
  expansion: GraphExpansionResult,
  questionType: string,
  _context?: Record<string, unknown>,
): string {
  const parts: string[] = [];

  switch (questionType) {
    case 'why_now': {
      const signals = expansion.evidenceChains
        .flatMap(c => c.discoveredSignals)
        .filter(s => ['HAS_SIGNAL', 'INDICATES_OPPORTUNITY', 'technology_migration'].includes(s.type));

      const relationships = expansion.entities
        .filter(e => ['signal', 'event', 'financial'].includes(e.node.type))
        .slice(0, 5);

      parts.push(`Analysis for ${node.label}:`);

      if (signals.length > 0) {
        parts.push(`Detected ${signals.length} active signal(s):`);
        for (const signal of signals.slice(0, 3)) {
          parts.push(`  - ${signal.description} (${Math.round(signal.confidence * 100)}% confidence)`);
        }
      }

      if (relationships.length > 0) {
        parts.push(`Connected ${relationships.length} relevant intelligence item(s):`);
        for (const rel of relationships) {
          parts.push(`  - ${rel.node.label} (${rel.node.type}): score ${Math.round(rel.score * 100)}%`);
        }
      }

      if (signals.length === 0 && relationships.length === 0) {
        parts.push('No immediate signals or time-sensitive intelligence found.');
        parts.push('Consider expanding the search or checking for recent data ingestion.');
      }

      if (expansion.evidenceChains.length > 0) {
        parts.push(`Evidence: ${expansion.evidenceChains.length} chain(s) available with average confidence ${Math.round(expansion.evidenceChains.reduce((s, c) => s + c.confidence, 0) / expansion.evidenceChains.length * 100)}%.`);
      }

      break;
    }

    case 'similar_to': {
      const similar = expansion.entities
        .filter(e => e.node.type === node.type)
        .slice(0, 5);

      parts.push(`Entities similar to ${node.label} (${node.type}):`);
      if (similar.length > 0) {
        for (const s of similar) {
          const relationships = s.relationships.map(r => formatRelationship(r.edge.relationship, true)).join(', ');
          parts.push(`  - ${s.node.label}: connected via ${relationships} (score: ${Math.round(s.score * 100)}%)`);
        }
      } else {
        parts.push('  No similar entities found in the knowledge graph.');
      }
      break;
    }

    case 'opportunity_for': {
      const opportunities = expansion.evidenceChains
        .filter(c => c.discoveredSignals.some(s => s.type === 'INDICATES_OPPORTUNITY'));

      const capabilities = expansion.entities
        .filter(e => e.node.type === 'capability');

      parts.push(`Opportunity analysis for ${node.label}:`);
      if (opportunities.length > 0) {
        for (const opp of opportunities) {
          parts.push(`  - ${opp.narrative}`);
        }
      }
      if (capabilities.length > 0) {
        parts.push(`  Matching capabilities: ${capabilities.map(c => c.node.label).join(', ')}`);
      }
      if (opportunities.length === 0 && capabilities.length === 0) {
        parts.push('  No direct opportunities identified. Expand graph data for better analysis.');
      }
      break;
    }

    case 'who_influences': {
      const people = expansion.entities
        .filter(e => e.node.type === 'person')
        .slice(0, 5);

      parts.push(`Influence mapping for ${node.label}:`);
      if (people.length > 0) {
        for (const p of people) {
          const rels = p.relationships.map(r => `${formatRelationship(r.edge.relationship, true)} ${r.viaNode?.label || ''}`).join(', ');
          parts.push(`  - ${p.node.label}: ${rels} (score: ${Math.round(p.score * 100)}%)`);
        }
      } else {
        parts.push('  No people connected to this entity in the knowledge graph.');
      }
      break;
    }

    case 'technology_fit': {
      const techs = expansion.entities
        .filter(e => ['technology', 'product'].includes(e.node.type))
        .slice(0, 5);

      parts.push(`Technology landscape for ${node.label}:`);
      if (techs.length > 0) {
        for (const t of techs) {
          const rels = t.relationships.map(r => formatRelationship(r.edge.relationship, true)).join(', ');
          parts.push(`  - ${t.node.label}: ${rels} (score: ${Math.round(t.score * 100)}%)`);
        }
      } else {
        parts.push('  No technology connections found.');
      }
      break;
    }

    default:
      parts.push(`Graph analysis for ${node.label}: ${expansion.totalDiscovered} connected entities discovered across ${expansion.maxHops} hops.`);
  }

  return parts.join('\n');
}

// ── Graph Statistics & Management ──────────────────────────────────

/**
 * Get comprehensive graph statistics.
 */
export function getGraphStats(): GraphStats {
  let totalEdgeWeight = 0;
  let totalEdgeConfidence = 0;
  const nodesByType = {} as Record<GraphEntityType, number>;
  const edgesByRelationship = {} as Partial<Record<RelationshipType, number>>;

  for (const node of nodeStore.values()) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }

  for (const edge of edgeStore.values()) {
    totalEdgeWeight += edge.weight;
    totalEdgeConfidence += edge.confidence;
    edgesByRelationship[edge.relationship] = (edgesByRelationship[edge.relationship] || 0) + 1;
  }

  const totalNodes = nodeStore.size;
  const totalEdges = edgeStore.size;

  // Estimate connected components (simplified — using BFS from unvisited nodes)
  let connectedComponents = 0;
  const visitedGlobal = new Set<string>();

  for (const nodeId of nodeStore.keys()) {
    if (visitedGlobal.has(nodeId)) continue;
    connectedComponents++;

    const bfsVisited = traverseBFS(nodeId, { maxHops: 10, maxResults: 9999 });
    for (const r of bfsVisited) {
      visitedGlobal.add(r.node.id);
    }
    visitedGlobal.add(nodeId);
  }

  const isolationRatio = totalNodes > 0
    ? 1 - (totalNodes - connectedComponents) / totalNodes
    : 0;

  return {
    totalNodes,
    totalEdges,
    nodesByType,
    edgesByRelationship,
    averageEdgeWeight: totalEdges > 0 ? totalEdgeWeight / totalEdges : 0,
    averageEdgeConfidence: totalEdges > 0 ? totalEdgeConfidence / totalEdges : 0,
    connectedComponents,
    isolationRatio,
  };
}

/**
 * Clear the entire graph (for testing).
 */
export function clearGraph(): void {
  nodeStore.clear();
  edgeStore.clear();
  sourceEdgeIndex.clear();
  targetEdgeIndex.clear();
  labelIndex.clear();
  typeIndex.clear();
  relationshipIndex.clear();
  seeded = false;
}

/**
 * WI-18.2 Phase 3: Get raw Map references for cold-start hydration and
 * shadow-mode reconciliation. Returns Map copies to prevent external mutation.
 */
export function getKnowledgeGraphMaps(): {
  nodeStore: ReadonlyMap<string, GraphNode>;
  edgeStore: ReadonlyMap<string, GraphEdge>;
  sourceEdgeIndex: ReadonlyMap<string, string[]>;
  targetEdgeIndex: ReadonlyMap<string, string[]>;
  labelIndex: ReadonlyMap<string, string[]>;
  typeIndex: ReadonlyMap<string, string[]>;
  relationshipIndex: ReadonlyMap<string, string[]>;
} {
  return {
    nodeStore,
    edgeStore,
    sourceEdgeIndex,
    targetEdgeIndex,
    labelIndex,
    typeIndex,
    relationshipIndex,
  };
}

/**
 * WI-18.2 Phase 3: Bulk-insert nodes during cold-start hydration.
 * Rebuilds derived indices after insertion. Skips persistence writes
 * (data is already loaded from DB).
 */
export function hydrateNodes(nodes: GraphNode[]): void {
  for (const node of nodes) {
    nodeStore.set(node.id, node);
    // Rebuild derived indices
    const normalizedLabel = normalizeLabel(node.label);
    const labelNodes = labelIndex.get(normalizedLabel) || [];
    if (!labelNodes.includes(node.id)) {
      labelNodes.push(node.id);
      labelIndex.set(normalizedLabel, labelNodes);
    }
    const typeNodes = typeIndex.get(node.type) || [];
    if (!typeNodes.includes(node.id)) {
      typeNodes.push(node.id);
      typeIndex.set(node.type, typeNodes);
    }
    for (const alias of node.aliases || []) {
      const normAlias = normalizeLabel(alias);
      const aliasNodes = labelIndex.get(normAlias) || [];
      if (!aliasNodes.includes(node.id)) {
        aliasNodes.push(node.id);
        labelIndex.set(normAlias, aliasNodes);
      }
    }
  }
  logger.info(`[cold-start] Hydrated ${nodes.length} nodes into knowledge graph (indices rebuilt)`);
}

/**
 * WI-18.2 Phase 3: Bulk-insert edges during cold-start hydration.
 * Rebuilds derived indices after insertion.
 */
export function hydrateEdges(edges: GraphEdge[]): void {
  for (const edge of edges) {
    edgeStore.set(edge.id, edge);
    // Source edge index
    const srcEdges = sourceEdgeIndex.get(edge.sourceId) || [];
    if (!srcEdges.includes(edge.id)) {
      srcEdges.push(edge.id);
      sourceEdgeIndex.set(edge.sourceId, srcEdges);
    }
    // Target edge index
    const tgtEdges = targetEdgeIndex.get(edge.targetId) || [];
    if (!tgtEdges.includes(edge.id)) {
      tgtEdges.push(edge.id);
      targetEdgeIndex.set(edge.targetId, tgtEdges);
    }
    // Relationship index
    const relEdges = relationshipIndex.get(edge.relationship) || [];
    if (!relEdges.includes(edge.id)) {
      relEdges.push(edge.id);
      relationshipIndex.set(edge.relationship, relEdges);
    }
  }
  logger.info(`[cold-start] Hydrated ${edges.length} edges into knowledge graph (indices rebuilt)`);
}

/**
 * Get all nodes in the graph.
 */
export function getAllNodes(): GraphNode[] {
  return Array.from(nodeStore.values());
}

/**
 * Get all edges in the graph.
 */
export function getAllEdges(): GraphEdge[] {
  return Array.from(edgeStore.values());
}

// ── P1.2: Cold Start from DB ──────────────────────────────────────

/**
 * Ensure the in-memory graph is populated — either from DB or seed data.
 * Call once on module initialization. Idempotent: no-ops if already seeded.
 *
 * P1.2 strategy:
 *   1. If seeded flag is set → return immediately.
 *   2. Try loading from DB via warmGraphCacheFromDb().
 *   3. If DB has data → populate in-memory maps + indices → set seeded.
 *   4. If DB is empty → caller should fall through to seedKnowledgeGraph().
 */
export async function ensureGraphLoaded(): Promise<boolean> {
  if (seeded) return true;

  try {
    const { nodes, edges } = await warmGraphCacheFromDb();

    if (nodes.length > 0 || edges.length > 0) {
      // Use hydrateNodes/hydrateEdges to rebuild all indices
      const graphNodes = nodes.map(n => nodeFromDb(n as unknown as Record<string, unknown>));
      const graphEdges = edges.map(e => edgeFromDb(e as unknown as Record<string, unknown>));

      for (const n of graphNodes) {
        nodeStore.set(n.id, n);
      }
      for (const e of graphEdges) {
        edgeStore.set(e.id, e);
      }

      // Rebuild derived indices
      for (const n of graphNodes) {
        const normalizedLabel = normalizeLabel(n.label);
        const labelNodes = labelIndex.get(normalizedLabel) || [];
        if (!labelNodes.includes(n.id)) {
          labelNodes.push(n.id);
          labelIndex.set(normalizedLabel, labelNodes);
        }
        const typeNodes = typeIndex.get(n.type) || [];
        if (!typeNodes.includes(n.id)) {
          typeNodes.push(n.id);
          typeIndex.set(n.type, typeNodes);
        }
        for (const alias of n.aliases || []) {
          const normAlias = normalizeLabel(alias);
          const aliasNodes = labelIndex.get(normAlias) || [];
          if (!aliasNodes.includes(n.id)) {
            aliasNodes.push(n.id);
            labelIndex.set(normAlias, aliasNodes);
          }
        }
      }
      for (const e of graphEdges) {
        const srcEdges = sourceEdgeIndex.get(e.sourceId) || [];
        if (!srcEdges.includes(e.id)) {
          srcEdges.push(e.id);
          sourceEdgeIndex.set(e.sourceId, srcEdges);
        }
        const tgtEdges = targetEdgeIndex.get(e.targetId) || [];
        if (!tgtEdges.includes(e.id)) {
          tgtEdges.push(e.id);
          targetEdgeIndex.set(e.targetId, tgtEdges);
        }
        const relEdges = relationshipIndex.get(e.relationship) || [];
        if (!relEdges.includes(e.id)) {
          relEdges.push(e.id);
          relationshipIndex.set(e.relationship, relEdges);
        }
      }

      logger.info('[P1.2] Loaded graph from DB', { nodes: nodes.length, edges: edges.length });
      seeded = true;
      return true;
    }
  } catch (err) {
    logger.warn('[P1.2] ensureGraphLoaded failed, falling back to seed data', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return false;
}

// ── Seed Data ──────────────────────────────────────────────────────

/**
 * Seed the knowledge graph with a realistic enterprise dataset.
 * This represents the kind of interconnected intelligence that
 * makes graph reasoning valuable.
 *
 * P1.2: In production, prefer ensureGraphLoaded() to hydrate from DB.
 * This seed function is kept as fallback for empty databases.
 */
export function seedKnowledgeGraph(): void {
  if (seeded) return;
  seeded = true;

  // ── Companies ──
  const companies = [
    { id: 'co-acme', label: 'Acme Corp', aliases: ['Acme Corporation', 'Acme'], properties: { industry: 'Technology', revenue: '$2.5B', employees: 12000 } },
    { id: 'co-globex', label: 'Globex Inc', aliases: ['Globex', 'Globex International'], properties: { industry: 'Financial Services', revenue: '$5.1B', employees: 28000 } },
    { id: 'co-initech', label: 'Initech Systems', aliases: ['Initech'], properties: { industry: 'Technology', revenue: '$800M', employees: 4500 } },
    { id: 'co-umbrella', label: 'Umbrella Corp', aliases: ['Umbrella'], properties: { industry: 'Healthcare', revenue: '$1.8B', employees: 9000 } },
    { id: 'co-stark', label: 'Stark Industries', aliases: ['Stark'], properties: { industry: 'Manufacturing', revenue: '$12B', employees: 50000 } },
    { id: 'co-wayne', label: 'Wayne Enterprises', aliases: ['Wayne'], properties: { industry: 'Conglomerate', revenue: '$30B', employees: 85000 } },
    { id: 'co-cyberdyne', label: 'Cyberdyne Systems', aliases: ['Cyberdyne'], properties: { industry: 'Technology', revenue: '$3B', employees: 15000 } },
    { id: 'co-oscorp', label: 'Oscorp Industries', aliases: ['Oscorp'], properties: { industry: 'Biotechnology', revenue: '$2.1B', employees: 11000 } },
  ];

  for (const c of companies) {
    addNodeSync({ id: c.id, label: c.label, type: 'company', aliases: c.aliases, properties: c.properties, confidence: 0.95 });
  }

  // ── People ──
  const people = [
    { id: 'p-sarah', label: 'Sarah Chen', aliases: ['S. Chen'], properties: { title: 'CTO', seniority: 'executive' } },
    { id: 'p-james', label: 'James Rodriguez', aliases: ['J. Rodriguez'], properties: { title: 'VP Engineering', seniority: 'vp' } },
    { id: 'p-emily', label: 'Emily Park', aliases: ['E. Park'], properties: { title: 'Cloud Architect', seniority: 'director' } },
    { id: 'p-michael', label: 'Michael Torres', aliases: ['M. Torres'], properties: { title: 'CIO', seniority: 'executive' } },
    { id: 'p-lisa', label: 'Lisa Wang', aliases: ['L. Wang'], properties: { title: 'Head of IT', seniority: 'director' } },
    { id: 'p-david', label: 'David Kim', aliases: ['D. Kim'], properties: { title: 'VP Product', seniority: 'vp' } },
    { id: 'p-alex', label: 'Alex Foster', aliases: ['A. Foster'], properties: { title: 'CISO', seniority: 'vp' } },
    { id: 'p-rachel', label: 'Rachel Green', aliases: ['R. Green'], properties: { title: 'Director of Engineering', seniority: 'director' } },
  ];

  for (const p of people) {
    addNodeSync({ id: p.id, label: p.label, type: 'person', aliases: p.aliases, properties: p.properties, confidence: 0.9 });
  }

  // ── Technologies ──
  const technologies = [
    { id: 't-aws', label: 'AWS', aliases: ['Amazon Web Services'], properties: { category: 'cloud', vendor: 'Amazon' } },
    { id: 't-azure', label: 'Azure', aliases: ['Microsoft Azure'], properties: { category: 'cloud', vendor: 'Microsoft' } },
    { id: 't-gcp', label: 'GCP', aliases: ['Google Cloud Platform'], properties: { category: 'cloud', vendor: 'Google' } },
    { id: 't-kubernetes', label: 'Kubernetes', aliases: ['K8s'], properties: { category: 'container_orchestration' } },
    { id: 't-terraform', label: 'Terraform', aliases: ['HashiCorp Terraform'], properties: { category: 'iac' } },
    { id: 't-python', label: 'Python', aliases: [], properties: { category: 'language' } },
    { id: 't-typescript', label: 'TypeScript', aliases: ['TS'], properties: { category: 'language' } },
    { id: 't-erp', label: 'Legacy ERP', aliases: ['SAP ERP', 'Oracle ERP'], properties: { category: 'enterprise_software' } },
    { id: 't-salesforce', label: 'Salesforce', aliases: ['SFDC'], properties: { category: 'crm' } },
    { id: 't-docker', label: 'Docker', aliases: [], properties: { category: 'containerization' } },
    { id: 't-react', label: 'React', aliases: ['React.js'], properties: { category: 'framework' } },
    { id: 't-postgresql', label: 'PostgreSQL', aliases: ['Postgres'], properties: { category: 'database' } },
  ];

  for (const t of technologies) {
    addNodeSync({ id: t.id, label: t.label, type: 'technology', aliases: t.aliases, properties: t.properties, confidence: 0.95 });
  }

  // ── Capabilities ──
  const capabilities = [
    { id: 'cap-cloud-migration', label: 'Cloud Migration', properties: { category: 'infrastructure' } },
    { id: 'cap-cybersecurity', label: 'Cybersecurity Assessment', properties: { category: 'security' } },
    { id: 'cap-data-analytics', label: 'Data Analytics Platform', properties: { category: 'data' } },
    { id: 'cap-devops', label: 'DevOps Transformation', properties: { category: 'engineering' } },
    { id: 'cap-ai-ml', label: 'AI/ML Implementation', properties: { category: 'ai' } },
    { id: 'cap-digital-transformation', label: 'Digital Transformation', properties: { category: 'strategy' } },
  ];

  for (const c of capabilities) {
    addNodeSync({ id: c.id, label: c.label, type: 'capability', aliases: [], properties: c.properties, confidence: 0.85 });
  }

  // ── Industries ──
  const industries = [
    { id: 'ind-fintech', label: 'FinTech', aliases: ['Financial Technology'] },
    { id: 'ind-healthtech', label: 'HealthTech', aliases: ['Healthcare Technology'] },
    { id: 'ind-manufacturing', label: 'Manufacturing', aliases: ['Advanced Manufacturing'] },
    { id: 'ind-biotech', label: 'Biotechnology', aliases: ['Biotech'] },
  ];

  for (const ind of industries) {
    addNodeSync({ id: ind.id, label: ind.label, type: 'industry', aliases: ind.aliases, properties: {}, confidence: 0.9 });
  }

  // ── Signals ──
  const signals = [
    { id: 'sig-acme-funding', label: 'Acme Series D Funding', properties: { signalType: 'funding', severity: 'high' } },
    { id: 'sig-globex-ciso', label: 'Globex CISO Departure', properties: { signalType: 'leadership_change', severity: 'critical' } },
    { id: 'sig-initech-cloud', label: 'Initech Cloud Migration Initiative', properties: { signalType: 'tech_change', severity: 'high' } },
    { id: 'sig-umbrella-breach', label: 'Umbrella Security Breach', properties: { signalType: 'news', severity: 'critical' } },
    { id: 'sig-stark-partnership', label: 'Stark-Oscorp Partnership', properties: { signalType: 'partnership', severity: 'medium' } },
    { id: 'sig-cyberdyne-ai', label: 'Cyberdyne AI Investment', properties: { signalType: 'investment', severity: 'high' } },
    { id: 'sig-wayne-expansion', label: 'Wayne Asia Expansion', properties: { signalType: 'expansion', severity: 'medium' } },
  ];

  for (const s of signals) {
    addNodeSync({ id: s.id, label: s.label, type: 'signal', aliases: [], properties: s.properties, confidence: 0.8 });
  }

  // ── Relationships (Edges) ──
  const edges: Array<Omit<GraphEdge, 'createdAt'>> = [
    // Organizational
    { id: 'e-sarah-acme', sourceId: 'p-sarah', targetId: 'co-acme', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Sarah Chen is CTO at Acme Corp', evidenceIds: [] },
    { id: 'e-james-acme', sourceId: 'p-james', targetId: 'co-acme', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'James Rodriguez is VP Engineering at Acme Corp', evidenceIds: [] },
    { id: 'e-emily-globex', sourceId: 'p-emily', targetId: 'co-globex', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Emily Park is Cloud Architect at Globex Inc', evidenceIds: [] },
    { id: 'e-michael-initech', sourceId: 'p-michael', targetId: 'co-initech', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Michael Torres is CIO at Initech Systems', evidenceIds: [] },
    { id: 'e-lisa-umbrella', sourceId: 'p-lisa', targetId: 'co-umbrella', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Lisa Wang is Head of IT at Umbrella Corp', evidenceIds: [] },
    { id: 'e-david-stark', sourceId: 'p-david', targetId: 'co-stark', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'David Kim is VP Product at Stark Industries', evidenceIds: [] },
    { id: 'e-alex-wayne', sourceId: 'p-alex', targetId: 'co-wayne', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Alex Foster is CISO at Wayne Enterprises', evidenceIds: [] },
    { id: 'e-rachel-cyberdyne', sourceId: 'p-rachel', targetId: 'co-cyberdyne', relationship: 'WORKS_AT', weight: 0.9, confidence: 0.95, reason: 'Rachel Green is Director of Engineering at Cyberdyne Systems', evidenceIds: [] },
    { id: 'e-james-sarah', sourceId: 'p-james', targetId: 'p-sarah', relationship: 'REPORTS_TO', weight: 0.85, confidence: 0.9, reason: 'James reports to Sarah Chen', evidenceIds: [] },

    // Technology usage
    { id: 'e-acme-aws', sourceId: 'co-acme', targetId: 't-aws', relationship: 'USES_TECHNOLOGY', weight: 0.85, confidence: 0.9, reason: 'Acme Corp runs on AWS', evidenceIds: [] },
    { id: 'e-globex-azure', sourceId: 'co-globex', targetId: 't-azure', relationship: 'USES_TECHNOLOGY', weight: 0.85, confidence: 0.9, reason: 'Globex Inc uses Azure for cloud services', evidenceIds: [] },
    { id: 'e-initech-erp', sourceId: 'co-initech', targetId: 't-erp', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.85, reason: 'Initech uses legacy ERP system', evidenceIds: [] },
    { id: 'e-initech-aws', sourceId: 'co-initech', targetId: 't-aws', relationship: 'USES_TECHNOLOGY', weight: 0.7, confidence: 0.7, reason: 'Initech has some AWS workloads', evidenceIds: [] },
    { id: 'e-umbrella-gcp', sourceId: 'co-umbrella', targetId: 't-gcp', relationship: 'USES_TECHNOLOGY', weight: 0.85, confidence: 0.9, reason: 'Umbrella Corp deploys on GCP', evidenceIds: [] },
    { id: 'e-stark-salesforce', sourceId: 'co-stark', targetId: 't-salesforce', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.85, reason: 'Stark Industries uses Salesforce CRM', evidenceIds: [] },
    { id: 'e-wayne-python', sourceId: 'co-wayne', targetId: 't-python', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.8, reason: 'Wayne Enterprises uses Python extensively', evidenceIds: [] },
    { id: 'e-cyberdyne-react', sourceId: 'co-cyberdyne', targetId: 't-react', relationship: 'USES_TECHNOLOGY', weight: 0.75, confidence: 0.8, reason: 'Cyberdyne uses React for frontend', evidenceIds: [] },
    { id: 'e-oscorp-typescript', sourceId: 'co-oscorp', targetId: 't-typescript', relationship: 'USES_TECHNOLOGY', weight: 0.75, confidence: 0.8, reason: 'Oscorp uses TypeScript', evidenceIds: [] },
    { id: 'e-acme-kubernetes', sourceId: 'co-acme', targetId: 't-kubernetes', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.85, reason: 'Acme Corp uses Kubernetes for container orchestration', evidenceIds: [] },
    { id: 'e-acme-terraform', sourceId: 'co-acme', targetId: 't-terraform', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.85, reason: 'Acme uses Terraform for IaC', evidenceIds: [] },
    { id: 'e-acme-docker', sourceId: 'co-acme', targetId: 't-docker', relationship: 'USES_TECHNOLOGY', weight: 0.85, confidence: 0.9, reason: 'Acme uses Docker for containerization', evidenceIds: [] },
    { id: 'e-acme-postgresql', sourceId: 'co-acme', targetId: 't-postgresql', relationship: 'USES_TECHNOLOGY', weight: 0.8, confidence: 0.85, reason: 'Acme uses PostgreSQL as primary database', evidenceIds: [] },

    // Technology integrations
    { id: 'e-k8s-docker', sourceId: 't-kubernetes', targetId: 't-docker', relationship: 'BUILDS_ON', weight: 0.95, confidence: 0.99, reason: 'Kubernetes orchestrates Docker containers', evidenceIds: [] },
    { id: 'e-terraform-k8s', sourceId: 't-terraform', targetId: 't-kubernetes', relationship: 'INTEGRATES_WITH', weight: 0.85, confidence: 0.9, reason: 'Terraform provisions Kubernetes clusters', evidenceIds: [] },
    { id: 'e-react-typescript', sourceId: 't-react', targetId: 't-typescript', relationship: 'INTEGRATES_WITH', weight: 0.9, confidence: 0.95, reason: 'React is commonly used with TypeScript', evidenceIds: [] },
    { id: 'e-aws-k8s', sourceId: 't-aws', targetId: 't-kubernetes', relationship: 'DEPLOYS_ON', weight: 0.9, confidence: 0.95, reason: 'AWS runs Kubernetes via EKS', evidenceIds: [] },
    { id: 'e-azure-k8s', sourceId: 't-azure', targetId: 't-kubernetes', relationship: 'DEPLOYS_ON', weight: 0.9, confidence: 0.95, reason: 'Azure runs Kubernetes via AKS', evidenceIds: [] },
    { id: 'e-gcp-k8s', sourceId: 't-gcp', targetId: 't-kubernetes', relationship: 'DEPLOYS_ON', weight: 0.9, confidence: 0.95, reason: 'GCP runs Kubernetes via GKE', evidenceIds: [] },

    // Industry
    { id: 'e-globex-fintech', sourceId: 'co-globex', targetId: 'ind-fintech', relationship: 'RELATED_TO', weight: 0.9, confidence: 0.95, reason: 'Globex operates in FinTech sector', evidenceIds: [] },
    { id: 'e-umbrella-healthtech', sourceId: 'co-umbrella', targetId: 'ind-healthtech', relationship: 'RELATED_TO', weight: 0.9, confidence: 0.95, reason: 'Umbrella Corp in HealthTech sector', evidenceIds: [] },
    { id: 'e-stark-manufacturing', sourceId: 'co-stark', targetId: 'ind-manufacturing', relationship: 'RELATED_TO', weight: 0.9, confidence: 0.95, reason: 'Stark Industries in manufacturing', evidenceIds: [] },
    { id: 'e-oscorp-biotech', sourceId: 'co-oscorp', targetId: 'ind-biotech', relationship: 'RELATED_TO', weight: 0.9, confidence: 0.95, reason: 'Oscorp Industries in biotechnology', evidenceIds: [] },

    // Competitive relationships
    { id: 'e-acme-initech-compete', sourceId: 'co-acme', targetId: 'co-initech', relationship: 'COMPETES_WITH', weight: 0.7, confidence: 0.75, reason: 'Acme and Initech compete in cloud infrastructure', evidenceIds: [] },
    { id: 'e-azure-aws-compete', sourceId: 't-azure', targetId: 't-aws', relationship: 'COMPETES_WITH', weight: 0.85, confidence: 0.95, reason: 'Azure and AWS are major cloud competitors', evidenceIds: [] },

    // Partnerships
    { id: 'e-stark-oscorp', sourceId: 'co-stark', targetId: 'co-oscorp', relationship: 'PARTNERS_WITH', weight: 0.8, confidence: 0.85, reason: 'Stark Industries and Oscorp announced partnership', evidenceIds: [] },
    { id: 'e-acme-wayne', sourceId: 'co-acme', targetId: 'co-wayne', relationship: 'PARTNERS_WITH', weight: 0.7, confidence: 0.75, reason: 'Acme Corp and Wayne Enterprises have strategic partnership', evidenceIds: [] },

    // Signals connected to entities
    { id: 'e-acme-funding', sourceId: 'co-acme', targetId: 'sig-acme-funding', relationship: 'HAS_SIGNAL', weight: 0.85, confidence: 0.9, reason: 'Acme raised Series D — indicates growth capital availability', evidenceIds: [] },
    { id: 'e-globex-ciso', sourceId: 'co-globex', targetId: 'sig-globex-ciso', relationship: 'HAS_SIGNAL', weight: 0.9, confidence: 0.95, reason: 'Globex CISO departed — security leadership gap', evidenceIds: [] },
    { id: 'e-initech-cloud', sourceId: 'co-initech', targetId: 'sig-initech-cloud', relationship: 'HAS_SIGNAL', weight: 0.85, confidence: 0.9, reason: 'Initech announced cloud migration — modernization opportunity', evidenceIds: [] },
    { id: 'e-umbrella-breach', sourceId: 'co-umbrella', targetId: 'sig-umbrella-breach', relationship: 'HAS_SIGNAL', weight: 0.95, confidence: 0.98, reason: 'Umbrella suffered security breach — urgent security needs', evidenceIds: [] },
    { id: 'e-stark-partnership', sourceId: 'co-stark', targetId: 'sig-stark-partnership', relationship: 'HAS_SIGNAL', weight: 0.75, confidence: 0.8, reason: 'Stark-Oscorp partnership creates ecosystem opportunity', evidenceIds: [] },
    { id: 'e-cyberdyne-ai', sourceId: 'co-cyberdyne', targetId: 'sig-cyberdyne-ai', relationship: 'HAS_SIGNAL', weight: 0.8, confidence: 0.85, reason: 'Cyberdyne investing in AI — technology opportunity', evidenceIds: [] },
    { id: 'e-wayne-expansion', sourceId: 'co-wayne', targetId: 'sig-wayne-expansion', relationship: 'HAS_SIGNAL', weight: 0.7, confidence: 0.8, reason: 'Wayne expanding to Asia — growth signals', evidenceIds: [] },

    // Opportunities
    { id: 'e-initech-cloud-opp', sourceId: 'sig-initech-cloud', targetId: 'cap-cloud-migration', relationship: 'INDICATES_OPPORTUNITY', weight: 0.85, confidence: 0.9, reason: 'Cloud migration signal matches cloud migration capability', evidenceIds: [] },
    { id: 'e-globex-ciso-opp', sourceId: 'sig-globex-ciso', targetId: 'cap-cybersecurity', relationship: 'INDICATES_OPPORTUNITY', weight: 0.9, confidence: 0.95, reason: 'CISO departure signal matches cybersecurity assessment capability', evidenceIds: [] },
    { id: 'e-umbrella-breach-opp', sourceId: 'sig-umbrella-breach', targetId: 'cap-cybersecurity', relationship: 'INDICATES_OPPORTUNITY', weight: 0.95, confidence: 0.98, reason: 'Security breach signal creates urgent cybersecurity opportunity', evidenceIds: [] },
    { id: 'e-cyberdyne-ai-opp', sourceId: 'sig-cyberdyne-ai', targetId: 'cap-ai-ml', relationship: 'INDICATES_OPPORTUNITY', weight: 0.8, confidence: 0.85, reason: 'AI investment signal matches AI/ML implementation capability', evidenceIds: [] },
    { id: 'e-stark-devops', sourceId: 'co-stark', targetId: 'cap-devops', relationship: 'MATCHES_CAPABILITY', weight: 0.7, confidence: 0.75, reason: 'Manufacturing company likely needs DevOps transformation', evidenceIds: [] },

    // Migration paths
    { id: 'e-initech-erp-migrate', sourceId: 'co-initech', targetId: 't-erp', relationship: 'MIGRATED_FROM', weight: 0.8, confidence: 0.85, reason: 'Initech migrating away from legacy ERP', observedAt: '2025-06-15', evidenceIds: [] },
    { id: 'e-initech-k8s-migrate', sourceId: 'co-initech', targetId: 't-kubernetes', relationship: 'MIGRATED_TO', weight: 0.75, confidence: 0.8, reason: 'Initech migrating to Kubernetes architecture', observedAt: '2025-07-01', evidenceIds: [] },

    // Cross-entity influence
    { id: 'e-emily-influence', sourceId: 'p-emily', targetId: 'sig-initech-cloud', relationship: 'INFLUENCES', weight: 0.6, confidence: 0.65, reason: 'Emily Park as cloud architect influences cloud migration decisions at Globex', evidenceIds: [] },
    { id: 'e-alex-security', sourceId: 'p-alex', targetId: 'cap-cybersecurity', relationship: 'INFLUENCES', weight: 0.7, confidence: 0.75, reason: 'Alex Foster as CISO influences security procurement at Wayne', evidenceIds: [] },
  ];

  for (const edge of edges) {
    addEdgeSync(edge);
  }

  logger.info('[WI-16G] Knowledge graph seeded', {
    nodes: nodeStore.size,
    edges: edgeStore.size,
    companies: companies.length,
    people: people.length,
    technologies: technologies.length,
    signals: signals.length,
    capabilities: capabilities.length,
  });
}

// ── Helpers ────────────────────────────────────────────────────────

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim();
}

function generateNodeId(type: GraphEntityType, normalized: string): string {
  return `${type}:${normalized.toLowerCase().replace(/\s+/g, '-')}`;
}

function generateEdgeId(sourceId: string, relationship: RelationshipType, targetId: string): string {
  return `edge:${sourceId}:${relationship}:${targetId}`;
}
