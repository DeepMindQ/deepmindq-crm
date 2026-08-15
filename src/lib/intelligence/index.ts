// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Intelligence OS — Unified Barrel Export
//
// Single entry point for the entire intelligence system.
// Import from here: import { ... } from '@/lib/intelligence'
//
// Sub-modules:
//   - reasoning:    Signal → Insight conversion (LLM + templates)
//   - signals:      Rule-based business signal detection
//   - knowledge-graph: Entity resolution, relationships, graph queries
//   - ingestion:    Data file → structured entities pipeline
// ═══════════════════════════════════════════════════════════════════════════

// Reasoning engine — the "brain"
export {
  reasonAboutOrganization,
  runIntelligencePipeline,
  storeInsights,
  runScheduledReasoning,
  onSignalCreated,
  onIngestionComplete,
  getInsightsForOrganization,
  getLatestBriefing,
  type ReasoningResult,
} from './reasoning';

// Signal engine — the "eyes"
export {
  detectSignalsForOrganization,
  runSignalDetectionForAll,
  storeSignals,
  analyzeSignalWithAI,
  enrichSignalWithWebSearch,
  type DetectedSignal,
  type AIAnalysisResult,
  type WebEnrichmentResult,
} from './signals';

// Knowledge graph — the "memory"
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
  type GraphNode,
  type GraphEdge,
  type GraphSubgraph,
  type EntityMatch,
  type ConnectionPath,
} from './knowledge-graph';

// Ingestion pipeline — the "intake"
export {
  ingestFile,
  processPendingIngestions,
  type IngestionResult,
  type IngestionOptions,
} from './ingestion';
