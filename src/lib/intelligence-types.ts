/* ═══════════════════════════════════════════════════════════════
   MS7 Intelligence Data Models
   Single source of truth for intelligence rendering
   ═══════════════════════════════════════════════════════════════ */

export type TrustLevel = 'verified' | 'high' | 'medium' | 'low' | 'unverified';
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type SignalType = 'leadership_change' | 'technology_investment' | 'funding_event' | 'market_expansion' | 'partnership' | 'product_launch' | 'hiring_surge' | 'financial_signal' | 'competitive_move' | 'risk_indicator';
export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'saved';
export type IntelligenceStatus = 'active' | 'reviewed' | 'archived';

export interface IntelligenceSignal {
  id: string;
  type: SignalType;
  headline: string;
  summary: string;
  confidenceScore: number; // 0-100
  freshnessTimestamp: string; // ISO 8601
  source: string;
  priority: PriorityLevel;
  reasoning: string;
  status: IntelligenceStatus;
  accountId?: string;
  accountName?: string;
  evidenceAvailable: boolean;
  evidenceCount?: number;
  tags: string[];
}

export type DataDepthIndicator = 'comprehensive' | 'moderate' | 'limited' | 'minimal';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  reasoning: string;
  actionType: 'review' | 'save' | 'monitor' | 'schedule' | 'export';
  status: RecommendationStatus;
  signalId?: string;
  accountId?: string;
  accountName?: string;
  createdAt: string;
  /** Phase 4.5.6: Data depth indicator — how much intelligence backs this recommendation */
  dataDepthIndicator?: DataDepthIndicator;
  /** Phase 3.3.4: Decision audit hash for reproducibility */
  decisionAuditHash?: string;
  /** Phase 5.1: Multiple target roles (company-size-aware) */
  targetRoles?: string[];
}

export interface ActivityEvent {
  id: string;
  type: 'signal_detected' | 'confidence_updated' | 'account_changed' | 'data_refreshed' | 'recommendation_generated';
  headline: string;
  description: string;
  timestamp: string;
  source: string;
  confidence?: number;
  trustLevel?: TrustLevel;
}

export interface ExecutiveStats {
  prioritySignals: number;
  activeOpportunities: number;
  confidenceAverage: number;
  accountsMonitored: number;
  prioritySignalsDelta?: number; // +/-
  activeOpportunitiesDelta?: number;
  confidenceAverageDelta?: number;
  accountsMonitoredDelta?: number;
}

export interface IntelligenceBriefingCard {
  signal: IntelligenceSignal;
  expanded: boolean; // L1 vs L2 state
}

// Trust color mapping helper
export function getTrustColor(level: TrustLevel): string {
  const map: Record<TrustLevel, string> = {
    verified: 'var(--trust-verified)',
    high: 'var(--trust-high)',
    medium: 'var(--trust-medium)',
    low: 'var(--trust-low)',
    unverified: 'var(--trust-unverified)',
  };
  return map[level];
}

export function getTrustBg(level: TrustLevel): string {
  const map: Record<TrustLevel, string> = {
    verified: 'var(--trust-verified-bg)',
    high: 'var(--trust-high-bg)',
    medium: 'var(--trust-medium-bg)',
    low: 'var(--trust-low-bg)',
    unverified: 'var(--trust-unverified-bg)',
  };
  return map[level];
}

export function getTrustBorder(level: TrustLevel): string {
  const map: Record<TrustLevel, string> = {
    verified: 'var(--trust-verified-border)',
    high: 'var(--trust-high-border)',
    medium: 'var(--trust-medium-border)',
    low: 'var(--trust-low-border)',
    unverified: 'var(--trust-unverified-border)',
  };
  return map[level];
}

export function getTrustLabel(level: TrustLevel): string {
  const map: Record<TrustLevel, string> = {
    verified: 'Verified',
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence',
    unverified: 'Unverified',
  };
  return map[level];
}

export function getConfidenceTrustLevel(score: number): TrustLevel {
  if (score >= 90) return 'verified';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  if (score >= 25) return 'low';
  return 'unverified';
}

export function getPriorityColor(priority: PriorityLevel): string {
  const map: Record<PriorityLevel, string> = {
    critical: 'var(--risk-red)',
    high: 'var(--warning-amber)',
    medium: 'var(--signal-blue)',
    low: 'var(--trust-unverified)',
  };
  return map[priority];
}

export function getPriorityLabel(priority: PriorityLevel): string {
  const map: Record<PriorityLevel, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return map[priority];
}

export function formatFreshness(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════
   Backward-Compatible Legacy Types (pre-MS7 consumers)
   ═══════════════════════════════════════════════════════════════ */

export type EvidenceState = 'confirmed' | 'inferred' | 'unknown';

export interface EvidenceSource {
  source: string;
  snippet?: string;
  url?: string;
  date?: string;
  state: EvidenceState;
}

export interface TemporalConfidence {
  current: number;
  previous: number;
  lastUpdated: string;
  trend: 'rising' | 'declining' | 'stable' | 'new';
  changeReason?: string;
}

export interface IntelligenceObject {
  id: string;
  type: 'signal' | 'need' | 'capability_match' | 'action' | 'stakeholder';
  title: string;
  subtitle?: string;
  whatChanged?: string;
  whyItMatters?: string;
  whyWeRelevant?: string;
  whatToDo?: string;
  evidenceState: EvidenceState;
  confidence: number;
  reasoning?: string;
  evidence: EvidenceSource[];
  freshness: {
    lastEnriched: string;
    staleness: 'fresh' | 'aging' | 'stale' | 'unknown';
  };
  temporal?: TemporalConfidence;
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  timing?: string;
  feedback?: {
    status: 'accurate' | 'outdated' | 'incorrect';
    updatedAt: string;
    reason?: string;
  };
  relatedContacts?: string[];
  origin?: {
    type: string;
    source?: string;
    collectedAt: string;
  };
  rankingScore?: number;
  relatedSignals?: string[];
  relatedCapabilities?: string[];
}

export interface CompanyIntelligence {
  company: {
    id: string;
    name: string;
    industry?: string;
    domain?: string;
    intelligenceScore: number;
  };
  executiveUnderstanding: {
    headline: string;
    narrative: string;
    evidenceState: EvidenceState;
    overallConfidence: number;
    temporal: TemporalConfidence;
  };
  signals: IntelligenceObject[];
  needs: IntelligenceObject[];
  capabilityMatches: IntelligenceObject[];
  actions: IntelligenceObject[];
  stakeholders: IntelligenceObject[];
  positioning: {
    message: string;
    angle: string;
    strengthScore: number;
    targetStakeholders: Array<{ role: string; reason: string }>;
    topCapabilities: string[];
  };
  technology: {
    knownTech: string[];
    digitalMaturity: string;
    techDescription: string | null;
    techSignals: IntelligenceObject[];
  };
  generatedAt: string;
  signalCount: number;
  capabilityCount: number;
  contactCount: number;
  _meta: { source: string; version: string; futureReady: boolean };
  recentChanges: string;
}

export interface ExecutiveBriefData {
  companyName: string;
  industry?: string;
  generatedAt: string;
  intelligenceScore: number;
  currentSituation: string;
  whyNow: string;
  opportunityAreas: string[];
  recommendedApproach: string;
  evidence: Array<{ title: string; source: string; date?: string; state: string }>;
  nextActions: Array<{ action: string; priority: string; confidence: number }>;
  keyStakeholders: Array<{ role: string; reason: string }>;
  topCapabilities: string[];
}
