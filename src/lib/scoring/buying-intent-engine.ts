/**
 * Buying Intent Engine (Wave 8.2)
 *
 * Detects and scores buying intent signals for a company:
 * - Technology trigger signals (new CTO, tech migration, funding)
 * - Growth signals (hiring, expansion, new offices)
 * - Pain point signals (compliance issues, vendor complaints)
 * - Engagement signals (website visits, content consumption)
 * - Market timing signals (industry trends, regulatory changes)
 */

import { db } from '@/lib/db';
import { createInsight } from '@/lib/ai-insight-service';

export type IntentSignalCategory = 'technology_trigger' | 'growth' | 'pain_point' | 'engagement' | 'market_timing';

export interface BuyingIntentScore {
  companyId: string;
  companyName: string;
  overallIntentScore: number;    // 0-100
  intentStrength: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  categoryScores: Record<IntentSignalCategory, number>;
  topSignals: Array<{
    signal: string;
    category: IntentSignalCategory;
    score: number;
    source: string;
    date: string;
  }>;
  recommendedApproach: string;
  timingWindow: string;
}

function getIntentStrength(score: number): BuyingIntentScore['intentStrength'] {
  if (score >= 85) return 'very_high';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'very_low';
}

export async function scoreBuyingIntent(companyId: string): Promise<BuyingIntentScore> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { rawName: true, industry: true },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  // Gather signals from the last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const signals = await db.companySignal.findMany({
    where: { companyId, createdAt: { gte: ninetyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const knowledgeEntries = await db.knowledgeEntry.findMany({
    where: { companyId, updatedAt: { gte: ninetyDaysAgo } },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });

  const opportunitySignals = await db.opportunitySignal.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Score each category
  const categoryScores: Record<IntentSignalCategory, number> = {
    technology_trigger: 0,
    growth: 0,
    pain_point: 0,
    engagement: 0,
    market_timing: 0,
  };

  const topSignals: BuyingIntentScore['topSignals'] = [];

  // Technology triggers from signals
  // CompanySignal.signalType: funding, hiring, leadership_change, tech_change, news, mention, partnership, expansion
  const techSignals = signals.filter(s =>
    s.signalType === 'tech_change' ||
    s.signalType === 'leadership_change' ||
    s.title?.toLowerCase().includes('cto') ||
    s.title?.toLowerCase().includes('cio') ||
    s.title?.toLowerCase().includes('cloud') ||
    s.title?.toLowerCase().includes('ai') ||
    s.title?.toLowerCase().includes('digital') ||
    s.title?.toLowerCase().includes('migration')
  );
  categoryScores.technology_trigger = Math.min(100, techSignals.length * 25);

  techSignals.slice(0, 3).forEach(s => {
    topSignals.push({
      signal: s.title || 'Technology signal detected',
      category: 'technology_trigger',
      score: Math.round((s.confidence || 0.5) * 100),
      source: s.source || 'signal',
      date: s.createdAt.toISOString(),
    });
  });

  // Growth signals
  const growthSignals = signals.filter(s =>
    s.signalType === 'funding' ||
    s.signalType === 'hiring' ||
    s.signalType === 'expansion' ||
    s.title?.toLowerCase().includes('grow') ||
    s.title?.toLowerCase().includes('hire') ||
    s.title?.toLowerCase().includes('fund') ||
    s.title?.toLowerCase().includes('expand')
  );
  categoryScores.growth = Math.min(100, growthSignals.length * 20);

  growthSignals.slice(0, 2).forEach(s => {
    topSignals.push({
      signal: s.title || 'Growth signal detected',
      category: 'growth',
      score: Math.round((s.confidence || 0.5) * 100),
      source: s.source || 'signal',
      date: s.createdAt.toISOString(),
    });
  });

  // Pain points from knowledge
  // KnowledgeEntry.category: Strategy, Products, Technology, Leadership, Opportunities, etc.
  const painEntries = knowledgeEntries.filter(k =>
    k.category === 'Opportunities' ||
    k.content?.toLowerCase().includes('challenge') ||
    k.content?.toLowerCase().includes('problem') ||
    k.content?.toLowerCase().includes('risk') ||
    k.content?.toLowerCase().includes('compliance') ||
    k.content?.toLowerCase().includes('pain') ||
    k.content?.toLowerCase().includes('struggle')
  );
  categoryScores.pain_point = Math.min(100, painEntries.length * 15);

  painEntries.slice(0, 2).forEach(k => {
    topSignals.push({
      signal: k.content.substring(0, 100),
      category: 'pain_point',
      score: Math.round((k.confidence || 0.5) * 100),
      source: k.source || 'knowledge',
      date: k.updatedAt.toISOString(),
    });
  });

  // Engagement signals (replies, interactions)
  const contactCount = await db.contact.count({ where: { companyId } });
  const repliedContacts = await db.contact.count({ where: { companyId, status: 'replied' } });
  const sentContacts = await db.contact.count({ where: { companyId, status: 'sent' } });
  const engagementSignals = signals.filter(s =>
    s.signalType === 'news' ||
    s.signalType === 'mention' ||
    s.title?.toLowerCase().includes('engagement') ||
    s.title?.toLowerCase().includes('visit') ||
    s.title?.toLowerCase().includes('interaction')
  );
  categoryScores.engagement = Math.min(100,
    repliedContacts * 30 + Math.min(40, sentContacts * 5) + engagementSignals.length * 15
  );

  if (repliedContacts > 0) {
    topSignals.push({
      signal: `${repliedContacts} contact(s) replied — active engagement`,
      category: 'engagement',
      score: Math.min(100, repliedContacts * 30),
      source: 'engagement',
      date: new Date().toISOString(),
    });
  }

  // Market timing from opportunity signals
  categoryScores.market_timing = Math.min(100, opportunitySignals.length * 20);
  opportunitySignals.slice(0, 2).forEach(os => {
    topSignals.push({
      signal: os.title || 'Opportunity signal',
      category: 'market_timing',
      score: Math.round((os.confidence || 0.5) * 100),
      source: 'opportunity-signal',
      date: os.createdAt.toISOString(),
    });
  });

  // Sort top signals by score
  topSignals.sort((a, b) => b.score - a.score);

  // Overall intent (weighted average)
  const overallIntentScore = Math.round(
    (categoryScores.technology_trigger * 0.30) +
    (categoryScores.growth * 0.20) +
    (categoryScores.pain_point * 0.25) +
    (categoryScores.engagement * 0.15) +
    (categoryScores.market_timing * 0.10)
  );

  // Recommended approach based on intent profile
  let recommendedApproach: string;
  let timingWindow: string;

  if (categoryScores.technology_trigger >= 60) {
    recommendedApproach = 'Technology trigger detected — lead with technical value prop, target CTO/CIO';
    timingWindow = 'Immediate (0-30 days)';
  } else if (categoryScores.pain_point >= 60) {
    recommendedApproach = 'Pain point identified — lead with problem-solution narrative';
    timingWindow = 'Short-term (30-60 days)';
  } else if (categoryScores.growth >= 60) {
    recommendedApproach = 'Growth phase — position as scaling enabler';
    timingWindow = 'Medium-term (60-90 days)';
  } else if (categoryScores.engagement >= 40) {
    recommendedApproach = 'Warm engagement — continue nurturing with insights';
    timingWindow = 'Ongoing';
  } else {
    recommendedApproach = 'Early stage — build awareness with thought leadership';
    timingWindow = 'Long-term (90+ days)';
  }

  const result: BuyingIntentScore = {
    companyId,
    companyName: company.rawName,
    overallIntentScore,
    intentStrength: getIntentStrength(overallIntentScore),
    categoryScores,
    topSignals: topSignals.slice(0, 8),
    recommendedApproach,
    timingWindow,
  };

  // Persist as AI Insight
  await createInsight({
    companyId,
    type: overallIntentScore >= 60 ? 'OPPORTUNITY' : overallIntentScore >= 40 ? 'SIGNAL' : 'RECOMMENDATION',
    title: `Buying Intent: ${company.rawName} — ${overallIntentScore}/100 (${result.intentStrength.replace('_', ' ')})`,
    description: `${company.rawName} shows ${result.intentStrength.replace('_', ' ')} buying intent (${overallIntentScore}/100). Top categories: Technology ${categoryScores.technology_trigger}, Growth ${categoryScores.growth}, Pain ${categoryScores.pain_point}. ${timingWindow} window.`,
    evidence: topSignals.slice(0, 5).map(s => ({
      source: s.source,
      snippet: s.signal,
      reliability: s.score / 100,
    })),
    confidenceScore: Math.min(90, 50 + topSignals.length * 5),
    impactScore: overallIntentScore,
    urgencyScore: overallIntentScore >= 70 ? 80 : overallIntentScore >= 50 ? 55 : 20,
    recommendedAction: recommendedApproach,
    sourceType: 'intent_engine',
    sourceRoute: '/api/ai/buying-intent',
  });

  return result;
}
