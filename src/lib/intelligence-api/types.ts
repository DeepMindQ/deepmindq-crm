/**
 * Intelligence API Layer — Product Contract Types
 *
 * SINGLE SOURCE OF TRUTH for all frontend intelligence consumption.
 * These are the ONLY response shapes the frontend should receive.
 * All intelligence flows through the Intelligence API Layer —
 * frontend NEVER calls engines or raw DB queries directly.
 *
 * Each endpoint returns an IntelligenceResponse<T> wrapper with
 * metadata about the request, caching, and confidence.
 *
 * IntelligenceEndpoint defines 10 endpoints: 7 core routes under /api/intelligence/
 * (company, reasoning, opportunity, action, conversation, mindmap, brief) plus 3
 * auxiliary routes outside (grounding, retrieval, knowledge).
 */

import type { RevenueScore } from '@/lib/engines/scoring-engine';
import type { ActionResult } from '@/lib/engines/action-engine';
import type { ConversationResult } from '@/lib/engines/conversation-engine';
import type { ReasoningResult } from '@/lib/enterprise-reasoning-engine';
import type { Brief, BriefSection, BriefCitation } from '@/lib/engines/synthesis-engine';
import type { Evidence, EvidenceType, EvidenceChain, EvidenceGap, GroundingContext } from '@/lib/engines/grounding-engine';
import type { RetrievalResult, RetrievalStats, EmbeddableEntityType } from '@/lib/engines/retrieval-engine';

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERIC WRAPPER — Every Intelligence API response uses this envelope
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta: IntelligenceMeta;
}

export interface IntelligenceMeta {
  endpoint: IntelligenceEndpoint;
  companyId: string;
  requestedAt: string;       // ISO 8601
  respondedAt: string;       // ISO 8601
  durationMs: number;
  cached: boolean;
  includes: string[];       // which ?include= params were fulfilled
  confidence: number;         // 0-1 aggregate confidence of the response
  freshness: FreshnessInfo;
  /** Governance metadata — present when AI generation was involved */
  governance?: {
    passed: boolean;
    generationType?: string;
    checks?: Record<string, { passed: boolean; message: string }>;
  };
}

export type IntelligenceEndpoint =
  | 'company'
  | 'reasoning'
  | 'opportunity'
  | 'action'
  | 'conversation'
  | 'mindmap'
  | 'brief'
  | 'grounding'    // route handler outside /api/intelligence/
  | 'retrieval'    // route handler outside /api/intelligence/
  | 'knowledge';   // route handler outside /api/intelligence/

export type IntelligenceInclude =
  // Company endpoint includes
  | 'signals'
  | 'scores'
  | 'contacts'
  | 'timeline'
  | 'actions'
  | 'brief'
  | 'knowledge'
  | 'mindmap'
  | 'learning'
  // Reasoning endpoint includes
  | 'steps'
  | 'impact'
  | 'recommendations'
  // Opportunity endpoint includes
  | 'fusion'
  | 'capabilities'
  // Action endpoint includes
  | 'sequences'
  | 'recommendations'
  // Conversation endpoint includes
  | 'talkingPoints'
  | 'objections'
  | 'buyerProfiles'
  // Mindmap endpoint includes
  | 'nodes'
  | 'edges'
  | 'knowledgeConnections'
  // Brief endpoint includes
  | 'citations'
  // Knowledge endpoint includes
  | 'ingestion';

// NOTE: Ghost entries REMOVED — 'people_changes', 'data_health', 'reasoning', 'opportunities'
// These had zero route implementations. Do NOT re-add without a corresponding route handler.
// Note: 'grounding', 'retrieval', 'knowledge' endpoints defined in IntelligenceEndpoint but route
// handlers live outside the main intelligence routes. 'learning' is accepted globally but only
// action/conversation routes implement it.

// ═══════════════════════════════════════════════════════════════════════════════
//  FRESHNESS — Staleness tracking for all intelligence data
// ═══════════════════════════════════════════════════════════════════════════════

export interface FreshnessInfo {
  level: 'realtime' | 'fresh' | 'aging' | 'stale' | 'very_stale' | 'unknown';
  lastEnriched: string | null;   // ISO 8601
  lastSignal: string | null;     // ISO 8601 (falls back to lastActivityAt)
  score: number;               // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPANY — GET /api/intelligence/company/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceCompanyContext {
  // Core company profile (always present)
  company: {
    id: string;
    rawName: string;
    normalizedName: string;
    domain: string | null;
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    country: string | null;
    website: string | null;
    status: string;
    assignedTo: string | null;
    /** Intelligence score (0-100). Defaults to 0; may be null in DB, normalized to 0 in API. */
    intelligenceScore: number;
    engagementScore: number;
    accountPriorityScore: number | null;
    priorityTier: string | null;
    createdAt: string;
    updatedAt: string;
  };

  // Research card (always present — lightweight DB lookup)
  researchCard: Record<string, unknown> | null;

  // Key people extracted from research (always present — part of researchCard)
  keyPeople: Array<{
    name: string;
    title: string;
    department?: string;
    linkedInUrl?: string;
    source?: string;
  }>;

  // Revenue summary (always present — lightweight AccountScore lookup)
  // Note: Full score breakdown with `revenueOpportunity` requires ?include=scores
  revenueSummary?: {
    score: number;
    category: string;
  };

  // Active signals (?include=signals)
  signals?: IntelligenceSignal[];

  // Intelligence scores (?include=scores)
  /** Three unified scores for a company.
   *  - intelligence: Data quality / research depth score (0-100)
   *  - accountPriority: ICP fit / sales readiness score (0-100)
   *  - revenue: Real-time AI revenue score from ScoringEngine ({ score, grade, confidence })
   *  - revenueOpportunity: Deterministic revenue score from AccountScore table ({ score, category, breakdown })
   *    Note: revenue and revenueOpportunity measure different things — revenue is AI-computed real-time,
   *    revenueOpportunity is deterministic historical scoring from 5 sub-dimensions.
   */
  scores?: {
    intelligence: {
      score: number;
      tier: string;
    };
    accountPriority?: {
      score: number;
      tier: string;
    };
    revenue: RevenueScore;
    revenueOpportunity?: {
      score: number;
      category: string;
      breakdown: {
        intelligenceCoverage: number;
        signalStrength: number;
        freshness: number;
        strategicFit: number;
        engagementHistory: number;
      } | null;
    };
  };

  // Contacts (?include=contacts)
  contacts?: IntelligenceContact[];

  // Company timeline events (?include=timeline)
  timeline?: IntelligenceTimelineEvent[];

  // Recommended actions (?include=actions)
  actions?: ActionResult;

  // AI-generated brief (?include=brief)
  brief?: IntelligenceBrief;

  // Knowledge/fusion data (?include=knowledge)
  knowledge?: {
    capabilities: Array<Record<string, unknown>>;
    caseStudies: Array<Record<string, unknown>>;
  };

  // Mind map summary (?include=mindmap)
  mindmap?: IntelligenceMindmapSummary;

  // Freshness (always present)
  freshness: FreshnessInfo;
}

export interface IntelligenceSignal {
  id: string;
  signalType: string;
  title: string;
  summary: string;
  confidence: number;       // 0-1
  severity: string;
  impact: string;
  source: string;
  evidenceCount: number;
  createdAt: string;
  companyId: string;
}

export interface IntelligenceContact {
  id: string;
  rawName: string;
  title: string | null;
  email: string | null;
  role: string | null;
  phone: string | null;
  companyId: string;
  companyName: string | null;
  leadScore: number;
  confidence: number;
  status: string;
  source: string | null;
  lastActivityAt: string | null;
}

export interface IntelligenceTimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  companyId: string;
}

export interface IntelligenceBrief {
  /** Brief type (account_brief, deal_strategy, exec_summary, contact_brief, opportunity_brief) */
  briefType: string;
  /** Full Markdown content */
  content: string;
  /** Parsed sections with per-section confidence */
  sections: Array<{
    heading: string;
    body: string;
    confidence: number;
    citations: string[];
  }>;
  /** Citation index mapping markers to evidence */
  citations: Array<{
    marker: string;
    evidenceId: string;
    snippet: string;
    url: string | null;
  }>;
  /** Evidence chain used to ground this brief */
  evidenceChain: {
    evidences: Evidence[];
    aggregateConfidence: number;
    coverage: number;
    gaps: EvidenceGap[];
    freshnessScore: number;
  };
  /** Word count */
  wordCount: number;
  /** Model used */
  modelUsed: string;
  /** Overall confidence 0-1 */
  confidence: number;
  /** Generation time in ms */
  durationMs: number;
  /** Token usage */
  tokensUsed: number;
  /** Estimated cost */
  costUsd: number;
  /** Warnings (hallucinated citations, low evidence, objection risks, etc.) */
  warnings: string[];
}

export interface IntelligenceMindmapSummary {
  nodeCount: number;
  edgeCount: number;
  centerNode: string;
  categories: string[];
  lastGenerated: string | null;
}

// ═════════════════════════════════════════════════════════════════════════════════
//  REASONING — GET /api/intelligence/reasoning/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceReasoningOutput {
  companyId: string;
  reasoningContextId: string;
  overallConfidence: number;
  winProbability: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalAIcalls: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
  summary: string | null;
  steps: ReasoningStep[];
  // ?include=impact — extracted from high-confidence impact/risk/value steps
  impact?: Array<{
    stepNumber: number;
    stepName: string;
    summary: string | null;
    confidence: number;
  }>;
  // ?include=recommendations — extracted from action/strategy/recommendation steps
  recommendations?: Array<{
    stepNumber: number;
    stepName: string;
    summary: string | null;
    confidence: number;
  }>;
}

export interface ReasoningStep {
  stepNumber: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  summary: string | null;
  confidence: number;
  durationMs: number | null;
  aiCalls: number;
  tokensUsed: number;
  costUsd: number;
  /** Adaptive reasoning depth (Phase 1.4) */
  depth?: string | null;
  /** Reasoning path identifier for multi-path reasoning */
  pathId?: string | null;
  /** Reason the step was skipped (if status === 'skipped') */
  skippedReason?: string | null;
  /** Identified reasoning gaps for this step */
  reasoningGaps?: unknown[];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OPPORTUNITY — GET /api/intelligence/opportunity/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceOpportunity {
  companyId: string;
  // ?include=scores
  scores?: RevenueScore;
  // ?include=fusion — implied via scores/reasoning/actions composition
  reasoning?: {
    summary: string | null;
    overallConfidence: number;
    winProbability: number;
  };
  // ?include=fusion
  fusion?: Array<{
    externalSignal: string | string[];
    internalCapability: string | string[];
    fusionScore: number;
    businessProblem: string;
    recommendedCapability: string;
    relevantCaseStudy: string | null;
    proofPoints: string[];
    confidenceScore: number;
  }>;
  // ?include=capabilities — not yet implemented, placeholder
  capabilities?: Array<Record<string, unknown>>;
  actions?: ActionResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ACTION — GET /api/intelligence/action/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceActionOutput {
  companyId: string;
  // Present when engine succeeds; absent when engine skipped
  actions?: ActionResult;
  // ?include=learning
  learningInsights?: Array<{
    id: string;
    insight: string;
    sourceCompany: string;
    applicableContext: string;
    createdAt: string;
  }>;
  // ?include=recommendations — extracted from ActionResult.actions
  recommendations?: Array<{
    action: string;
    priority: string;
    rationale: string;
    confidence: number;
  }>;
  // ?include=sequences — extracted from ActionResult.actions (each action becomes a step)
  sequences?: Array<{
    step: number;
    action: string;
    dependsOn: string[];
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONVERSATION — GET /api/intelligence/conversation/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceConversationOutput {
  companyId: string;
  // Core conversation result — present when engine succeeds and runs
  conversation?: ConversationResult;
  // Brief derived from conversation — present when engine succeeds and runs
  brief?: IntelligenceBrief;
  // ?include=talkingPoints — extracted from conversation result
  talkingPoints?: Array<{
    topic: string;
    context: string;
    confidence: number;
  }>;
  // ?include=objections — extracted from conversation result
  objections?: Array<{
    objection: string;
    rebuttal: string;
    confidence: number;
  }>;
  // ?include=buyerProfiles — extracted from conversation result
  buyerProfiles?: Array<{
    role: string;
    concerns: string[];
    motivation: string;
    confidence: number;
  }>;
  // ?include=learning — past learning insights
  pastLearnings?: Array<{
    id: string;
    insight: string;
    sourceCompany: string;
    applicableContext: string;
    createdAt: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MINDMAP — GET /api/intelligence/mindmap/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceMindmap {
  companyId: string;
  // ?include=nodes
  nodes?: MindmapNode[];
  // ?include=edges
  edges?: MindmapEdge[];
  // Always present
  metadata: {
    totalNodes: number;
    totalEdges: number;
    centerNode: string;
    lastGenerated: string | null;
  };
  // ?include=knowledgeConnections
  knowledgeConnections?: Array<{
    sourceNode: string;
    targetNode: string;
    type: string;
    description: string;
    confidence: number;
  }>;
}

export interface MindmapNode {
  id: string;
  label: string;
  type: 'company' | 'person' | 'capability' | 'signal' | 'knowledge';
  confidence: number;
  x?: number;
  y?: number;
  metadata?: Record<string, unknown>;
}

export type MindmapEdge = {
  source: string;
  target: string;
  weight: number;
  label?: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BRIEF — GET /api/intelligence/brief/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceBriefOutput {
  companyId: string;
  brief: IntelligenceBrief;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GROUNDING — GET /api/intelligence/grounding/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceGroundingOutput {
  companyId: string;
  evidences: Evidence[];
  aggregateConfidence: number;
  coverage: number;
  gaps: EvidenceGap[];
  freshnessScore: number;
  evidenceCount: number;
  gapCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RETRIEVAL — GET /api/intelligence/retrieval/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceRetrievalOutput {
  companyId: string;
  results: RetrievalResult[];
  query: string;
  resultCount: number;
  stats: {
    totalEmbeddings: number;
    uniqueEntities: number;
    backend: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════════
//  KNOWLEDGE — GET /api/intelligence/knowledge/{id}
// ═════════════════════════════════════════════════════════════════════════════════

/** A single knowledge entry from KnowledgeFabric */
export interface IntelligenceKnowledgeEntry {
  id: string;
  category: string;
  subCategory: string | null;
  content: string;
  source: string | null;
  confidence: number;
  version: number;
  updatedAt: string;
}

/** Knowledge group (category → entries) */
export interface IntelligenceKnowledgeGroup {
  category: string;
  entryCount: number;
  entries: IntelligenceKnowledgeEntry[];
}

/** Ingestion pipeline statistics */
export interface IntelligenceKnowledgeIngestionStats {
  totalDocuments: number;
  completedDocuments: number;
  totalChunks: number;
  classifiedChunks: number;
  embeddedChunks: number;
  byType: Array<{ type: string; count: number }>;
}

/** Full knowledge output for a company */
export interface IntelligenceKnowledgeOutput {
  companyId: string;
  /** KnowledgeFabric entries grouped by category */
  groups: IntelligenceKnowledgeGroup[];
  /** Total number of knowledge entries */
  totalEntries: number;
  /** Categories with most entries */
  topCategories: Array<{ category: string; count: number }>;
  /** Average confidence across entries */
  averageConfidence: number;
  /** Ingestion pipeline stats (?include=ingestion) */
  ingestionStats?: IntelligenceKnowledgeIngestionStats;
}

// ═════════════════════════════════════════════════════════════════════════════════
//  ERROR TYPES
// ═════════════════════════════════════════════════════════════════════════════════

export const IntelligenceErrors = {
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  MISSING_COMPANY_ID: 'MISSING_COMPANY_ID',
  INTELLIGENCE_UNAVAILABLE: 'INTELLIGENCE_UNAVAILABLE',
  ENGINE_TIMEOUT: 'ENGINE_TIMEOUT',
  ENGINE_FAILED: 'ENGINE_FAILED',
  GOVERNANCE_BLOCKED: 'GOVERNANCE_BLOCKED',
  INVALID_INCLUDE: 'INVALID_INCLUDE',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type IntelligenceErrorCode = typeof IntelligenceErrors[keyof typeof IntelligenceErrors];

// ═══════════════════════════════════════════════════════════════════════════════
//  TIER NORMALIZATION — Unified display across 3 score systems
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize any tier value from the 3 scoring systems into a consistent display string.
 *
 * Input systems:
 *   - Intelligence:  hot, warm, cold, unknown  (lowercase)
 *   - Account Priority: HOT, ACTIVE, NURTURE, LOW  (uppercase enum)
 *   - Revenue: HOT_ACCOUNT, WARM_ACCOUNT, NURTURE, AT_RISK  (uppercase enum with suffix)
 *
 * Output: always returns human-readable display tier.
 */
export function normalizeTierForDisplay(tier: string | null | undefined, scoreSystem: 'intelligence' | 'accountPriority' | 'revenue'): string {
  if (!tier) return 'Unknown';

  switch (scoreSystem) {
    case 'intelligence':
      // Intelligence tiers are already lowercase — just capitalize
      return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();

    case 'accountPriority': {
      const map: Record<string, string> = {
        'HOT': 'High',
        'ACTIVE': 'High',
        'NURTURE': 'Medium',
        'LOW': 'Low',
      };
      return map[tier.toUpperCase()] || tier;
    }

    case 'revenue': {
      const map: Record<string, string> = {
        'HOT_ACCOUNT': 'High',
        'WARM_ACCOUNT': 'Medium',
        'NURTURE': 'Medium',
        'AT_RISK': 'At Risk',
      };
      return map[tier.toUpperCase()] || tier;
    }

    default:
      return tier;
  }
}

/**
 * Get a consistent color for any tier across all 3 scoring systems.
 * Returns a hex color string for use in UI components.
 */
export function getTierColor(tier: string | null | undefined, scoreSystem: 'intelligence' | 'accountPriority' | 'revenue'): string {
  const display = normalizeTierForDisplay(tier, scoreSystem);
  switch (display) {
    case 'High': case 'Hot': return '#059669';
    case 'Medium': case 'Warm': return '#D97706';
    case 'Low': case 'Cold': return '#F59E0B';
    case 'At Risk': return '#DC2626';
    case 'Very Stale': return '#9CA3AF';
    default: return '#9CA3AF';
  }
}
