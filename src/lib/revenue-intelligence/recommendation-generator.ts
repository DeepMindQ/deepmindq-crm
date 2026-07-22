// ── Phase 7.6: Recommendation Generator ──
// Generates executive recommendations using hybrid approach:
// Rule engine determines recommendation structure → template-based narrative.

import { db } from '@/lib/db';
import type { SignalCategory } from './signal-patterns';

export interface Recommendation {
  companyId: string;
  companyName: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  suggestedConversation: string;
  targetDecisionMaker: string;
  whyNow: string;
  supportingSignals: Array<{ type: string; title: string; score: number }>;
  confidence: number;
}

/**
 * Generate executive recommendations for a company.
 * Uses rule-based logic — no LLM hallucination.
 */
export async function generateRecommendations(companyId: string): Promise<Recommendation[]> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      rawName: true,
      industry: true,
      status: true,
      lifecycleStage: true,
      engagementScore: true,
    },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  // Fetch opportunity signals
  const oppSignals = await db.opportunitySignal.findMany({
    where: { companyId, status: { in: ['new', 'validated'] } },
    orderBy: { score: 'desc' },
  });

  // Fetch account score
  const latestScore = await db.accountScore.findFirst({
    where: { companyId },
    orderBy: { calculatedAt: 'desc' },
  });

  const recs: Recommendation[] = [];
  const supportingSignals = oppSignals.map(s => ({
    type: s.signalType,
    title: s.title,
    score: s.score,
  }));

  // Rule 1: High score + no active pursuits → engage now
  if (latestScore && latestScore.score >= 70) {
    recs.push({
      companyId,
      companyName: company.rawName,
      category: latestScore.category,
      priority: 'high',
      action: `Initiate strategic engagement with ${company.rawName}`,
      rationale: `Account score of ${latestScore.score}/100 indicates strong revenue potential. Category: ${latestScore.category.replace(/_/g, ' ')}.`,
      suggestedConversation: 'Open with value proposition tied to detected technology/growth signals. Focus on business outcomes.',
      targetDecisionMaker: inferTarget(oppSignals),
      whyNow: `Multiple active signals detected. Score of ${latestScore.score} places this in the ${latestScore.category.replace(/_/g, ' ')} tier.`,
      supportingSignals: supportingSignals.slice(0, 5),
      confidence: Math.min(1, latestScore.score / 100),
    });
  }

  // Rule 2: Technology signals → CTO/CIO pitch
  const techSignals = oppSignals.filter(s => s.signalType === 'TECHNOLOGY' && s.score > 50);
  if (techSignals.length > 0) {
    recs.push({
      companyId,
      companyName: company.rawName,
      category: latestScore?.category || 'NURTURE',
      priority: 'high',
      action: `Position technology capabilities for ${company.rawName}`,
      rationale: `${techSignals.length} technology signals with scores > 50 detected: ${techSignals.map(s => s.title).join(', ')}.`,
      suggestedConversation: 'Lead with technology modernization narrative. Reference their specific tech stack changes.',
      targetDecisionMaker: 'CTO / CIO / VP Engineering',
      whyNow: 'Active technology adoption signals indicate budget allocation and decision window.',
      supportingSignals: techSignals.map(s => ({ type: s.signalType, title: s.title, score: s.score })),
      confidence: 0.85,
    });
  }

  // Rule 3: Pain signals → consultative approach
  const painSignals = oppSignals.filter(s => s.signalType === 'PAIN');
  if (painSignals.length > 0) {
    recs.push({
      companyId,
      companyName: company.rawName,
      category: latestScore?.category || 'NURTURE',
      priority: 'high',
      action: `Address ${company.rawName}'s detected pain points`,
      rationale: `Pain point signals detected: ${painSignals.map(s => s.title).join(', ')}. High-impact selling opportunity.`,
      suggestedConversation: 'Open with empathy for their challenges. Present case studies of similar companies who solved these issues.',
      targetDecisionMaker: inferTarget(oppSignals),
      whyNow: 'Pain signals create urgency — these issues are top-of-mind for decision makers.',
      supportingSignals: painSignals.map(s => ({ type: s.signalType, title: s.title, score: s.score })),
      confidence: 0.9,
    });
  }

  // Rule 4: Growth signals → expansion conversation
  const growthSignals = oppSignals.filter(s => s.signalType === 'GROWTH');
  if (growthSignals.length > 0) {
    recs.push({
      companyId,
      companyName: company.rawName,
      category: latestScore?.category || 'NURTURE',
      priority: 'medium',
      action: `Engage ${company.rawName} for expansion support`,
      rationale: `Growth signals detected: ${growthSignals.map(s => s.title).join(', ')}. Scaling companies need external support.`,
      suggestedConversation: 'Focus on scalability challenges. Position your solution as a growth enabler.',
      targetDecisionMaker: 'CEO / COO / VP Operations',
      whyNow: 'Growth phase companies are actively seeking solutions to support scaling.',
      supportingSignals: growthSignals.map(s => ({ type: s.signalType, title: s.title, score: s.score })),
      confidence: 0.75,
    });
  }

  // Rule 5: Leadership change → new relationship building
  const leadershipSignals = oppSignals.filter(s => s.signalType === 'LEADERSHIP');
  if (leadershipSignals.length > 0) {
    recs.push({
      companyId,
      companyName: company.rawName,
      category: latestScore?.category || 'NURTURE',
      priority: 'medium',
      action: `Build relationship with new leadership at ${company.rawName}`,
      rationale: `Leadership changes detected: ${leadershipSignals.map(s => s.title).join(', ')}. New leaders often bring new priorities.`,
      suggestedConversation: 'Introduce yourself and your capabilities. New leaders evaluate vendors fresh.',
      targetDecisionMaker: 'New C-suite executive',
      whyNow: 'Leadership transitions create a vendor evaluation window — be first to establish relationship.',
      supportingSignals: leadershipSignals.map(s => ({ type: s.signalType, title: s.title, score: s.score })),
      confidence: 0.7,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs;
}

/**
 * Infer target decision maker from signal types.
 */
function inferTarget(signals: Array<{ signalType: string }>): string {
  const types = new Set(signals.map(s => s.signalType));
  if (types.has('TECHNOLOGY')) return 'CTO / CIO / VP Engineering';
  if (types.has('LEADERSHIP')) return 'CEO / COO';
  if (types.has('PAIN')) return 'COO / VP Operations';
  if (types.has('GROWTH')) return 'CEO / CFO';
  return 'C-suite / VP Level';
}
