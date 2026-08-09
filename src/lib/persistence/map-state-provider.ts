/**
 * WI-18.2 Phase 3 — Map State Provider Implementation
 * ====================================================
 *
 * Bridges the shadow-mode comparator (which needs to snapshot Map state)
 * with the actual in-memory Maps in AI modules (knowledge graph, memory,
 * hybrid retrieval).
 *
 * RESPONSIBILITIES:
 *   1. Provides a MapStateProvider function to the shadow-mode comparator
 *   2. Maps IntelligencePersistenceStore enum values to the correct Map
 *   3. Returns entries + hash function for each store
 *
 * USAGE:
 *   import { wireMapStateProvider } from '@/lib/persistence/map-state-provider';
 *   wireMapStateProvider(); // Called once at startup
 */

import type { IntelligencePersistenceStore } from './types';
import type { MapStateProvider } from './shadow-mode-comparator';
import { registerMapStateProvider } from './shadow-mode-comparator';
import { logger } from '@/lib/logger';
import { LRUCache } from '@/lib/lru-cache';

// ── LRU-bounded Map wrapper ──────────────────────────────────────────
// Wraps a Map in an LRU boundary so unbounded Maps don't grow forever.
// MAX_MAP_ENTRIES = 10000 — when exceeded, oldest entries are evicted.

const MAX_MAP_ENTRIES = 10000;

/**
 * Create an LRU-bounded wrapper around a raw Map.
 * Returns a Proxy that intercepts set/delete/clear to enforce the boundary.
 */
function createBoundedMap<K, V>(rawMap: Map<K, V>, label: string): Map<K, V> {
  // Track insertion order separately via an LRU cache for eviction
  const lru = new LRUCache<K, true>(MAX_MAP_ENTRIES);

  return new Proxy(rawMap, {
    set(target, prop, value) {
      if (typeof prop === 'string') {
        const key = prop as unknown as K;
        // Evict LRU entry if at capacity
        if (target.size >= MAX_MAP_ENTRIES && !target.has(key)) {
          const oldestKey = lru.keys()[0];
          if (oldestKey !== undefined) {
            target.delete(oldestKey);
            lru.delete(oldestKey);
          }
        }
        lru.set(key, true);
      }
      // @ts-expect-error — proxy set
      target[prop] = value;
      return true;
    },
    get(target, prop) {
      if (prop === 'delete') {
        return (key: K) => {
          lru.delete(key);
          return target.delete(key);
        };
      }
      if (prop === 'clear') {
        return () => {
          lru.clear();
          return target.clear();
        };
      }
      // @ts-expect-error — proxy get
      const val = target[prop];
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    },
  });
}

/**
 * Create and register the Map state provider.
 *
 * This function:
 *   - Imports the AI modules dynamically (to avoid circular deps)
 *   - Maps each store to its corresponding Map
 *   - Wraps each Map in an LRU boundary (MAX_MAP_ENTRIES)
 *   - Registers the provider with the shadow-mode comparator
 */
export function wireMapStateProvider(): void {
  const provider: MapStateProvider = (store: IntelligencePersistenceStore) => {
    switch (store) {
      case 'knowledge_graph_nodes': {
        // Dynamic imports to avoid circular dependencies at module load time
        const kg = require('@/lib/ai-knowledge-graph');
        const maps = kg.getKnowledgeGraphMaps() as ReturnType<typeof kg.getKnowledgeGraphMaps>;
        return {
          entries: createBoundedMap(maps.nodeStore as unknown as Map<string, unknown>, 'kg_nodes') as unknown as Map<string, unknown>,
          hashEntry: (key: string, value: unknown) => {
            const node = value as any;
            return `${key}:${node.label}:${node.type}:${node.confidence}`;
          },
        };
      }

      case 'knowledge_graph_edges': {
        const kg = require('@/lib/ai-knowledge-graph');
        const maps = kg.getKnowledgeGraphMaps() as ReturnType<typeof kg.getKnowledgeGraphMaps>;
        return {
          entries: createBoundedMap(maps.edgeStore as unknown as Map<string, unknown>, 'kg_edges') as unknown as Map<string, unknown>,
          hashEntry: (key: string, value: unknown) => {
            const edge = value as any;
            return `${key}:${edge.sourceId}:${edge.targetId}:${edge.relationship}:${edge.weight}`;
          },
        };
      }

      case 'ai_memory': {
        const mem = require('@/lib/ai-memory');
        const maps = mem.getMemoryMaps() as ReturnType<typeof mem.getMemoryMaps>;
        return {
          entries: createBoundedMap(maps.memoryStore as unknown as Map<string, unknown>, 'ai_memory') as unknown as Map<string, unknown>,
          hashEntry: (key: string, value: unknown) => {
            const item = value as any;
            return `${key}:${item.layer}:${item.category}:${item.confidence}:${item.version}`;
          },
        };
      }

      case 'retrieval_index': {
        const ret = require('@/lib/ai-hybrid-retrieval');
        const maps = ret.getRetrievalMaps() as ReturnType<typeof ret.getRetrievalMaps>;
        return {
          entries: createBoundedMap(maps.hybridIndex as unknown as Map<string, unknown>, 'retrieval_index') as unknown as Map<string, unknown>,
          hashEntry: (key: string, value: unknown) => {
            const entry = value as any;
            return `${key}:${entry.entityType}:${entry.source}:${entry.content?.slice(0, 50)}`;
          },
        };
      }

      case 'retrieval_corpus_stats': {
        const ret = require('@/lib/ai-hybrid-retrieval');
        const maps = ret.getRetrievalMaps() as ReturnType<typeof ret.getRetrievalMaps>;
        return {
          entries: createBoundedMap(maps.documentFrequency as unknown as Map<string, unknown>, 'retrieval_corpus_stats') as unknown as Map<string, unknown>,
          hashEntry: (key: string, value: unknown) => {
            return `${key}:${value}`;
          },
        };
      }

      case 'retrieval_metrics': {
        // Metrics store is telemetry-only, no primary Map exists yet.
        // Return empty — this store is not yet populated at the Map level.
        return {
          entries: new Map<string, unknown>(),
          hashEntry: (key: string, value: unknown) => `${key}:${JSON.stringify(value)}`,
        };
      }

      default: {
        logger.warn(`[map-state-provider] Unknown store requested: ${store}`);
        return {
          entries: new Map<string, unknown>(),
          hashEntry: (key: string, value: unknown) => `${key}:${JSON.stringify(value)}`,
        };
      }
    }
  };

  registerMapStateProvider(provider);
  logger.info(`[map-state-provider] Map state provider wired and registered (LRU boundary: ${MAX_MAP_ENTRIES})`);
}
