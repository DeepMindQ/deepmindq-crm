/* ═══════════════════════════════════════════════════════════════════════════
   Intelligence Object Types — The DeepMindQ Intelligence Contract
   
   This is the frozen UI/API contract.
   The UI consumes these types. The source of intelligence can evolve
   (Phase B: Evidence Engine → Knowledge Graph → Reasoning Engine)
   but the experience should not change.
   
   Every intelligence item must have:
   - Evidence state: confirmed | inferred | unknown
   - Confidence: 0-100
   - Freshness: when was this last verified
   - Reasoning: why the system believes this
   ═══════════════════════════════════════════════════════════════════════════ */

export type EvidenceState = 'confirmed' | 'inferred' | 'unknown';

export interface EvidenceSource {
  source: string;
  snippet: string;
  url?: string;
  date?: string;
  state: EvidenceState;
}

export interface TemporalConfidence {
  current: number;        // 0-100
  previous: number;       // 0-100, or null if first measurement
  lastUpdated: string;    // ISO date
  changeReason?: string;  // "New hiring signals detected"
  trend: 'rising' | 'stable' | 'declining' | 'new';
}

export interface IntelligenceObject {
  id: string;
  type: 'signal' | 'need' | 'capability_match' | 'action' | 'stakeholder' | 'positioning';
  title: string;
  subtitle?: string;
  
  // The four questions
  whatChanged?: string;
  whyItMatters?: string;
  whyWeRelevant?: string;
  whatToDo?: string;
  
  // Evidence framework
  evidenceState: EvidenceState;
  confidence: number; // 0-100
  reasoning: string;
  evidence: EvidenceSource[];
  
  // Freshness
  freshness: {
    lastEnriched: string;       // ISO date
    staleness: 'fresh' | 'aging' | 'stale' | 'unknown';
    nextRefresh?: string;       // ISO date
  };
  
  // Temporal intelligence (lightweight)
  temporal?: TemporalConfidence;
  
  // Related entities
  relatedSignals?: string[];
  relatedCapabilities?: string[];
  relatedContacts?: string[];
  
  // Human feedback
  feedback?: {
    status: 'accurate' | 'outdated' | 'incorrect' | null;
    updatedAt?: string;
    reason?: string;
  };
  
  // Metadata
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  timing?: string; // "immediate" | "within_7_days" | "within_30_days" | "within_90_days" | "ongoing"

  // Phase 2A: Intelligence Origin — trust & transparency
  // Every intelligence item should clearly know where it came from.
  // This becomes a major enterprise differentiator: "DeepMindQ knew this because..."
  origin?: {
    type: 'customer_uploaded' | 'enrichment' | 'external_discovery' | 'human_validation' | 'ai_reasoning';
    source?: string;    // Specific source name (e.g., "Reuters", "company website")
    collectedAt?: string; // ISO date when this intelligence was acquired
  };

  // Phase 2A: Intelligence Ranking Score
  // Composite ranking based on confidence, freshness, source quality,
  // business relevance, and capability relevance.
  rankingScore?: number; // 0-100
}

export interface CompanyIntelligence {
  company: {
    id: string;
    name: string;
    industry: string | null;
    domain: string | null;
    intelligenceScore: number;
  };
  
  // Executive Understanding — answers: What changed? Why it matters?
  executiveUnderstanding: {
    headline: string;
    narrative: string;
    evidenceState: EvidenceState;
    overallConfidence: number;
    temporal: TemporalConfidence;
  };
  
  // Intelligence Objects — the core
  signals: IntelligenceObject[];
  needs: IntelligenceObject[];
  capabilityMatches: IntelligenceObject[];
  actions: IntelligenceObject[];
  stakeholders: IntelligenceObject[];
  
  // Strategic positioning
  positioning: {
    message: string;
    angle: string;
    strengthScore: number;
    targetStakeholders: Array<{ role: string; reason: string }>;
    topCapabilities: string[];
  };
  
  // Technology profile
  technology: {
    knownTech: string[];
    digitalMaturity: string;
    techDescription: string | null;
    techSignals: IntelligenceObject[];
  };
  
  // Metadata
  generatedAt: string;
  signalCount: number;
  capabilityCount: number;
  contactCount: number;
  
  // Phase B compatibility
  _meta: {
    source: string;
    version: string;
    futureReady: boolean;
  };

  // Phase 2A: What changed recently? — answers the executive question
  // "What changed recently that should affect my sales strategy?"
  recentChanges?: string;
}

export interface ExecutiveBriefData {
  companyName: string;
  industry: string | null;
  generatedAt: string;
  intelligenceScore: number;
  
  // Brief sections
  currentSituation: string;
  whyNow: string;
  opportunityAreas: string[];
  recommendedApproach: string;
  evidence: Array<{ title: string; source: string; date?: string; state: EvidenceState }>;
  nextActions: Array<{ action: string; priority: string; confidence: number }>;
  keyStakeholders: Array<{ role: string; reason: string }>;
  topCapabilities: string[];
}
