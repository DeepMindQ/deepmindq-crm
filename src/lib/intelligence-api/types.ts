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
 */

import type { RevenueScore } from '@/lib/engines/scoring-engine';
import type { ActionResult } from '@/lib/engines/action-engine';
import type { ConversationResult } from '@/lib/engines/conversation-engine';
import type { ReasoningResult } from '@/lib/enterprise-reasoning-engine';

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
}

export type IntelligenceEndpoint =
  | 'company'
  | 'reasoning'
  | 'opportunity'
  | 'action'
  | 'conversation'
  | 'mindmap';

export type IntelligenceInclude =
  | 'signals'
  | 'scores'
  | 'contacts'
  | 'timeline'
  | 'actions'
  | 'brief'
  | 'knowledge'
  | 'mindmap'
  | 'reasoning'
  | 'opportunities'
  | 'learning'
  | 'data_health'
  | 'people_changes'
  | 'steps';

// ═══════════════════════════════════════════════════════════════════════════════
//  FRESHNESS — Staleness tracking for all intelligence data
// ═══════════════════════════════════════════════════════════════════════════════

export interface FreshnessInfo {
  level: 'realtime' | 'fresh' | 'aging' | 'stale' | 'unknown';
  lastEnriched: string | null;   // ISO 8601
  lastSignal: string | null;     // ISO 8601
  score: number;               // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPANY — GET /api/intelligence/company/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceCompanyContext {
  // Core company profile
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
    intelligenceScore: number;
    engagementScore: number;
    accountPriorityScore: number | null;
    priorityTier: string | null;
    createdAt: string;
    updatedAt: string;
  };

  // Research card (from intelligence-contract)
  researchCard: Record<string, unknown> | null;

  // Key people extracted from research
  keyPeople: Array<{
    name: string;
    title: string;
    department?: string;
    linkedInUrl?: string;
    source?: string;
  }>;

  // Active signals (?include=signals)
  signals?: IntelligenceSignal[];

  // Intelligence scores (?include=scores)
  scores?: {
    revenue: RevenueScore;
    accountPriority?: {
      score: number;
      tier: string;
    };
    intelConfidence?: number;
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

  // Data health metrics (?include=data_health)
  dataHealth?: {
    completenessScore: number;
    qualityScore: number;
    staleFields: string[];
    lastEnrichedAt: string | null;
  };

  // Freshness
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
  summary: string;
  keyThemes: string[];
  recommendations: string[];
  risks: string[];
  confidence: number;
  generatedAt: string;
  source: string;
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
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OPPORTUNITY — GET /api/intelligence/opportunity/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceOpportunity {
  companyId: string;
  scores: RevenueScore;
  reasoning: {
    summary: string | null;
    overallConfidence: number;
    winProbability: number;
  };
  fusion: Array<{
    externalSignal: string;
    internalCapability: string;
    fusionScore: number;
    businessProblem: string;
    recommendedCapability: string;
    relevantCaseStudy: string | null;
    proofPoints: string[];
    confidenceScore: number;
  }>;
  actions: ActionResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ACTION — GET /api/intelligence/action/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceActionOutput {
  companyId: string;
  actions: ActionResult;
  learningInsights: Array<{
    id: string;
    insight: string;
    sourceCompany: string;
    applicableContext: string;
    createdAt: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONVERSATION — GET /api/intelligence/conversation/{id}
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceConversationOutput {
  companyId: string;
  conversation: ConversationResult;
  brief: IntelligenceBrief;
  pastLearnings: Array<{
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
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    centerNode: string;
    lastGenerated: string | null;
  };
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
//  ERROR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export const IntelligenceErrors = {
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  MISSING_COMPANY_ID: 'MISSING_COMPANY_ID',
  INTELLIGENCE_UNAVAILABLE: 'INTELLIGENCE_UNAVAILABLE',
  ENGINE_TIMEOUT: 'ENGINE_TIMEOUT',
  GOVERNANCE_BLOCKED: 'GOVERNANCE_BLOCKED',
  INVALID_INCLUDE: 'INVALID_INCLUDE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type IntelligenceErrorCode = typeof IntelligenceErrors[keyof typeof IntelligenceErrors];
