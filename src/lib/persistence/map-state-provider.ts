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

/**
 * Create and register the Map state provider.
 *
 * This function:
 *   - Imports the AI modules dynamically (to avoid circular deps)
 *   - Maps each store to its corresponding Map
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
          entries: maps.nodeStore as unknown as Map<string, unknown>,
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
          entries: maps.edgeStore as unknown as Map<string, unknown>,
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
          entries: maps.memoryStore as unknown as Map<string, unknown>,
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
          entries: maps.hybridIndex as unknown as Map<string, unknown>,
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
          entries: maps.documentFrequency as unknown as Map<string, unknown>,
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
  logger.info('[map-state-provider] Map state provider wired and registered');
}
