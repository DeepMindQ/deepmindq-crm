/* ═══════════════════════════════════════════════════════════════
   MS9 §1 — Intelligence Advisor Types & Data Model
   
   Single source of truth for all MS9 Intelligence Advisor components.
   These types bridge:
   - M5 backend responses (AIInsightOutput, ReasoningContext)
   - MS8 evidence & trust metadata (TRUST tiers, EvidenceChain, Confidence)
   - MS7 intelligence data models (IntelligenceSignal, Recommendation)
   - MS9 conversational UI (structured briefings, advisor messages)
   
   CORE PRINCIPLE: This is not a chatbot.
   Every type enforces evidence-grounded, confidence-scored,
   context-aware, traceable intelligence briefings.
   
   Governance: Changes here affect all MS9 components. Review before modifying.
   ═══════════════════════════════════════════════════════════════ */

// ─── Re-exports: MS8 TRUST Foundation ──────────────────────────
// MS9 reuses the MS8 trust tier system verbatim.
// All trust-dependent components MUST import from ms8-evidence.ts.

import type {
  TrustTier,
  SourceCategory,
  EvidenceQuality,
  EvidenceChainItem,
  EvidenceFootprint,
  ConfidenceBreakdown,
  VerificationStatus,
  ConfidenceFactorCategory,
  IntelligenceGrade,
} from '@/types/ms8-evidence';

export type {
  TrustTier,
  SourceCategory,
  EvidenceQuality,
  EvidenceChainItem,
  EvidenceFootprint,
  ConfidenceBreakdown,
  VerificationStatus,
  ConfidenceFactorCategory,
  IntelligenceGrade,
};

// ─── Re-exports: MS7 Intelligence Foundation ─────────────────
// MS9 reuses MS7 signal, recommendation, and status types.

import type {
  TrustLevel,
  PriorityLevel,
  SignalType,
  RecommendationStatus,
  IntelligenceStatus,
  IntelligenceSignal,
  Recommendation,
  ExecutiveStats,
  IntelligenceBriefingCard,
} from '@/lib/intelligence-types';

export type {
  TrustLevel,
  PriorityLevel,
  SignalType,
  RecommendationStatus,
  IntelligenceStatus,
  IntelligenceSignal,
  Recommendation,
  ExecutiveStats,
  IntelligenceBriefingCard,
};

// ─── MS9 Conversation Primitives ───────────────────────────────

/** Role of a message participant in the advisor conversation */
export type AdvisorRole = 'user' | 'assistant' | 'system';

/** Delivery status of an advisor message */
export type MessageStatus = 'pending' | 'streaming' | 'delivered' | 'error';

/** Processing state of the AI advisor */
export type AdvisorProcessingState =
  | 'idle'
  | 'retrieving' // Fetching intelligence data
  | 'analyzing' // Running confidence/explanation pipeline
  | 'generating' // Producing structured briefing
  | 'grounding' // Cross-referencing with evidence
  | 'streaming' // Delivering response chunks
  | 'waiting_input'; // Awaiting user question

/** Advisor connection/availability status */
export type AdvisorConnectionStatus = 'connected' | 'degraded' | 'offline' | 'initializing';

// ─── Signal Pill (from reference_ai_advisor.html) ─────────────
// Inline signal representation within AI briefings.
// Maps to MS7 IntelligenceSignal but in compact pill form.

/** Visual variant for signal pills — maps to MS6 source color domains */
export type SignalPillVariant =
  | 'blue' // Financial/signal — var(--accent)
  | 'purple' // Leadership/people — var(--accent-secondary)
  | 'cyan' // Web/tech signals — var(--enrichment-cyan)
  | 'green' // Verified/positive — var(--trust-verified)
  | 'amber' // Warning/timing — var(--warning-amber)
  | 'red'; // Risk/negative — var(--risk-red)

/** Signal pill data — compact inline signal reference in AI responses */
export interface SignalPill {
  /** Unique signal identifier — links to full IntelligenceSignal */
  signalId: string;

  /** Display label (e.g., "Revenue Acceleration — 23% YoY") */
  label: string;

  /** Visual variant — determines color treatment */
  variant: SignalPillVariant;

  /** Signal type from MS7 */
  signalType: SignalType;

  /** Signal priority level */
  priority: PriorityLevel;

  /** Confidence score 0-100 */
  confidenceScore: number;

  /** Trust tier for this signal */
  trustTier: TrustTier;

  /** When this signal was detected (ISO 8601) */
  detectedAt: string;

  /** Whether this pill is expandable to a full signal detail */
  expandable: boolean;
}

// ─── Trust Source Reference (from reference_ai_advisor.html) ──
// Inline source provenance shown in the trust footer of AI messages.

/** A single source reference in the trust footer */
export interface TrustSourceReference {
  /** Human-readable source name (e.g., "SEC Filing", "LinkedIn", "Greenhouse") */
  sourceName: string;

  /** Trust tier for this source */
  trustTier: TrustTier;

  /** Source category from MS8 */
  sourceCategory: SourceCategory;

  /** Whether this source is directly linked to evidence chain items */
  hasEvidenceChain: boolean;

  /** Optional direct URL to source */
  sourceUrl?: string;

  /** Number of evidence items from this source */
  evidenceCount?: number;
}

/** Trust footer — collection of source references for a single AI message */
export interface TrustFooter {
  /** Ordered list of source references shown as dots + labels */
  sources: TrustSourceReference[];

  /** Total evidence items backing this response */
  totalEvidenceCount: number;

  /** Whether "Explore further" deep-link is available */
  hasExplorationLink: boolean;

  /** Target exploration ID for deep linking */
  explorationId?: string;
}

// ─── Confidence Footer (from reference_ai_advisor.html) ────────
// Confidence display with delta tracking for follow-up messages.

/** Direction of confidence change */
export type ConfidenceDirection = 'up' | 'down' | 'stable';

/** Confidence footer — per-message confidence with delta context */
export interface ConfidenceFooter {
  /** Current confidence score 0-100 for this response */
  score: number;

  /** Trust tier derived from score */
  trustTier: TrustTier;

  /** Confidence direction relative to previous response in conversation */
  direction: ConfidenceDirection;

  /** Delta value (e.g., -6 for a drop from 78 to 72) */
  delta: number | null;

  /** Human-readable explanation of why confidence changed */
  deltaExplanation: string | null;

  /** Full confidence breakdown reference (MS8) — may be lazy-loaded */
  breakdownId?: string;

  /** Whether inline reasoning is available for this response */
  hasReasoningChain: boolean;
}

// ─── Inline Reasoning (from reference_ai_advisor.html) ─────────
// Expandable reasoning chain within an AI message.

/** Inline reasoning block — expandable AI reasoning */
export interface InlineReasoning {
  /** Unique ID for this reasoning block */
  id: string;

  /** Whether this reasoning starts expanded or collapsed */
  defaultExpanded: boolean;

  /** Toggle label text (e.g., "View reasoning chain") */
  toggleLabel: string;

  /** Full reasoning content — evidence-grounded narrative */
  content: string;

  /** Reasoning steps breakdown for structured display */
  steps?: ReasoningStep[];

  /** Number of evidence sources referenced in this reasoning */
  sourceCount: number;
}

/** A single step in the reasoning chain */
export interface ReasoningStep {
  /** Step title or claim */
  claim: string;

  /** Supporting evidence or logic */
  supportingEvidence: string;

  /** Source of this reasoning step */
  source: string;

  /** Confidence of this individual step 0-100 */
  stepConfidence: number;

  /** Whether this step is user-expandable for more detail */
  expandable: boolean;
}

// ─── Structured Briefing Block ────────────────────────────────
// CRITICAL MS9 REQUIREMENT: AI output renders as structured
// intelligence blocks, NOT raw markdown or generic chat text.

/** Block types for structured AI briefings */
export type BriefingBlockType =
  | 'key_findings' // Primary intelligence findings
  | 'signals' // Active signals with pills
  | 'recommendations' // Actionable recommendations
  | 'timeline_insights' // Temporal analysis and patterns
  | 'competitive_intel' // Competitive landscape intelligence
  | 'risk_flags' // Risk indicators and warnings
  | 'narrative' // AI narrative text (structured, not raw)
  | 'data_summary'; // Key metrics and data points

/** A single structured block within an AI briefing */
export interface BriefingBlock {
  /** Unique block identifier */
  id: string;

  /** Block type — determines rendering strategy */
  type: BriefingBlockType;

  /** Block title (e.g., "Key Findings", "Active Signals") */
  title: string;

  /** Priority order within the briefing (lower = higher priority) */
  sortOrder: number;

  /** Whether this block is collapsed by default */
  defaultCollapsed: boolean;

  /** Block-specific content — discriminated union by type */
  content: BriefingBlockContent;

  /** Trust metadata for this block */
  trust: BriefingBlockTrust;
}

/** Discriminated union content for briefing blocks */
export type BriefingBlockContent =
  | KeyFindingsContent
  | SignalsContent
  | RecommendationsContent
  | TimelineInsightsContent
  | CompetitiveIntelContent
  | RiskFlagsContent
  | NarrativeContent
  | DataSummaryContent;

/** Trust metadata for a briefing block */
export interface BriefingBlockTrust {
  /** Aggregate trust tier for content in this block */
  trustTier: TrustTier;

  /** Aggregate confidence 0-100 */
  confidenceScore: number;

  /** Number of evidence sources backing this block */
  sourceCount: number;

  /** Whether human verification is available */
  hasHumanVerification: boolean;

  /** Evidence footprint summary */
  evidenceFootprint?: EvidenceFootprint;
}

// ─── Briefing Block Content Types ──────────────────────────────

/** Key findings — primary intelligence conclusions */
export interface KeyFindingsContent {
  type: 'key_findings';

  /** Finding items — each is an evidence-backed conclusion */
  findings: Array<{
    id: string;
    headline: string;
    description: string;
    confidenceScore: number;
    trustTier: TrustTier;
    evidenceCount: number;
    signalId?: string;
  }>;
}

/** Signals content — signal pills with metadata */
export interface SignalsContent {
  type: 'signals';

  /** Signal pills to display */
  pills: SignalPill[];

  /** Total signal count (may be more than displayed pills) */
  totalSignals: number;

  /** Whether more signals are available for exploration */
  hasMore: boolean;
}

/** Recommendations content — actionable next steps */
export interface RecommendationsContent {
  type: 'recommendations';

  /** Recommendation items — each with action type and confidence */
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    actionType: 'review' | 'save' | 'monitor' | 'schedule' | 'export' | 'escalate';
    priority: PriorityLevel;
    confidenceScore: number;
    trustTier: TrustTier;
    reasoning: string;
    signalId?: string;
    accountId?: string;
  }>;
}

/** Timeline insights — temporal analysis */
export interface TimelineInsightsContent {
  type: 'timeline_insights';

  /** Timeline events with temporal context */
  events: Array<{
    id: string;
    date: string; // ISO 8601
    dateLabel: string; // Human-readable (e.g., "Q2 2025")
    event: string;
    significance: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    confidenceScore: number;
    sourceCategory: SourceCategory;
  }>;

  /** Overall timeline pattern assessment */
  patternSummary: string;
}

/** Competitive intelligence content */
export interface CompetitiveIntelContent {
  type: 'competitive_intel';

  /** Competitive entities */
  competitors: Array<{
    id: string;
    name: string;
    relevance: string;
    threatLevel: 'high' | 'medium' | 'low' | 'opportunity';
    description: string;
    confidenceScore: number;
  }>;

  /** Market positioning summary */
  positioningSummary: string;
}

/** Risk flags content */
export interface RiskFlagsContent {
  type: 'risk_flags';

  /** Risk items */
  flags: Array<{
    id: string;
    category: 'financial' | 'operational' | 'competitive' | 'timing' | 'data_quality';
    severity: 'critical' | 'high' | 'medium' | 'low';
    headline: string;
    description: string;
    mitigation: string;
    confidenceScore: number;
    trustTier: TrustTier;
  }>;

  /** Overall risk assessment */
  riskSummary: string;
}

/** Narrative content — structured AI text, not raw markdown */
export interface NarrativeContent {
  type: 'narrative';

  /** Structured narrative — uses emphasis hints, not free-form markdown */
  paragraphs: Array<{
    id: string;
    /** Plain text with optional emphasis markers */
    text: string;
    /** Whether this paragraph contains key emphasis */
    hasEmphasis: boolean;
  }>;
}

/** Data summary content — key metrics */
export interface DataSummaryContent {
  type: 'data_summary';

  /** Data points to display */
  metrics: Array<{
    id: string;
    label: string;
    value: string;
    context: string;
    confidenceScore: number;
    trustTier: TrustTier;
    sourceCategory: SourceCategory;
    trend?: 'up' | 'down' | 'stable' | 'new';
  }>;
}

// ─── Structured Briefing (Full) ────────────────────────────────
// Complete structured AI briefing — the output format for every
// AI assistant response in MS9.

/** A complete structured AI briefing response */
export interface StructuredBriefing {
  /** Unique briefing identifier */
  id: string;

  /** Briefing title/header */
  title: string;

  /** One-line executive summary */
  summary: string;

  /** Ordered briefing blocks */
  blocks: BriefingBlock[];

  /** Signal pills for inline display */
  signalPills: SignalPill[];

  /** Trust footer */
  trustFooter: TrustFooter;

  /** Confidence footer */
  confidence: ConfidenceFooter;

  /** Inline reasoning (if available) */
  inlineReasoning?: InlineReasoning;

  /** Account context binding — which account(s) this briefing covers */
  accountContext: AdvisorAccountContext;

  /** When this briefing was generated (ISO 8601) */
  generatedAt: string;

  /** AI model used for generation (for audit trail) */
  modelUsed?: string;

  /** Processing duration in ms (for latency transparency) */
  processingDurationMs?: number;

  /** Tokens consumed (for cost transparency) */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// ─── Advisor Account Context ──────────────────────────────────
// Binds an AI briefing to specific account intelligence data.
// This ensures the AI is grounded in real intelligence, not
// generating generic responses.

/** Account context for advisor briefings */
export interface AdvisorAccountContext {
  /** Primary account being briefed on */
  primaryAccount: {
    companyId: string;
    companyName: string;
    domain?: string;
    industry?: string;
  } | null;

  /** Account trust data snapshot */
  trustData?: {
    overallScore: number;
    overallTier: TrustTier;
    grade: IntelligenceGrade;
    confidenceBreakdown?: ConfidenceBreakdown;
    evidenceFootprint?: EvidenceFootprint;
  };

  /** Active signals for the primary account */
  activeSignals: Array<{
    signalId: string;
    signalType: SignalType;
    headline: string;
    confidenceScore: number;
    detectedAt: string;
  }>;

  /** Active signal count */
  activeSignalCount: number;

  /** Related accounts mentioned in this briefing */
  relatedAccounts: Array<{
    companyId: string;
    companyName: string;
    relevance: string;
    initials: string;
  }>;

  /** Data freshness snapshot for context sidebar */
  dataFreshness: DataFreshnessEntry[];

  /** Intelligence source status */
  sourceStatus: AdvisorSourceStatus;
}

/** Data freshness entry for context sidebar */
export interface DataFreshnessEntry {
  /** Domain label (e.g., "Financial Data", "Leadership Data") */
  label: string;

  /** When this data was last refreshed (ISO 8601) */
  lastRefreshedAt: string;

  /** Human-readable freshness label */
  freshnessLabel: string;

  /** Whether data is within acceptable freshness threshold */
  isFresh: boolean;
}

/** Intelligence source status for the advisor */
export interface AdvisorSourceStatus {
  /** Number of active intelligence sources */
  activeSourceCount: number;

  /** Individual source statuses */
  sources: Array<{
    name: string;
    status: 'active' | 'degraded' | 'offline';
    lastSyncAt: string | null;
  }>;

  /** Overall connection status */
  connectionStatus: AdvisorConnectionStatus;
}

// ─── Advisor Message (Conversation Turn) ──────────────────────
// Each turn in an advisor conversation.

/** A single message in the advisor conversation */
export interface AdvisorMessage {
  /** Unique message identifier */
  id: string;

  /** Conversation this message belongs to */
  conversationId: string;

  /** Role of the message sender */
  role: AdvisorRole;

  /** Delivery status */
  status: MessageStatus;

  /** Ordinal position in the conversation (1-indexed) */
  position: number;

  /** Timestamp (ISO 8601) */
  createdAt: string;

  /** Content — discriminated by role */
  content: AdvisorMessageContent;

  /** For assistant messages: the structured briefing */
  briefing?: StructuredBriefing;

  /** For user messages: the raw query text */
  queryText?: string;

  /** For system messages: event description */
  systemEvent?: string;

  /** Processing metadata for assistant messages */
  processing?: {
    durationMs: number;
    modelUsed?: string;
    sourcesConsulted: number;
    evidenceItemsReferenced: number;
  };

  /** User feedback on this message (if provided) */
  feedback?: AdvisorMessageFeedback;
}

/** Discriminated union content for advisor messages */
export type AdvisorMessageContent =
  | { type: 'user_query'; text: string }
  | { type: 'structured_briefing'; briefing: StructuredBriefing }
  | { type: 'system_event'; event: string; metadata?: Record<string, unknown> }
  | { type: 'error'; error: string; recoverable: boolean }
  | { type: 'typing_indicator'; state: AdvisorProcessingState };

/** User feedback on an advisor message */
export interface AdvisorMessageFeedback {
  /** Feedback type */
  type: 'helpful' | 'not_helpful' | 'inaccurate' | 'missing_context';

  /** Optional free-text feedback */
  comment?: string;

  /** When feedback was provided (ISO 8601) */
  providedAt: string;
}

// ─── Advisor Conversation ───────────────────────────────────────
// A complete advisor conversation session.

/** Conversation context scope — what intelligence area is being discussed */
export type ConversationScope =
  | 'account_intelligence' // Specific account briefing
  | 'market_intelligence' // Market/trend analysis
  | 'competitive_analysis' // Competitive landscape
  | 'signal_investigation' // Deep dive on specific signals
  | 'general_intelligence'; // General intelligence questions

/** A complete advisor conversation */
export interface AdvisorConversation {
  /** Unique conversation identifier */
  id: string;

  /** Human-readable conversation title (auto-generated or user-set) */
  title: string;

  /** Conversation scope */
  scope: ConversationScope;

  /** All messages in chronological order */
  messages: AdvisorMessage[];

  /** Primary account context (if scoped to an account) */
  accountContext: AdvisorAccountContext;

  /** Conversation state */
  state: {
    /** Current processing state */
    processingState: AdvisorProcessingState;

    /** Total messages */
    messageCount: number;

    /** Total assistant messages */
    assistantMessageCount: number;

    /** When conversation started (ISO 8601) */
    startedAt: string;

    /** When conversation was last active (ISO 8601) */
    lastActiveAt: string;

    /** Total processing time across all AI responses */
    totalProcessingMs: number;

    /** Average confidence across all AI responses */
    averageConfidence: number;

    /** Number of evidence items referenced across conversation */
    totalEvidenceReferenced: number;
  };

  /** User's workspace association */
  workspace?: {
    /** Whether this conversation is pinned */
    pinned: boolean;

    /** User-assigned labels/tags */
    labels: string[];
  };

  /** Conversation-level confidence tracking */
  confidenceHistory: ConfidenceHistoryEntry[];
}

/** Confidence history entry — tracks confidence across conversation turns */
export interface ConfidenceHistoryEntry {
  /** Message position this entry corresponds to */
  messagePosition: number;

  /** Confidence score at this point */
  score: number;

  /** Trust tier at this point */
  trustTier: TrustTier;

  /** Delta from previous entry */
  delta: number | null;

  /** Explanation for any significant delta */
  deltaExplanation?: string;
}

// ─── Workspace Types ──────────────────────────────────────────
// Saved briefings, pinned accounts, conversation history.

/** Workspace item — a saved or pinned item in the advisor workspace */
export interface WorkspaceItem {
  /** Unique item identifier */
  id: string;

  /** Item type */
  type: 'saved_briefing' | 'pinned_account' | 'conversation_history' | 'intelligence_access';

  /** Display title */
  title: string;

  /** Brief description */
  description?: string;

  /** Reference ID (conversation ID, company ID, etc.) */
  referenceId: string;

  /** When this was added to workspace (ISO 8601) */
  addedAt: string;

  /** Last accessed (ISO 8601) */
  lastAccessedAt: string;

  /** Custom sort order */
  sortOrder: number;

  /** Workspace section this item belongs to */
  section: 'briefings' | 'accounts' | 'history' | 'quick_access';
}

/** Advisor workspace — the user's saved intelligence space */
export interface AdvisorWorkspace {
  /** Workspace items grouped by section */
  sections: Record<WorkspaceItem['section'], WorkspaceItem[]>;

  /** Total items */
  totalItems: number;

  /** When workspace was last updated (ISO 8601) */
  updatedAt: string;
}

// ─── Human Assistance Layer (UI Entry Points Only) ─────────────
// MS9 delivers UI entry points and escalation workflow.
// Full operational workflow is MS10 scope.

/** Human assistance escalation entry point */
export interface HumanAssistanceEntry {
  /** Unique escalation request ID */
  id: string;

  /** Context: which conversation/message triggered this */
  conversationId: string;
  messageId: string;

  /** Escalation reason */
  reason:
    'low_confidence' | 'conflicting_evidence' | 'complex_analysis' | 'data_gap' | 'user_request';

  /** Description of what human assistance is needed */
  description: string;

  /** Priority */
  priority: PriorityLevel;

  /** Current escalation status */
  status: 'requested' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';

  /** When requested (ISO 8601) */
  requestedAt: string;

  /** Context snapshot at time of escalation */
  contextSnapshot: {
    accountName: string | null;
    confidenceScore: number;
    evidenceCount: number;
    signalCount: number;
  };
}

// ─── Context Sidebar Types (from reference_ai_advisor.html) ────
// Data structures for the right-panel context sidebar.

/** Complete context sidebar data */
export interface ContextSidebarData {
  /** Current briefing context — primary account card */
  currentContext: ContextAccountCard;

  /** Related accounts list */
  relatedAccounts: RelatedAccountItem[];

  /** Data freshness panel */
  dataFreshness: DataFreshnessEntry[];

  /** Active signals summary for sidebar display */
  activeSignalsSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/** Context account card — primary account in sidebar */
export interface ContextAccountCard {
  /** Company ID */
  companyId: string;

  /** Company name */
  companyName: string;

  /** Key account fields */
  fields: Array<{
    label: string;
    value: string;
    verificationStatus: 'verified' | 'estimated' | 'unknown';
  }>;

  /** Trust score bar data */
  trustScore: {
    score: number;
    tier: TrustTier;
    maxScore: number;
  };
}

/** Related account item in sidebar */
export interface RelatedAccountItem {
  /** Company ID */
  companyId: string;

  /** Company name */
  companyName: string;

  /** Initials for avatar */
  initials: string;

  /** Relationship description */
  relevance: string;

  /** Trust score */
  trustScore: number;
}

// ─── Advisor API Request/Response Types ──────────────────────
// Contract types for advisor API communication.
// These define the shape of data between frontend and backend.

/** User query to the advisor */
export interface AdvisorQueryRequest {
  /** The user's question or briefing request */
  query: string;

  /** Conversation ID (empty for new conversation) */
  conversationId?: string;

  /** Account context — which account to ground the briefing in */
  accountId?: string;

  /** Requested briefing depth */
  depth: 'summary' | 'standard' | 'comprehensive';

  /** Requested focus areas (optional filter on BriefingBlockType) */
  focusAreas?: BriefingBlockType[];

  /** Include inline reasoning */
  includeReasoning?: boolean;

  /** Maximum evidence items to reference */
  maxEvidenceItems?: number;
}

/** Advisor query response — structured briefing */
export interface AdvisorQueryResponse {
  /** The structured briefing response */
  briefing: StructuredBriefing;

  /** Updated conversation state */
  conversation: {
    id: string;
    messageCount: number;
    lastActiveAt: string;
  };

  /** Processing metadata */
  processing: {
    durationMs: number;
    modelUsed: string;
    sourcesConsulted: number;
    evidenceItemsReferenced: number;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
  };

  /** Whether this response triggered any confidence warnings */
  confidenceWarnings?: Array<{
    message: string;
    threshold: number;
    actualScore: number;
  }>;
}

/** Streaming chunk for progressive delivery */
export interface AdvisorStreamChunk {
  /** Chunk type */
  type:
    | 'briefing_start'
    | 'block_start'
    | 'block_content'
    | 'block_end'
    | 'signal_pill'
    | 'trust_footer'
    | 'confidence_footer'
    | 'reasoning'
    | 'briefing_end'
    | 'error';

  /** Block ID (for block-related chunks) */
  blockId?: string;

  /** Content payload — varies by type */
  payload: unknown;

  /** Cumulative confidence score at this point */
  currentConfidence?: number;
}

// ─── Utility Functions ─────────────────────────────────────────

/**
 * Derive SignalPillVariant from signal type.
 * Supports both MS7 SignalType names AND Prisma SignalType enum values.
 * Prisma is the single source of truth for DB; MS7 names are UI legacy.
 */
export function signalTypeToPillVariant(signalType: SignalType | string): SignalPillVariant {
  // Unified mapping: covers both MS7 names and Prisma enum values
  const mapping: Record<string, SignalPillVariant> = {
    // MS7 names (UI legacy)
    financial_signal: 'blue',
    funding_event: 'blue',
    technology_investment: 'cyan',
    hiring_surge: 'cyan',
    product_launch: 'cyan',
    leadership_change: 'purple',
    market_expansion: 'green',
    competitive_move: 'amber',
    risk_indicator: 'red',
    // Prisma enum values (single source of truth for DB)
    funding: 'blue',
    hiring: 'cyan',
    leadership: 'purple',
    tech_change: 'cyan',
    technology: 'cyan',
    news: 'blue',
    mention: 'blue',
    expansion: 'green',
    people_change: 'purple',
    internal_memory: 'blue',
    // Shared names (exist in both MS7 and Prisma)
    partnership: 'green',
  };
  return mapping[signalType] ?? 'blue';
}

/** Derive ConfidenceDirection from two scores */
export function computeConfidenceDirection(
  previous: number | null,
  current: number,
): ConfidenceDirection {
  if (previous === null) return 'stable';
  if (current > previous + 2) return 'up';
  if (current < previous - 2) return 'down';
  return 'stable';
}

/** Build an initial AdvisorAccountContext from MS8 AccountTrustData */
export function buildAccountContextFromTrust(
  companyId: string,
  companyName: string,
  trustData: {
    overallScore: number;
    overallTier: TrustTier;
    grade: IntelligenceGrade;
    confidenceBreakdown?: ConfidenceBreakdown;
    evidenceFootprint?: EvidenceFootprint;
  },
): AdvisorAccountContext {
  return {
    primaryAccount: { companyId, companyName },
    trustData,
    activeSignals: [],
    activeSignalCount: 0,
    relatedAccounts: [],
    dataFreshness: [],
    sourceStatus: {
      activeSourceCount: 0,
      sources: [],
      connectionStatus: 'initializing',
    },
  };
}

/** Compute average confidence across a list of scores */
export function computeAverageConfidence(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/** Validate that a StructuredBriefing has minimum required fields */
export function validateBriefing(briefing: StructuredBriefing): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!briefing.id) errors.push('Missing briefing.id');
  if (!briefing.title) errors.push('Missing briefing.title');
  if (!briefing.summary) errors.push('Missing briefing.summary');
  if (briefing.blocks.length === 0) errors.push('No briefing blocks');
  if (!briefing.trustFooter) errors.push('Missing trustFooter');
  if (!briefing.confidence) errors.push('Missing confidence');
  if (!briefing.accountContext) errors.push('Missing accountContext');

  // Validate confidence score range
  if (briefing.confidence.score < 0 || briefing.confidence.score > 100) {
    errors.push(`Invalid confidence score: ${briefing.confidence.score}`);
  }

  // Validate trust footer has sources
  if (briefing.trustFooter.sources.length === 0) {
    errors.push('Trust footer has no sources');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Type guard: check if AdvisorMessageContent is a structured briefing */
export function isStructuredBriefingContent(
  content: AdvisorMessageContent,
): content is { type: 'structured_briefing'; briefing: StructuredBriefing } {
  return content.type === 'structured_briefing';
}

/** Type guard: check if content is a user query */
export function isUserQueryContent(
  content: AdvisorMessageContent,
): content is { type: 'user_query'; text: string } {
  return content.type === 'user_query';
}

/** Type guard: check if content is a typing indicator */
export function isTypingIndicator(
  content: AdvisorMessageContent,
): content is { type: 'typing_indicator'; state: AdvisorProcessingState } {
  return content.type === 'typing_indicator';
}
