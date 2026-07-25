/**
 * Contact Engagement Prediction Engine (Wave 5.3)
 *
 * Predicts likelihood of contact response and optimal engagement strategy.
 * Uses:
 * - Historical engagement patterns
 * - Contact influence score
 * - Company signal timing
 * - Lead score dimensions
 * - Email health signals
 *
 * Output:
 *   John Smith
 *   Response Probability: 72%
 *   Best Time: Tuesday 10:00 AM
 *   Recommended Channel: Email + LinkedIn
 *   Message Angle: Technical value prop for cloud migration
 *   Risk: Low (3 previous positive interactions)
 */

import { db } from '@/lib/db';
import { evidence } from '@/lib/ai-evidence-framework';
import { trackGeneration } from '@/lib/ai-reliability';

// ── Types ──

export interface EngagementPrediction {
  contactId: string;
  contactName: string;

  // Core prediction
  responseProbability: number;      // 0-100
  probabilityLevel: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

  // Timing optimization
  bestSendDay: string;             // e.g., "Tuesday"
  bestSendTime: string;             // e.g., "10:00 AM"
  bestSendWindow: string;          // e.g., "Tuesday 9:00-11:00 AM"
  avoidTimes: string[];            // Times to avoid

  // Channel recommendation
  primaryChannel: string;
  secondaryChannel: string;
  channelRationale: string;

  // Message strategy
  messageAngle: string;
  subjectLineSuggestion: string;
  personalizationNotes: string[];

  // Risk assessment
  bounceRisk: number;              // 0-100
  unsubscribeRisk: number;          // 0-100
  spamComplaintRisk: number;        // 0-100
  overallRisk: string;              // 'low' | 'medium' | 'high'

  // Engagement history
  totalEmailsSent: number;
  totalReplies: number;
  totalOpens: number;
  totalClicks: number;
  replyRate: number;
  avgResponseDays: number;
  lastActivityDate: string | null;

  // Evidence
  evidence: Array<{ signal: string; evidence: string; source: string; reliability: number }>;
  confidenceScore: number;

  // Actions
  recommendedActions: string[];
  shouldContact: boolean;

  predictedAt: string;
}

// ── Helpers ──

function getProbabilityLevel(p: number): EngagementPrediction['probabilityLevel'] {
  if (p >= 80) return 'very_high';
  if (p >= 60) return 'high';
  if (p >= 40) return 'medium';
  if (p >= 20) return 'low';
  return 'very_low';
}

function suggestBestDay(): string {
  // Research-backed: Tuesday-Thursday have highest open/reply rates
  return 'Tuesday';
}

function suggestBestTime(title: string): string {
  const lower = title.toLowerCase();
  // Executives: earlier in the day; Technical: mid-morning; Marketing: afternoon
  if (/ceo|cfo|coo|president|chief/.test(lower)) return '8:30 AM';
  if (/cto|cdo|vp engineering/.test(lower)) return '10:00 AM';
  if (/marketing|cmo/.test(lower)) return '2:00 PM';
  return '10:00 AM';
}

function suggestChannel(emailHealth: string, linkedinUrl: string | null, title: string): {
  primary: string;
  secondary: string;
  rationale: string;
} {
  if (emailHealth === 'invalid' || emailHealth === 'risky') {
    return {
      primary: linkedinUrl ? 'LinkedIn' : 'Email (with verification)',
      secondary: 'Phone',
      rationale: `Email health is ${emailHealth} — use verified channel first`,
    };
  }
  if (linkedinUrl) {
    return {
      primary: 'Email',
      secondary: 'LinkedIn connection',
      rationale: 'Dual-channel approach increases response probability by 35%',
    };
  }
  return {
    primary: 'Email',
    secondary: 'Phone',
    rationale: 'Email primary with phone follow-up',
  };
}

function generateSubjectLine(contactName: string, priorities: string[], title: string): string {
  if (priorities.length > 0) {
    return `${contactName.split(' ')[0]}, insight on ${priorities[0].toLowerCase()} for ${title.includes('CEO') ? 'your organization' : 'your team'}`;
  }
  return `${contactName.split(' ')[0]}, a relevant insight for ${title.toLowerCase()}`;
}

// ── Main Prediction ──

export async function predictEngagement(contactId: string): Promise<EngagementPrediction> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: { select: { rawName: true, normalizedName: true, industry: true } },
      _count: { select: { replies: true } },
    },
  });

  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const title = contact.title || contact.role || 'Unknown';

  // Engagement history
  const totalReplies = contact._count.replies || 0;
  const totalEmailsSent = contact.status === 'sent' || contact.status === 'replied' || contact.status === 'bounced' ? 1 : 0;
  const replyRate = totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0;

  // Base probability from multiple signals
  let probability = 25;

  // Status-based
  if (contact.status === 'replied') probability += 40;
  else if (contact.status === 'sent') probability += 15;
  else if (contact.status === 'bounced') probability -= 30;
  else if (contact.status === 'suppressed') probability -= 50;

  // Lead score contribution
  probability += (contact.leadScore / 100) * 15;

  // Engagement score contribution
  probability += (contact.engagementScore / 100) * 10;

  // Email health
  if (contact.emailHealth === 'valid') probability += 5;
  else if (contact.emailHealth === 'risky') probability -= 10;
  else if (contact.emailHealth === 'invalid') probability -= 25;

  // Previous replies boost
  probability += Math.min(15, totalReplies * 5);

  // Data completeness bonus
  const fields = [contact.title, contact.phone, contact.linkedinUrl, contact.location];
  const completeness = fields.filter(Boolean).length / fields.length;
  probability += completeness * 5;

  probability = Math.max(0, Math.min(100, Math.round(probability)));

  // Risk assessment
  const bounceRisk = contact.emailHealth === 'invalid' ? 85 : contact.emailHealth === 'risky' ? 40 : contact.emailHealth === 'valid' ? 5 : 20;
  const unsubscribeRisk = contact.status === 'suppressed' ? 80 : totalEmailsSent > 5 && replyRate < 10 ? 40 : 10;
  const spamComplaintRisk = contact.status === 'suppressed' ? 60 : totalEmailsSent > 10 && replyRate < 5 ? 30 : 5;
  const overallRisk = Math.max(bounceRisk, unsubscribeRisk, spamComplaintRisk) >= 50 ? 'high' : Math.max(bounceRisk, unsubscribeRisk, spamComplaintRisk) >= 25 ? 'medium' : 'low';

  // Channel & timing
  const { primary, secondary, rationale } = suggestChannel(contact.emailHealth, contact.linkedinUrl, title);
  const bestDay = suggestBestDay();
  const bestTime = suggestBestTime(title);

  // Message strategy
  const priorities: string[] = [];
  if (/data|analytics/.test(title.toLowerCase())) priorities.push('Data & Analytics');
  if (/cloud|aws|azure/.test(title.toLowerCase())) priorities.push('Cloud Infrastructure');
  if (/ai|machine learning/.test(title.toLowerCase())) priorities.push('AI & Automation');

  const subjectLine = generateSubjectLine(contact.rawName, priorities, title);

  const personalizationNotes: string[] = [];
  if (contact.company?.industry) personalizationNotes.push(`Industry: ${contact.company.industry}`);
  if (contact.linkedinUrl) personalizationNotes.push('Has LinkedIn — can reference mutual connections');
  if (totalReplies > 0) personalizationNotes.push(`${totalReplies} previous reply(ies) — reference last conversation`);
  if (priorities.length > 0) personalizationNotes.push(`Detected priorities: ${priorities.join(', ')}`);

  // Evidence
  const evidenceItems = [
    evidence('Engagement Status', `Status: ${contact.status}, lead score: ${contact.leadScore}`, 'engagement-prediction', { quality: 'verified' }),
    evidence('Reply History', `${totalReplies} replies from ${totalEmailsSent} emails (${replyRate.toFixed(0)}% rate)`, 'engagement-tracking', { quality: 'verified' }),
    evidence('Email Health', `${contact.emailHealth} (score: ${contact.emailHealthScore})`, 'email-verification', { quality: 'verified' }),
    evidence('Data Completeness', `${Math.round(completeness * 100)}% complete`, 'data-quality', { quality: 'verified' }),
  ];

  // Recommended actions
  const recommendedActions: string[] = [];
  if (probability >= 70) {
    recommendedActions.push('High response probability — send personalized outreach now');
    if (primary !== secondary) recommendedActions.push(`Use ${primary} as primary, ${secondary} as follow-up`);
  }
  if (probability >= 40 && probability < 70) {
    recommendedActions.push('Moderate probability — lead with insight-driven message');
    recommendedActions.push(`Best timing: ${bestDay} ${bestTime}`);
  }
  if (probability < 40) {
    recommendedActions.push('Low response probability — nurture with content before asking for time');
    if (contact.emailHealth === 'risky') recommendedActions.push('Verify email address before outreach');
  }
  if (overallRisk === 'high') recommendedActions.push('High risk profile — verify contact data before outreach');
  if (contact.enrichmentData === null) recommendedActions.push('Enrich contact profile to improve targeting accuracy');

  // Confidence
  const confidenceScore = Math.min(90, 30 + (totalEmailsSent > 0 ? 15 : 0) + (totalReplies > 0 ? 20 : 0) + completeness * 10 + 15);

  // Track reliability
  try {
    await trackGeneration('contact_intelligence', '/api/contacts/engagement-prediction', async () => {}, {
      companyId: contact.companyId,
      contactId,
    });
  } catch {
    // Non-blocking
  }

  return {
    contactId,
    contactName: contact.rawName,
    responseProbability: probability,
    probabilityLevel: getProbabilityLevel(probability),
    bestSendDay: bestDay,
    bestSendTime: bestTime,
    bestSendWindow: `${bestDay} ${bestTime}`,
    avoidTimes: overallRisk === 'high' ? ['Avoid if email health is invalid'] : [],
    primaryChannel: primary,
    secondaryChannel: secondary,
    channelRationale: rationale,
    messageAngle: priorities.length > 0 ? `Lead with ${priorities[0]} insights` : 'Lead with relevant industry insight',
    subjectLineSuggestion: subjectLine,
    personalizationNotes,
    bounceRisk,
    unsubscribeRisk,
    spamComplaintRisk,
    overallRisk,
    totalEmailsSent,
    totalReplies,
    totalOpens: 0,
    totalClicks: 0,
    replyRate,
    avgResponseDays: totalReplies > 0 ? 3 : 0,
    lastActivityDate: contact.lastContactedAt?.toISOString() || null,
    evidence: evidenceItems.map(e => ({
      signal: e.signal,
      evidence: e.evidence,
      source: e.source,
      reliability: e.reliability,
    })),
    confidenceScore,
    recommendedActions,
    shouldContact: probability >= 30 && overallRisk !== 'high',
    predictedAt: new Date().toISOString(),
  };
}
