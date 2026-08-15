/* ═══════════════════════════════════════════════════════════════
   Intelligence Types — Core type definitions for the
   Enterprise Intelligence OS signal/recommendation pipeline.

   Re-exported by ms9-advisor.ts for the Intelligence Advisor UI.
   ═══════════════════════════════════════════════════════════════ */

/** Trust level for intelligence data */
export type TrustLevel = 'verified' | 'corroborated' | 'unverified' | 'untrusted';

/** Signal priority */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Type of intelligence signal detected */
export type SignalType =
  | 'hiring_surge'
  | 'funding_round'
  | 'tech_stack_change'
  | 'market_expansion'
  | 'leadership_change'
  | 'partnership'
  | 'acquisition'
  | 'product_launch'
  | 'regulatory_filing'
  | 'custom';

/** Status of a recommendation */
export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';

/** Overall intelligence processing status */
export type IntelligenceStatus = 'processing' | 'complete' | 'error' | 'stale';

/** A single intelligence signal detected by the Signal Engine */
export interface IntelligenceSignal {
  id: string;
  type: SignalType;
  priority: PriorityLevel;
  title: string;
  description: string;
  sourceEntityId: string;
  sourceEntityType: 'organization' | 'person';
  detectedAt: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/** An AI-generated recommendation based on signals */
export interface Recommendation {
  id: string;
  signalIds: string[];
  title: string;
  description: string;
  action: string;
  priority: PriorityLevel;
  status: RecommendationStatus;
  reasoning: string;
  createdAt: string;
  expiresAt?: string;
}

/** Executive-level summary stats for the Command Center */
export interface ExecutiveStats {
  totalOrganizations: number;
  totalSignals: number;
  criticalAlerts: number;
  recommendationsPending: number;
  averageIntelligenceScore: number;
  lastUpdated: string;
}

/** A briefing card shown on the Command Center */
export interface IntelligenceBriefingCard {
  id: string;
  title: string;
  summary: string;
  priority: PriorityLevel;
  signals: IntelligenceSignal[];
  recommendations: Recommendation[];
  generatedAt: string;
  expiresAt: string;
  confidence: number;
}
