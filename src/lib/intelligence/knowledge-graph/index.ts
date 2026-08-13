// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Knowledge Graph — Public API
//
// Re-exports the full knowledge graph interface.
// Import from here: import { KnowledgeGraph } from '@/lib/intelligence/knowledge-graph'
// ═══════════════════════════════════════════════════════════════════════════

export {
  resolveEntity,
  mergeOrganizations,
  discoverRelationships,
  createRelationship,
  getSubgraph,
  getConnectionPaths,
  getConnections,
  getGraphStats,
  computeIntelligenceScores,
} from './engine';

export type {
  GraphNode,
  GraphEdge,
  GraphSubgraph,
  EntityMatch,
  ConnectionPath,
} from './engine';
