/**
 * Phase B Engine Architecture — Barrel Export
 * ============================================
 *
 * The 6-engine composable architecture for DeepMindQ AI.
 *
 * Foundation engines (call LLMs / collect evidence / retrieve knowledge):
 *   - ModelRouter       Tiered LLM router (Deep/Smart/Fast)
 *   - GroundingEngine   Evidence chain builder with citations + confidence
 *   - RetrievalEngine   Local semantic search (@xenova/transformers + DB)
 *
 * Composition engines (orchestrate foundation engines to produce output):
 *   - SynthesisEngine      Long-form evidence-grounded briefs
 *
 * (Future sessions will add: ScoringEngine, ActionEngine, ConversationEngine)
 */

export { ModelRouter } from './model-router';
export type { Tier, CompletionParams, CompletionResult } from './model-router';

export { GroundingEngine, renderChainForPrompt } from './grounding-engine';
export type {
  Evidence,
  EvidenceChain,
  EvidenceGap,
  EvidenceType,
  GroundingContext,
} from './grounding-engine';

export { RetrievalEngine } from './retrieval-engine';
export type {
  EmbeddableEntityType,
  EmbeddingResult,
  RetrievalResult,
  RetrievalStats,
} from './retrieval-engine';

export { SynthesisEngine } from './synthesis-engine';
export type {
  Brief,
  BriefCitation,
  BriefDepth,
  BriefRequest,
  BriefSection,
  BriefType,
} from './synthesis-engine';
