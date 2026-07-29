/**
 * Phase 2B — Cross-Signal Correlation Engine
 *
 * Analyzes signals for a single company to detect multi-signal patterns
 * that individual signals can't reveal.
 *
 * Key insight: "They hired 5 engineers" is one data point.
 * "They hired 5 engineers AND adopted Kubernetes AND hired a VP Engineering"
 * is a CORRELATION that means something completely different.
 *
 * Pure functions — no DB access. Takes signals in, returns insights out.
 */

// ─── Pattern Types ───────────────────────────────────────────────

export type CorrelationPattern =
  | 'hiring_spree'
  | 'tech_overhaul'
  | 'leadership_reset'
  | 'expansion_wave'
  | 'funding_momentum'
  | 'partnership_ecosystem'
  | 'digital_transformation'
  | 'market_shift';

export interface CorrelationInsight {
  pattern: CorrelationPattern;
  description: string;
  confidence: number;
  signalIds: string[];
  signalCount: number;
  typeDiversity: number;
  businessImplication: string;
  recommendedAction: string;
  recencyDays: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
}

// ─── Pattern Definitions ─────────────────────────────────────────

interface PatternDefinition {
  type: CorrelationPattern;
  requiredTypes: string[];
  minSignals: number;
  minTypeDiversity: number;
  description: string;
  businessImplication: string;
  recommendedAction: string;
}

const PATTERN_DEFINITIONS: PatternDefinition[] = [
  {
    type: 'hiring_spree',
    requiredTypes: ['hiring'],
    minSignals: 3,
    minTypeDiversity: 1,
    description: 'Active multi-role hiring indicates significant growth or new project initiation',
    businessImplication: 'Multi-role hiring spree signals a major initiative or growth phase — budget is allocated and teams are being built from scratch',
    recommendedAction: 'Identify the common thread across roles to determine the initiative; engage hiring managers who may be open to solutions that accelerate their timeline',
  },
  {
    type: 'tech_overhaul',
    requiredTypes: ['tech_change', 'technology_adoption', 'hiring'],
    minSignals: 2,
    minTypeDiversity: 2,
    description: 'Technology platform changes combined with hiring signals indicate a major technical transformation',
    businessImplication: 'Technology overhaul signals dissatisfaction with current stack and active modernization — prime window for competitive positioning',
    recommendedAction: 'Map their new tech stack to your capabilities; prepare technical deep-dive; position as the bridge between old and new',
  },
  {
    type: 'leadership_reset',
    requiredTypes: ['leadership_change', 'people_change'],
    minSignals: 2,
    minTypeDiversity: 1,
    description: 'Multiple leadership/management changes suggest a strategic reset or reorganization',
    businessImplication: 'Leadership reset creates a window of openness to new vendors — new leaders want to make their mark within the first 90 days',
    recommendedAction: 'Map new leaders to your account coverage; prepare tailored value propositions; fast-track engagement before old relationships re-solidify',
  },
  {
    type: 'expansion_wave',
    requiredTypes: ['expansion', 'hiring', 'partnership'],
    minSignals: 2,
    minTypeDiversity: 2,
    description: 'Expansion combined with hiring and partnerships indicates active market growth',
    businessImplication: 'Expansion wave signals infrastructure and service gaps in new markets — scalable solutions are needed urgently',
    recommendedAction: 'Position solutions for new market requirements; identify local stakeholders; propose pilot programs',
  },
  {
    type: 'funding_momentum',
    requiredTypes: ['funding', 'hiring', 'expansion'],
    minSignals: 2,
    minTypeDiversity: 2,
    description: 'Recent funding combined with hiring or expansion signals active investment deployment',
    businessImplication: 'Post-funding momentum means budget is available NOW and leadership is focused on deployment speed',
    recommendedAction: 'Engage executive sponsors immediately; position solutions as acceleration tools for their funded roadmap',
  },
  {
    type: 'partnership_ecosystem',
    requiredTypes: ['partnership'],
    minSignals: 3,
    minTypeDiversity: 1,
    description: 'Multiple partnership signals indicate active ecosystem building',
    businessImplication: 'Partnership ecosystem building signals integration requirements and competitive positioning opportunities',
    recommendedAction: 'Map all partnerships to competitive landscape; identify integration or displacement opportunities',
  },
  {
    type: 'digital_transformation',
    requiredTypes: ['tech_change', 'technology_adoption', 'hiring', 'leadership_change'],
    minSignals: 3,
    minTypeDiversity: 3,
    description: 'Cloud, AI, modernization combined with leadership and hiring indicate full-scale digital transformation',
    businessImplication: 'Digital transformation is the highest-value sales opportunity — budget is large, timeline is urgent',
    recommendedAction: 'Escalate to senior account team; prepare comprehensive transformation proposal; engage at CIO/CTO level',
  },
  {
    type: 'market_shift',
    requiredTypes: ['acquisition', 'leadership_change', 'tech_change', 'expansion'],
    minSignals: 2,
    minTypeDiversity: 2,
    description: 'Major strategic direction changes indicate the company is pivoting',
    businessImplication: 'Market pivot signals fundamental changes in priorities and vendor relationships',
    recommendedAction: 'Conduct comprehensive account review; identify at-risk and new-opportunity lines',
  },
];

// ─── Correlation Engine ─────────────────────────────────────────

/**
 * Analyze all signals for a company and detect cross-signal patterns.
 *
 * @param signals - Company signals to analyze
 * @returns Array of detected correlation insights, sorted by confidence
 */
import { normalizeSignalType, type CanonicalSignalType } from './signal-type-mapping';

export function detectCorrelations(signals: {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  severity: string;
  createdAt: Date | string;
  signalDate: Date | string | null;
  confidence: number;
}[]): CorrelationInsight[] {
  if (signals.length < 2) return [];

  const now = Date.now();
  const insights: CorrelationInsight[] = [];

  // Sprint 1: Normalize signal types before grouping
  // This is the P0 fix — old DB types (business, technology, external) are now
  // contextually mapped to the 10-type taxonomy (hiring, funding, tech_change, etc.)
  const normalizedSignals = signals.map(s => ({
    ...s,
    normalizedType: normalizeSignalType(s.signalType, s.title, s.description || undefined).normalizedType,
  }));

  // Group signals by NORMALIZED type
  const byType = new Map<string, typeof normalizedSignals>();
  for (const s of normalizedSignals) {
    const existing = byType.get(s.normalizedType) || [];
    existing.push(s);
    byType.set(s.normalizedType, existing);
  }

  // Check each pattern definition
  for (const pattern of PATTERN_DEFINITIONS) {
    const matchingSignals: typeof normalizedSignals = [];
    const matchingTypes = new Set<string>();

    for (const reqType of pattern.requiredTypes) {
      const typeSignals = byType.get(reqType);
      if (typeSignals) {
        matchingSignals.push(...typeSignals);
        matchingTypes.add(reqType);
      }
    }

    if (matchingSignals.length < pattern.minSignals) continue;
    if (matchingTypes.size < pattern.minTypeDiversity) continue;

    // Deduplicate by signal ID
    const uniqueSignals = [...new Map(matchingSignals.map(s => [s.id, s])).values()];

    // Compute recency
    const dates = uniqueSignals.map(s => {
      const d = s.signalDate || s.createdAt;
      return d instanceof Date ? d.getTime() : new Date(d).getTime();
    });
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const avgAge = Math.round(uniqueSignals.reduce((sum, s) => {
      const d = s.signalDate || s.createdAt;
      const ts = d instanceof Date ? d.getTime() : new Date(d).getTime();
      return sum + (now - ts) / (1000 * 60 * 60 * 24);
    }, 0) / uniqueSignals.length);

    // Confidence: signal count (30%) + type diversity (30%) + recency (40%)
    const countScore = Math.min(1, uniqueSignals.length / 5);
    const diversityScore = Math.min(1, matchingTypes.size / 4);
    const recencyScore = avgAge < 7 ? 1 : avgAge < 14 ? 0.85 : avgAge < 30 ? 0.7 : 0.5;
    const confidence = Math.round((countScore * 0.3 + diversityScore * 0.3 + recencyScore * 0.4) * 100) / 100;

    insights.push({
      pattern: pattern.type,
      description: pattern.description,
      confidence,
      signalIds: uniqueSignals.map(s => s.id),
      signalCount: uniqueSignals.length,
      typeDiversity: matchingTypes.size,
      businessImplication: pattern.businessImplication,
      recommendedAction: pattern.recommendedAction,
      recencyDays: avgAge,
      firstDetectedAt: earliest.toISOString(),
      lastDetectedAt: latest.toISOString(),
    });
  }

  return insights.sort((a, b) => b.confidence - a.confidence);
}
