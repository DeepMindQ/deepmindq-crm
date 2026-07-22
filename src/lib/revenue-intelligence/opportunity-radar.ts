// ── Phase 7.6: Opportunity Radar ──
// Aggregates opportunity signals across accounts to identify
// cross-account revenue opportunities.

import { db } from '@/lib/db';
import type { SignalCategory } from './signal-patterns';

export interface OpportunityRadarItem {
  companyId: string;
  companyName: string;
  industry: string | null;
  category: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  signalCount: number;
  topSignals: Array<{ type: string; title: string; score: number }>;
}

/**
 * Get global opportunity radar across all companies.
 */
export async function getGlobalOpportunityRadar(options?: {
  category?: string;
  minScore?: number;
  limit?: number;
}): Promise<OpportunityRadarItem[]> {
  const where: any = { status: { in: ['new', 'validated'] } };
  if (options?.category) where.signalType = options.category;

  const signals = await db.opportunitySignal.findMany({
    where,
    include: {
      company: {
        select: { rawName: true, industry: true },
      },
    },
    orderBy: { score: 'desc' },
    take: options?.limit || 50,
  });

  // Get latest AccountScore per company for category
  const companyIds = [...new Set(signals.map(s => s.companyId))];
  const scores = await db.accountScore.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { calculatedAt: 'desc' },
  });

  const scoreMap = new Map<string, { score: number; category: string }>();
  for (const s of scores) {
    if (!scoreMap.has(s.companyId)) {
      scoreMap.set(s.companyId, { score: s.score, category: s.category });
    }
  }

  // Count signals per company
  const signalCounts = new Map<string, number>();
  const signalDetails = new Map<string, Array<{ type: string; title: string; score: number }>>();
  for (const s of signals) {
    signalCounts.set(s.companyId, (signalCounts.get(s.companyId) || 0) + 1);
    const details = signalDetails.get(s.companyId) || [];
    details.push({ type: s.signalType, title: s.title, score: s.score });
    signalDetails.set(s.companyId, details);
  }

  // Build opportunity items grouped by company
  const companyMap = new Map<string, OpportunityRadarItem>();
  for (const signal of signals) {
    if (companyMap.has(signal.companyId)) continue;

    const scoreInfo = scoreMap.get(signal.companyId);
    const topSignals = (signalDetails.get(signal.companyId) || []).slice(0, 5);

    const item: OpportunityRadarItem = {
      companyId: signal.companyId,
      companyName: signal.company.rawName,
      industry: signal.company.industry,
      category: scoreInfo?.category || 'NURTURE',
      title: `Revenue Opportunity: ${signal.company.rawName}`,
      description: `Account has ${signalCounts.get(signal.companyId) || 0} active revenue signals with top score of ${signal.score}.`,
      score: signal.score,
      confidence: signal.confidence,
      signalCount: signalCounts.get(signal.companyId) || 0,
      topSignals,
    };

    if (options?.minScore && item.score < options.minScore) continue;

    companyMap.set(signal.companyId, item);
  }

  return Array.from(companyMap.values()).sort((a, b) => b.score - a.score);
}
