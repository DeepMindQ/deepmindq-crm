/**
 * Phase 2C — Predictive Intelligence Engine
 *
 * Analyzes historical signal patterns to predict future intelligence.
 * Learns from what happened before to forecast what happens next.
 *
 * Pure functions — no DB access. Takes signal history, returns predictions.
 */

// ─── Prediction Types ───────────────────────────────────────────

export type PredictionType =
  | 'likely_hiring_surge'
  | 'tech_investment_wave'
  | 'leadership_cascade'
  | 'expansion_acceleration'
  | 'partnership_chain'
  | 'budget_cycle'
  | 'maturity_shift';

export interface IntelligencePrediction {
  type: PredictionType;
  description: string;
  confidence: number;
  timeframe: string;
  supportingSignals: string[];
  historicalEvidence: string;
  salesImplication: string;
  recommendedPreparation: string;
  predictionDate: string;
}

// ─── Signal History Analysis ────────────────────────────────────

interface SignalHistory {
  signalType: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  averageIntervalDays: number;
  trend: 'accelerating' | 'stable' | 'decelerating';
}

import { normalizeSignalType, type CanonicalSignalType } from './signal-type-mapping';
import { logger } from '@/lib/logger';

function analyzeSignalHistory(signals: {
  signalType: string;
  title?: string;
  description?: string | null;
  createdAt: Date | string;
}[]): Map<string, SignalHistory> {
  const grouped = new Map<string, Date[]>();
  // Sprint 1: Normalize signal types before grouping
  for (const s of signals) {
    const normalizedType = normalizeSignalType(s.signalType, s.title, s.description || undefined).normalizedType;
    const dates = grouped.get(normalizedType) || [];
    dates.push(s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt));
    grouped.set(normalizedType, dates);
  }

  const history = new Map<string, SignalHistory>();
  for (const [type, dates] of grouped) {
    dates.sort((a, b) => a.getTime() - b.getTime());

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    }

    const avgInterval = intervals.length > 0
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length
      : 0;

    let trend: 'accelerating' | 'stable' | 'decelerating' = 'stable';
    if (intervals.length >= 2) {
      const recentAvg = intervals.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, intervals.length);
      if (recentAvg < avgInterval * 0.7) trend = 'accelerating';
      else if (recentAvg > avgInterval * 1.3) trend = 'decelerating';
    }

    history.set(type, {
      signalType: type,
      count: dates.length,
      firstSeen: dates[0],
      lastSeen: dates[dates.length - 1],
      averageIntervalDays: Math.round(avgInterval),
      trend,
    });
  }

  return history;
}

// ─── Prediction Rules ─────────────────────────────────────────

interface PredictionRule {
  type: PredictionType;
  check: (history: Map<string, SignalHistory>) => boolean;
  description: string;
  timeframe: string;
  historicalEvidence: string;
  salesImplication: string;
  recommendedPreparation: string;
}

const PREDICTION_RULES: PredictionRule[] = [
  {
    type: 'likely_hiring_surge',
    check: (history) => {
      const hiring = history.get('hiring');
      if (!hiring || hiring.count < 3) return false;
      return hiring.trend === 'accelerating' && hiring.averageIntervalDays < 14;
    },
    description: 'Hiring signals are accelerating — a hiring surge is likely',
    timeframe: 'next 30 days',
    historicalEvidence: 'Companies that increase hiring frequency typically sustain elevated hiring for 2-4 months',
    salesImplication: 'Rapid team scaling creates urgent need for onboarding tools, collaboration platforms, and training',
    recommendedPreparation: 'Prepare scaling solution proposals; research their tech stack for integration points; identify hiring managers as entry points',
  },
  {
    type: 'tech_investment_wave',
    check: (history) => {
      const tech = history.get('tech_change') || history.get('technology_adoption');
      if (!tech || tech.count < 2) return false;
      return (history.get('hiring')?.count ?? 0) >= 2;
    },
    description: 'Technology investment combined with hiring signals a broader tech transformation wave',
    timeframe: 'next 60 days',
    historicalEvidence: 'Technology adoption follows a pattern: tool selection, hiring specialists, broader rollout, integration needs',
    salesImplication: 'Early-stage tech transformation creates demand for integration, migration, and training services',
    recommendedPreparation: 'Map adopted technologies to your integration capabilities; prepare migration playbooks; identify technical decision-makers',
  },
  {
    type: 'leadership_cascade',
    check: (history) => {
      const leadership = history.get('leadership_change');
      const people = history.get('people_change');
      if (!leadership || leadership.count < 1) return false;
      return (leadership.count >= 2) || ((people?.count ?? 0) >= 2);
    },
    description: 'Leadership changes tend to cascade — more organizational changes are likely',
    timeframe: 'next 60 days',
    historicalEvidence: 'New C-level executives typically make key hires within 90 days, triggering a cascade of appointments',
    salesImplication: 'Leadership cascade creates a window where new decision-makers are establishing priorities and vendor relationships',
    recommendedPreparation: 'Research new leaders backgrounds and prior vendor preferences; prepare tailored value propositions; update account coverage map',
  },
  {
    type: 'expansion_acceleration',
    check: (history) => {
      const expansion = history.get('expansion');
      if (!expansion || expansion.count < 1) return false;
      return (history.get('hiring')?.count ?? 0) >= 2;
    },
    description: 'Expansion combined with hiring predicts accelerated growth trajectory',
    timeframe: 'next 90 days',
    historicalEvidence: 'Companies in expansion mode accelerate hiring, partnerships, and technology investment in the following quarter',
    salesImplication: 'Rapid expansion creates demand for scalable infrastructure, regional solutions, and partnership integrations',
    recommendedPreparation: 'Research expansion target markets; prepare region-specific proposals; identify partnership opportunities',
  },
  {
    type: 'budget_cycle',
    check: (history) => {
      const funding = history.get('funding');
      if (!funding || funding.count < 1) return false;
      return (history.get('hiring')?.count ?? 0) >= 1 || (history.get('expansion')?.count ?? 0) >= 1;
    },
    description: 'Funding followed by hiring/expansion indicates an active budget deployment cycle',
    timeframe: 'next 90 days',
    historicalEvidence: 'Post-funding companies deploy capital in phases: hiring, technology, expansion over 6-12 months',
    salesImplication: 'Active budget deployment means money is flowing and decision-makers are empowered',
    recommendedPreparation: 'Prepare ROI-focused proposals aligned with their funded roadmap; engage executive sponsors controlling budget allocation',
  },
  {
    type: 'maturity_shift',
    check: (history) => {
      const signals = Array.from(history.values());
      const totalSignals = signals.reduce((sum, h) => sum + h.count, 0);
      const techSignals = (history.get('tech_change')?.count || 0) + (history.get('technology_adoption')?.count || 0);
      return totalSignals >= 10 && techSignals >= 3 &&
        signals.every(h => h.trend === 'decelerating' || h.trend === 'stable');
    },
    description: 'High signal volume with decelerating trends suggests company maturing from growth to optimization',
    timeframe: 'next 60 days',
    historicalEvidence: 'Companies transitioning from growth to optimization shift spending from acquisition to efficiency tools',
    salesImplication: 'Maturity shift creates demand for cost optimization, process automation, and efficiency solutions',
    recommendedPreparation: 'Pivot messaging from growth enablement to cost optimization; prepare ROI calculators and benchmark data',
  },
];

// ─── Prediction Engine ──────────────────────────────────────────

/**
 * Generate predictions based on signal history analysis.
 *
 * @param signals - Historical signals for a company
 * @returns Array of predictions sorted by confidence
 */
export function generatePredictions(signals: {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  createdAt: Date | string;
  signalDate: Date | string | null;
  confidence: number;
  severity: string;
}[]): IntelligencePrediction[] {
  if (signals.length < 3) return [];

  const history = analyzeSignalHistory(signals);
  const predictions: IntelligencePrediction[] = [];

  for (const rule of PREDICTION_RULES) {
    try {
      if (rule.check(history)) {
        const supportingIds = signals.map(s => s.id);
        const totalSignals = Array.from(history.values()).reduce((sum, h) => sum + h.count, 0);
        const supportingTypes = Array.from(history.keys()).length;
        const confidence = Math.min(0.9, Math.max(0.2, totalSignals * 0.05 + supportingTypes * 0.1));

        predictions.push({
          type: rule.type,
          description: rule.description,
          confidence: Math.round(confidence * 100) / 100,
          timeframe: rule.timeframe,
          supportingSignals: supportingIds,
          historicalEvidence: rule.historicalEvidence,
          salesImplication: rule.salesImplication,
          recommendedPreparation: rule.recommendedPreparation,
          predictionDate: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.error(`[predictive] Rule ${rule.type} check failed:`, { error: err });
    }
  }

  return predictions.sort((a, b) => b.confidence - a.confidence);
}
