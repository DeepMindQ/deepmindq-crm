/**
 * AI Revenue Copilot — Barrel Exports
 *
 * Single entry point for the AI Reasoning Engine library.
 * Import from '@/lib/ai-copilot' to access all Phase 8 modules.
 *
 * Module overview:
 *   - types.ts:            Shared TypeScript types and interfaces
 *   - prompt-builder.ts:  LLM prompt construction (system + user prompts)
 *   - evidence-synthesizer.ts: Thematic clustering and evidence selection
 *   - response-parser.ts: LLM JSON output parsing with validation
 *   - guardrails.ts:       AI output quality gates and validation
 *   - reasoning-engine.ts: Main orchestrator (context, generation, retrieval)
 *   - usage-tracker.ts:    AI cost tracking and usage analytics
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  ReasoningContext,
  InsightType,
  StrategicInsightOutput,
  EngagementStrategyOutput,
  EnhancedBriefOutput,
  AIUsageFeature,
  AIUsageRecord,
  ThematicCluster,
  GuardrailCheck,
} from './types';

// ── Prompt Builder ───────────────────────────────────────────────────────────
export {
  buildReasoningPrompt,
  buildStrategyPrompt,
  buildBriefEnhancementPrompt,
} from './prompt-builder';

// ── Evidence Synthesizer ─────────────────────────────────────────────────────
export {
  clusterByTheme,
  rankClusters,
  selectTopEvidence,
} from './evidence-synthesizer';

// ── Response Parser ──────────────────────────────────────────────────────────
export {
  parseReasoningResponse,
  parseStrategyResponse,
  parseBriefResponse,
  sanitizeString,
  validateConfidenceScore,
  validatePriorityScore,
} from './response-parser';

// ── Guardrails ────────────────────────────────────────────────────────────────
export {
  checkReasoningOutput,
  checkStrategyOutput,
  checkBriefOutput,
  guardrailsAllowOutput,
  getGuardrailErrors,
  getGuardrailWarnings,
  MIN_INTELLIGENCE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  MAX_EVIDENCE_CITATIONS,
} from './guardrails';

// ── Reasoning Engine ──────────────────────────────────────────────────────────
export {
  gatherReasoningContext,
  generateStrategicInsight,
  getLatestInsight,
  getInsightHistory,
} from './reasoning-engine';

// ── Strategy Generator ──────────────────────────────────────────────────────
export {
  generateEngagementStrategy,
  getLatestStrategy,
  getStrategyHistory,
} from './strategy-generator';

// ── Brief Enhancer ───────────────────────────────────────────────────────────
export {
  enhanceBrief,
  getEnhancedBrief,
} from './brief-enhancer';

// ── Situation Analyzer ───────────────────────────────────────────────────────
export {
  analyzeSituation,
} from './situation-analyzer';

// ── Usage Tracker ────────────────────────────────────────────────────────────
export {
  estimateCost,
  logAIUsage,
  getUsageStats,
} from './usage-tracker';
