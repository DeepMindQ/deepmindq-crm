/**
 * Intelligence API Layer — Public Exports
 *
 * This module is the SINGLE integration surface between frontend and intelligence.
 * Import from here to access types and middleware.
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

  IntelligenceErrorCode,
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
