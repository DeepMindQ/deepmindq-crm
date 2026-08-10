/**
 * WI-18.2 Persistence Registry
 * ==============================
 *
 * Lock L1: All Tier-1 Maps MUST be registered here.
 * The CI scanner (scripts/persistence-registration-scan.js) verifies
 * that no new Tier-1 Maps exist without a registration entry.
 *
 * REGISTRATION RULES:
 *   - Every Map that holds AI intelligence state requiring restart survival
 *     MUST be registered with isPrimary=true.
 *   - Derived index Maps (recomputed from primary data) are registered
 *     with isPrimary=false and a dependsOn reference.
 *   - Registration is enforced in CI — unregistered Tier-1 Maps fail the build.
 */

import type { IntelligencePersistenceStore, PersistentMapRegistration } from './types';

/**
 * The canonical registry of all Tier-1 persistent Maps.
 * This is the single source of truth for what must survive restart.
 */
export const PERSISTENCE_REGISTRY: PersistentMapRegistration[] = [
  // ── Knowledge Graph: Primary Stores ──
  {
    store: 'knowledge_graph_nodes',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'nodeStore',
    description: 'Primary knowledge graph node store — all entity data',
    isPrimary: true,
  },
  {
    store: 'knowledge_graph_edges',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'edgeStore',
    description: 'Primary knowledge graph edge store — all relationship data',
    isPrimary: true,
  },

  // ── Knowledge Graph: Derived Index Maps ──
  {
    store: 'knowledge_graph_nodes',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'sourceEdgeIndex',
    description: 'Derived index: sourceId → edge IDs for forward traversal',
    isPrimary: false,
    dependsOn: 'knowledge_graph_edges',
  },
  {
    store: 'knowledge_graph_nodes',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'targetEdgeIndex',
    description: 'Derived index: targetId → edge IDs for reverse traversal',
    isPrimary: false,
    dependsOn: 'knowledge_graph_edges',
  },
  {
    store: 'knowledge_graph_nodes',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'labelIndex',
    description: 'Derived index: normalized label → node IDs for entity resolution',
    isPrimary: false,
    dependsOn: 'knowledge_graph_nodes',
  },
  {
    store: 'knowledge_graph_nodes',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'typeIndex',
    description: 'Derived index: nodeType → node IDs for type-scoped queries',
    isPrimary: false,
    dependsOn: 'knowledge_graph_nodes',
  },
  {
    store: 'knowledge_graph_edges',
    sourceFile: 'src/lib/ai-knowledge-graph.ts',
    mapName: 'relationshipIndex',
    description: 'Derived index: relationshipType → edge IDs for relationship queries',
    isPrimary: false,
    dependsOn: 'knowledge_graph_edges',
  },

  // ── AI Memory: Primary Store ──
  {
    store: 'ai_memory',
    sourceFile: 'src/lib/ai-memory.ts',
    mapName: 'memoryStore',
    description: 'Primary AI memory store — all memory items',
    isPrimary: true,
  },

  // ── AI Memory: Derived Index Maps ──
  {
    store: 'ai_memory',
    sourceFile: 'src/lib/ai-memory.ts',
    mapName: 'layerIndex',
    description: 'Derived index: memory layer → memory IDs',
    isPrimary: false,
    dependsOn: 'ai_memory',
  },
  {
    store: 'ai_memory',
    sourceFile: 'src/lib/ai-memory.ts',
    mapName: 'categoryIndex',
    description: 'Derived index: memory category → memory IDs',
    isPrimary: false,
    dependsOn: 'ai_memory',
  },
  {
    store: 'ai_memory',
    sourceFile: 'src/lib/ai-memory.ts',
    mapName: 'scopeIndex',
    description: 'Derived index: scope entity ID → memory IDs',
    isPrimary: false,
    dependsOn: 'ai_memory',
  },
  {
    store: 'ai_memory',
    sourceFile: 'src/lib/ai-memory.ts',
    mapName: 'tagIndex',
    description: 'Derived index: tag → memory IDs',
    isPrimary: false,
    dependsOn: 'ai_memory',
  },

  // ── Hybrid Retrieval: Primary Store ──
  {
    store: 'retrieval_index',
    sourceFile: 'src/lib/ai-hybrid-retrieval.ts',
    mapName: 'hybridIndex',
    description: 'Primary hybrid retrieval index — all indexed entries',
    isPrimary: true,
  },

  // ── Hybrid Retrieval: Corpus Statistics ──
  {
    store: 'retrieval_corpus_stats',
    sourceFile: 'src/lib/ai-hybrid-retrieval.ts',
    mapName: 'documentFrequency',
    description: 'IDF statistics: term → document frequency count',
    isPrimary: true,
  },
  {
    store: 'retrieval_corpus_stats',
    sourceFile: 'src/lib/ai-hybrid-retrieval.ts',
    mapName: 'indexTimestamps',
    description: 'Index insertion timestamps for LRU eviction tracking',
    isPrimary: false,
    dependsOn: 'retrieval_index',
  },

  // ── Financial Intelligence: Cached Profiles ──
  {
    store: 'financial_profiles',
    sourceFile: 'src/app/api/companies/enrich/route.ts',
    mapName: 'N/A (write-through from enrich pipeline)',
    description: 'Cached financial profiles computed by the enrichment pipeline — keyed by companyId',
    isPrimary: true,
  },
] as const;

/** Get all primary (non-derived) persistence stores. */
export function getPrimaryStores(): IntelligencePersistenceStore[] {
  const stores = new Set<IntelligencePersistenceStore>();
  for (const reg of PERSISTENCE_REGISTRY) {
    if (reg.isPrimary) stores.add(reg.store);
  }
  return Array.from(stores);
}

/** Get all unique persistence stores (primary + derived). */
export function getAllStores(): IntelligencePersistenceStore[] {
  const stores = new Set<IntelligencePersistenceStore>();
  for (const reg of PERSISTENCE_REGISTRY) {
    stores.add(reg.store);
  }
  return Array.from(stores);
}

/** Check if a store has any primary (data) registrations. */
export function isPrimaryStore(store: IntelligencePersistenceStore): boolean {
  return PERSISTENCE_REGISTRY.some(r => r.store === store && r.isPrimary);
}

/** Get registrations for a specific store. */
export function getRegistrationsForStore(store: IntelligencePersistenceStore): PersistentMapRegistration[] {
  return PERSISTENCE_REGISTRY.filter(r => r.store === store);
}
