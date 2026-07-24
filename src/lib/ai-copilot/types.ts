/**
 * AI Revenue Copilot — Phase 8 Shared Types
 *
 * Central type definitions for the AI Reasoning Engine, Engagement Strategy,
 * Brief Enhancement, and Usage Tracking modules.
 *
 * All modules in src/lib/ai-copilot/ import from this single source of truth.
 */

// ── SDK Instance Type ───────────────────────────────────────────────────
/** ZAI SDK instance — using `any` to avoid coupling to SDK internal types */
export type ZAIInstance = any

// ═══════════════════════════════════════════════════════════════════════════════
//  REASONING CONTEXT — All intelligence data gathered for a company
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReasoningContext {
  companyId: string;
  companyName: string;
  industry: string | null;
  sizeRange: string | null;

  knowledgeEntries: Array<{
    id: string;
    category: string;
    content: string;
    confidence: number; // 0-1
    source: string | null;
    updatedAt: Date;
  }>;

  intelligenceObjects: Array<{
    id: string;
    content: string;
    summary: string | null;
    confidence: number; // 0-1
    sourceType: string;
    capturedAt: Date | null;
  }>;

  associations: Array<{
    id: string;
    associationType: string;
    sourceId: string;
    targetId: string;
    confidence: number; // 0-1
    metadata: string; // JSON
  }>;

  signals: Array<{
    id: string;
    signalType: string;
    title: string;
    confidence: number; // 0-1
    severity: string;
    createdAt: Date;
  }>;

  opportunitySignals: Array<{
    id: string;
    signalType: string;
    title: string;
    score: number; // 0-100
    confidence: number; // 0-1
  }>;

  evidence: Array<{
    id: string;
    snippet: string;
    extractedField: string | null;
    relevanceScore: number; // 0-1
    confidence: number; // 0-1
  }>;

  accountBrief: {
    summary: string;
    themes: string; // JSON
    risks: string; // JSON
    recommendations: string; // JSON
    confidence: number; // 0-1
  } | null;

  accountScore: {
    score: number; // 0-100
    category: string;
    scoreBreakdown: string; // JSON
  } | null;

  dataQualityMetrics: {
    totalKnowledgeEntries: number;
    avgConfidence: number; // 0-1
    recentEntryCount: number;
    sourceHealthAvg: number; // 0-1
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STRATEGIC INSIGHT OUTPUT — LLM-generated reasoning result
// ═══════════════════════════════════════════════════════════════════════════════

export type InsightType = 'STRATEGIC_SHIFT' | 'OPPORTUNITY' | 'RISK' | 'PATTERN_EMERGED';

export interface StrategicInsightOutput {
  insightType: InsightType;
  summary: string;
  keyThemes: string[];
  reasoningSummary: {
    observations: string[];
    interpretation: string;
    confidenceFactors: string[];
  };
  supportingEvidence: Array<{
    evidenceId: string;
    relevance: string;
    quote: string;
  }>;
  confidenceScore: number; // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ENGAGEMENT STRATEGY OUTPUT — LLM-generated sales strategy
// ═══════════════════════════════════════════════════════════════════════════════

export interface EngagementStrategyOutput {
  situationAssessment: {
    currentPhase: string;
    keyDrivers: string[];
    maturityLevel: string;
  };
  recommendedEntry: {
    role: string;
    rationale: string;
    department: string;
  };
  firstMeetingObjective: 'discovery' | 'technical' | 'executive_alignment';
  conversationAngles: Array<{
    angle: string;
    talkingPoints: string[];
  }>;
  riskFactors: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
  }>;
  priorityScore: number; // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ENHANCED BRIEF OUTPUT — LLM-generated executive brief narrative
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnhancedBriefOutput {
  narrative: string;
  keyTakeaways: string[];
  strategicImplications: Array<{
    implication: string;
    impact: string;
    action: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AI USAGE TRACKING — Cost and usage metrics
// ═══════════════════════════════════════════════════════════════════════════════

export type AIUsageFeature = 'REASONING' | 'STRATEGY' | 'BRIEF_ENHANCEMENT';

export interface AIUsageRecord {
  companyId: string | null;
  feature: AIUsageFeature;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  status: 'success' | 'failed' | 'rate_limited';
  errorMessage?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  THEMATIC CLUSTER — Evidence synthesis output
// ═══════════════════════════════════════════════════════════════════════════════

export interface ThematicCluster {
  theme: string;
  entries: Array<{
    id: string;
    content: string;
    source: string;
    confidence: number; // 0-1
  }>;
  strength: number; // 0-100 based on volume and confidence
  recency: number; // 0-100 based on how recent the entries are
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GUARDRAIL — Quality gate check result
// ═══════════════════════════════════════════════════════════════════════════════

export interface GuardrailCheck {
  passed: boolean;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}
