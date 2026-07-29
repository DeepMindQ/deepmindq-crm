/**
 * Phase 2C — Cross-Account Intelligence
 *
 * Analyzes signals across ALL accounts to detect industry-wide trends
 * and patterns that individual account analysis can't reveal.
 *
 * Pure functions — no DB access. Takes aggregated signals, returns insights.
 */

export type CrossAccountPattern =
  | 'industry_trend'
  | 'technology_wave'
  | 'competitive_signal'
  | 'market_timing'
  | 'segment_opportunity';

export interface CrossAccountInsight {
  pattern: CrossAccountPattern;
  description: string;
  affectedCompanyIds: string[];
  affectedCompanyNames: string[];
  signalCount: number;
  industry?: string;
  technology?: string;
  businessImplication: string;
  recommendedStrategy: string;
  confidence: number;
  detectedAt: string;
}

import { normalizeSignalType, type CanonicalSignalType } from './signal-type-mapping';

interface AccountSignalAggregate {
  companyId: string;
  companyName: string;
  industry: string | null;
  signalType: string;
  title: string;
  description?: string | null;
  createdAt: Date | string;
  confidence: number;
}

/**
 * Analyze signals across multiple accounts to detect portfolio-wide patterns.
 * Sprint 1: Signal types are normalized before analysis.
 */
export function detectCrossAccountPatterns(
  accountSignals: AccountSignalAggregate[]
): CrossAccountInsight[] {
  if (accountSignals.length < 5) return [];

  const insights: CrossAccountInsight[] = [];
  const now = new Date();

  // Sprint 1: Normalize signal types for cross-account analysis
  const normalizedSignals = accountSignals.map(s => ({
    ...s,
    normalizedType: normalizeSignalType(s.signalType, s.title, s.description || undefined).normalizedType,
  }));

  // ── Pattern 1: Industry trend ─────────────────────────────
  const byIndustry = new Map<string, typeof normalizedSignals>();
  for (const s of normalizedSignals) {
    if (s.industry) {
      const list = byIndustry.get(s.industry) || [];
      list.push(s);
      byIndustry.set(s.industry, list);
    }
  }

  for (const [industry, signals] of byIndustry) {
    if (signals.length < 3) continue;
    const companiesByType = new Map<string, Set<string>>();
    for (const s of signals) {
      const companies = companiesByType.get(s.normalizedType) || new Set();
      companies.add(s.companyId);
      companiesByType.set(s.normalizedType, companies);
    }

    for (const [signalType, companies] of companiesByType) {
      if (companies.size < 3) continue;
      const matching = signals.filter(s => s.normalizedType === signalType);
      insights.push({
        pattern: 'industry_trend',
        description: `${companies.size} ${industry} companies show ${signalType.replace(/_/g, ' ')} signals — potential industry trend`,
        affectedCompanyIds: [...companies],
        affectedCompanyNames: [...new Set(matching.map(s => s.companyName))],
        signalCount: matching.length,
        industry,
        businessImplication: `Industry-wide ${signalType.replace(/_/g, ' ')} in ${industry} indicates a sector-level shift — engage all affected accounts with industry-specific messaging`,
        recommendedStrategy: `Create industry-specific outreach for ${industry} accounts; reference sector trend; position solutions as industry-standard`,
        confidence: Math.min(0.9, companies.size * 0.15 + matching.length * 0.05),
        detectedAt: now.toISOString(),
      });
    }
  }

  // ── Pattern 2: Technology wave ────────────────────────────
  const techSignals = normalizedSignals.filter(s => s.normalizedType === 'technology_adoption');
  if (techSignals.length >= 3) {
    insights.push({
      pattern: 'technology_wave',
      description: `${techSignals.length} accounts show technology adoption signals — potential market technology shift`,
      affectedCompanyIds: [...new Set(techSignals.map(s => s.companyId))],
      affectedCompanyNames: [...new Set(techSignals.map(s => s.companyName))],
      signalCount: techSignals.length,
      businessImplication: 'Cross-account technology adoption suggests a market-wide shift — early adopters indicate where the market is heading',
      recommendedStrategy: 'Map the technology pattern across accounts; identify integration and competitive implications; prepare technology-specific campaign',
      confidence: Math.min(0.85, techSignals.length * 0.1),
      detectedAt: now.toISOString(),
    });
  }

  // ── Pattern 3: Segment opportunity ───────────────────────
  const buyingTypes = new Set(['funding', 'hiring', 'tech_change', 'technology_adoption', 'expansion']);
  const buyingSignals = normalizedSignals.filter(s => buyingTypes.has(s.normalizedType));
  const accountMap = new Map<string, { name: string; count: number; types: Set<string> }>();
  for (const s of buyingSignals) {
    const existing = accountMap.get(s.companyId) || { name: s.companyName, count: 0, types: new Set<string>() };
    existing.count++;
    existing.types.add(s.normalizedType);
    accountMap.set(s.companyId, existing);
  }
  const hotAccounts = Array.from(accountMap.entries()).filter(([_, d]) => d.count >= 2 && d.types.size >= 2);
  if (hotAccounts.length >= 3) {
    insights.push({
      pattern: 'segment_opportunity',
      description: `${hotAccounts.length} accounts show multiple buying signals — high-priority engagement segment`,
      affectedCompanyIds: hotAccounts.map(([id]) => id),
      affectedCompanyNames: hotAccounts.map(([_, d]) => d.name),
      signalCount: hotAccounts.reduce((sum, [_, d]) => sum + d.count, 0),
      businessImplication: 'Multiple accounts with diverse buying signals indicate a portfolio-wide opportunity window',
      recommendedStrategy: 'Escalate hot accounts to senior team; allocate dedicated resources; prepare account-specific proposals',
      confidence: Math.min(0.9, hotAccounts.length * 0.15),
      detectedAt: now.toISOString(),
    });
  }

  return insights.sort((a, b) => b.confidence - a.confidence);
}
