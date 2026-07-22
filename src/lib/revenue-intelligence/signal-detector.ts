// ── Phase 7.6: Signal Detector ──
// Scans CompanySignals for a given company and classifies them into
// revenue-relevant OpportunitySignal records using keyword matching.

import { db } from '@/lib/db';
import { matchSignalPatterns, type PatternMatch, type SignalCategory } from './signal-patterns';

export interface RawSignal {
  id: string;
  signalType: string;
  title: string;
  description: string | null;
  source: string | null;
  confidence: number;
  impact: string;
  createdAt: Date;
}

export interface DetectedSignal {
  companyId: string;
  signalType: SignalCategory;
  title: string;
  description: string;
  supportingIntelligenceIds: string[];
  score: number;
  confidence: number;
}

/**
 * Detect revenue signals for a single company by scanning all its CompanySignals.
 * Uses pure keyword matching — no ML/NLP.
 */
export async function detectSignalsForCompany(companyId: string): Promise<DetectedSignal[]> {
  const signals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'active', 'validated'] },
    },
    select: {
      id: true,
      signalType: true,
      title: true,
      description: true,
      source: true,
      confidence: true,
      impact: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return analyzeSignals(companyId, signals);
}

/**
 * Bulk-detect signals for multiple companies.
 */
export async function detectSignalsForCompanies(companyIds: string[]): Promise<Map<string, DetectedSignal[]>> {
  const results = new Map<string, DetectedSignal[]>();

  const signals = await db.companySignal.findMany({
    where: {
      companyId: { in: companyIds },
      status: { in: ['detected', 'active', 'validated'] },
    },
    select: {
      id: true,
      companyId: true,
      signalType: true,
      title: true,
      description: true,
      source: true,
      confidence: true,
      impact: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const byCompany = new Map<string, RawSignal[]>();
  for (const s of signals) {
    const arr = byCompany.get(s.companyId) || [];
    arr.push(s);
    byCompany.set(s.companyId, arr);
  }

  for (const [cid, companySignals] of byCompany) {
    results.set(cid, analyzeSignals(cid, companySignals));
  }

  for (const cid of companyIds) {
    if (!results.has(cid)) {
      results.set(cid, []);
    }
  }

  return results;
}

/**
 * Core analysis: scan raw signals, match against patterns, produce DetectedSignals.
 * Groups supporting signals by category and produces one DetectedSignal per category.
 */
export function analyzeSignals(companyId: string, signals: RawSignal[]): DetectedSignal[] {
  if (signals.length === 0) return [];

  const categoryGroups = new Map<SignalCategory, {
    matches: PatternMatch[];
    sourceIds: string[];
    rawTexts: string[];
    avgConfidence: number;
    maxImpact: number;
  }>();

  for (const signal of signals) {
    const textToAnalyze = `${signal.title} ${signal.description || ''} ${signal.source || ''}`;
    const matches = matchSignalPatterns(textToAnalyze);

    for (const match of matches) {
      if (!categoryGroups.has(match.category)) {
        categoryGroups.set(match.category, {
          matches: [],
          sourceIds: [],
          rawTexts: [],
          avgConfidence: 0,
          maxImpact: 0,
        });
      }
      const group = categoryGroups.get(match.category)!;
      group.matches.push(match);
      group.sourceIds.push(signal.id);
      group.rawTexts.push(signal.title);

      const impactScore = signal.impact === 'high' ? 1 : signal.impact === 'medium' ? 0.5 : 0.25;
      group.maxImpact = Math.max(group.maxImpact, impactScore);
    }
  }

  const detected: DetectedSignal[] = [];
  for (const [category, group] of categoryGroups) {
    const totalScore = group.matches.reduce((sum, m) => sum + m.score, 0);
    const avgScore = totalScore / group.matches.length;

    const signalCountBoost = Math.min(group.sourceIds.length * 5, 20);
    const finalScore = Math.min(100, avgScore + signalCountBoost);

    const uniqueSourceIds = [...new Set(group.sourceIds)];

    const topMatch = group.matches[0];
    const title = buildSignalTitle(category, topMatch, group.rawTexts);
    const description = buildSignalDescription(category, group.matches, group.rawTexts.length);

    detected.push({
      companyId,
      signalType: category,
      title,
      description,
      supportingIntelligenceIds: uniqueSourceIds,
      score: Math.round(finalScore * 10) / 10,
      confidence: topMatch.weight,
    });
  }

  return detected.sort((a, b) => b.score - a.score);
}

/**
 * Persist detected signals to the database.
 * Upserts by companyId + signalType (one signal per category per company).
 */
export async function persistDetectedSignals(companyId: string, signals: DetectedSignal[]): Promise<number> {
  let count = 0;

  for (const signal of signals) {
    const existing = await db.opportunitySignal.findFirst({
      where: { companyId, signalType: signal.signalType, status: { in: ['new', 'validated'] } },
    });

    if (existing) {
      await db.opportunitySignal.update({
        where: { id: existing.id },
        data: {
          title: signal.title,
          description: signal.description,
          supportingIntelligenceIds: JSON.stringify(signal.supportingIntelligenceIds),
          score: signal.score,
          confidence: signal.confidence,
        },
      });
    } else {
      await db.opportunitySignal.create({
        data: {
          companyId,
          signalType: signal.signalType,
          title: signal.title,
          description: signal.description,
          supportingIntelligenceIds: JSON.stringify(signal.supportingIntelligenceIds),
          score: signal.score,
          confidence: signal.confidence,
          status: 'new',
        },
      });
    }
    count++;
  }

  return count;
}

// ── Helpers ──

function buildSignalTitle(category: SignalCategory, topMatch: PatternMatch, rawTexts: string[]): string {
  const categoryLabels: Record<SignalCategory, string> = {
    TECHNOLOGY: 'Technology Signal',
    GROWTH: 'Growth Signal',
    PARTNERSHIP: 'Partnership Signal',
    PAIN: 'Pain Point Signal',
    LEADERSHIP: 'Leadership Signal',
  };
  const keywordsStr = topMatch.matchedKeywords.slice(0, 3).join(', ');
  return `${categoryLabels[category]}: ${keywordsStr}`;
}

function buildSignalDescription(category: SignalCategory, matches: PatternMatch[], signalCount: number): string {
  const allKeywords = [...new Set(matches.flatMap(m => m.matchedKeywords))].slice(0, 5);
  return `Detected ${allKeywords.length} relevant keywords across ${signalCount} intelligence items: ${allKeywords.join(', ')}.`;
}
