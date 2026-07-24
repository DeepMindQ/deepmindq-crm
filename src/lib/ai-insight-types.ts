/**
 * AI Insight — Unified AI Output Standard (Wave 8.1)
 *
 * Every AI output across DeepMindQ follows this structure.
 * Answers: What happened? Why? Evidence? Confidence? Impact? What to do?
 */

export type AIInsightType = 'SIGNAL' | 'RISK' | 'OPPORTUNITY' | 'RECOMMENDATION' | 'SCORING' | 'FORECAST';
export type AIInsightStatus = 'active' | 'consumed' | 'expired' | 'superseded' | 'rejected';

export interface AIInsightEvidence {
  source: string;
  url?: string;
  date?: string;
  snippet: string;
  reliability: number; // 0-1
}

export interface AIInsightInput {
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  type: AIInsightType;
  title: string;
  description: string;
  evidence: AIInsightEvidence[];
  confidenceScore: number; // 0-100
  impactScore: number; // 0-100
  urgencyScore: number; // 0-100
  reasoning?: string;
  recommendedAction?: string;
  sourceType?: string;
  sourceRoute?: string;
  modelUsed?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface AIInsightOutput {
  id: string;
  companyId: string | null;
  contactId: string | null;
  opportunityId: string | null;
  type: AIInsightType;
  title: string;
  description: string;
  evidence: AIInsightEvidence[];
  confidenceScore: number;
  impactScore: number;
  urgencyScore: number;
  reasoning: string | null;
  recommendedAction: string | null;
  sourceType: string;
  sourceRoute: string | null;
  modelUsed: string | null;
  status: AIInsightStatus;
  createdAt: Date;
  expiresAt: Date | null;
}