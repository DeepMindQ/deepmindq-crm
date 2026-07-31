/**
 * Intelligence API Layer — Public Exports
 *
 * This module is the SINGLE integration surface between frontend and intelligence.
 * Import from here to access types and middleware.
 *
 * Phase 3: Added brief, grounding, retrieval endpoints + foundation engine re-exports
 */

// ── Types (for frontend consumption) ──
export type {
  IntelligenceResponse,
  IntelligenceMeta,
  IntelligenceEndpoint,
  IntelligenceInclude,
  FreshnessInfo,

  IntelligenceCompanyContext,
  IntelligenceSignal,
  IntelligenceContact,
  IntelligenceTimelineEvent,
  IntelligenceBrief,
  IntelligenceMindmapSummary,

  IntelligenceReasoningOutput,
  ReasoningStep,

  IntelligenceOpportunity,

  IntelligenceActionOutput,

  IntelligenceConversationOutput,

  IntelligenceMindmap,
  MindmapNode,
  MindmapEdge,

  IntelligenceBriefOutput,
  IntelligenceGroundingOutput,
  IntelligenceRetrievalOutput,

  IntelligenceKnowledgeOutput,
  IntelligenceKnowledgeEntry,
  IntelligenceKnowledgeGroup,
  IntelligenceKnowledgeIngestionStats,

  IntelligenceErrorCode,
  normalizeTierForDisplay,
  getTierColor,
} from './types';

// ── Middleware (for route handlers) ──
export {
  parseIncludeParams,
  shouldInclude,
  shouldIncludeAny,
  createResponse,
  createErrorResponse,
  computeFreshness,
} from './middleware';
export type { IntelligenceErrorResponse } from './middleware';

// ── Validators (Zod schemas for request validation) ──
export {
  companyIdSchema,
  includeSchema,
  pageSchema,
  limitSchema,
  companyIntelligenceSchema,
  reasoningIntelligenceSchema,
  opportunityIntelligenceSchema,
  actionIntelligenceSchema,
  conversationIntelligenceSchema,
  mindmapIntelligenceSchema,
  briefIntelligenceSchema,
  groundingIntelligenceSchema,
  retrievalIntelligenceSchema,
  knowledgeIntelligenceSchema,
  intelligenceValidators,
} from './validators';

// ── Handler utilities (scrubError used by routes for sensitive data protection) ──
export { scrubError } from './handler';

// ── Types from validators ──
export type {
  CompanyIntelligenceInput,
  ReasoningIntelligenceInput,
  OpportunityIntelligenceInput,
  ActionIntelligenceInput,
  ConversationIntelligenceInput,
  MindmapIntelligenceInput,
  BriefIntelligenceInput,
  GroundingIntelligenceInput,
  RetrievalIntelligenceInput,
  KnowledgeIntelligenceInput,
} from './validators';

// ── Foundation Engines (internal composition use, re-exported for Intelligence API routes) ──
export { GroundingEngine } from '@/lib/engines/grounding-engine';
export type {
  Evidence,
  EvidenceChain,
  EvidenceGap,
  EvidenceType,
  GroundingContext,
} from '@/lib/engines/grounding-engine';

export { RetrievalEngine } from '@/lib/engines/retrieval-engine';
export type {
  EmbeddableEntityType,
  EmbeddingResult,
  RetrievalResult,
  RetrievalStats,
} from '@/lib/engines/retrieval-engine';

export { SynthesisEngine } from '@/lib/engines/synthesis-engine';
export type {
  Brief,
  BriefSection,
  BriefCitation,
  BriefDepth,
  BriefRequest,
  BriefType,
} from '@/lib/engines/synthesis-engine';
