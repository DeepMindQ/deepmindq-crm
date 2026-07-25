/**
 * AI Email Intelligence Engine (Wave 6.1)
 *
 * Generates evidence-backed email recommendations by integrating:
 * - Person Intelligence Profile (priorities, buying role, relationship strength)
 * - Company signals and knowledge
 * - Engagement prediction
 *
 * Output:
 *   Suggested Message: "Sarah, I noticed Microsoft's recent expansion into enterprise AI governance..."
 *   Why This Message: "3 evidence signals: tech_trigger (Azure AI expansion), executive_change (new CDO), engagement (website visit)"
 *   Evidence Used: [3 signals with sources]
 *   Confidence: 78%
 *   Recommended Angle: "Lead with AI governance insight relevant to their CDO role"
 */

import { db } from '@/lib/db';
import { buildPersonProfile } from '@/lib/person-intelligence-engine';
import { evidence, buildEvidenceOutput, type AIEvidenceOutput } from '@/lib/ai-evidence-framework';
import { assessHallucinationRisk, calibrateConfidence, trackGeneration } from '@/lib/ai-reliability';

// ── Types ──

export interface EmailIntelligence {
  contactId: string;
  contactName: string;
  companyName: string;

  // Core recommendation
  suggestedMessage: string;
  suggestedSubject: string;
  messageAngle: string;

  // Evidence chain
  whyThisMessage: string;
  evidenceUsed: Array<{
    signal: string;
    evidence: string;
    source: string;
    reliability: number;
    usedInMessage: boolean;
  }>;

  // Signal-driven personalization
  signalDrivers: string[];
  triggerSignals: Array<{
    signal: string;
    category: string;
    relevance: string;
    detectedAt: string;
  }>;

  // Contact intelligence context
  buyingRole: string;
  buyingInfluence: number;
  detectedPriorities: string[];
  relationshipStrength: string;
  responseProbability: number;

  // AI Quality
  confidenceScore: number;
  evidenceQuality: string;
  hallucinationRisk: number;
  aiConfidence: number;

  // Timing & channel
  bestSendTime: string;
  primaryChannel: string;
  personalizationTokens: string[];

  // Actions
  recommendedNextSteps: string[];

  generatedAt: string;
}

// ── Signal Relevance Detection ──

async function detectRelevantSignals(companyId: string): Promise<EmailIntelligence['triggerSignals']> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const signals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'validated', 'active'] },
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return signals.map(s => ({
    signal: s.title || 'Signal detected',
    category: s.signalType || 'general',
    relevance: s.businessImpact || s.description || 'Relevant to outreach strategy',
    detectedAt: s.createdAt.toISOString(),
  }));
}

// ── Message Angle Generation ──

function generateMessageAngle(
  title: string,
  buyingRole: string,
  priorities: string[],
  triggerSignals: EmailIntelligence['triggerSignals']
): string {
  const topPriority = priorities[0] || 'business growth';
  const topSignal = triggerSignals[0];

  if (topSignal) {
    return `Lead with ${topPriority.toLowerCase()} — reference their recent ${topSignal.signal.toLowerCase()} as conversation opener`;
  }

  if (buyingRole === 'economic_buyer') {
    return `Lead with business outcomes and ROI related to ${topPriority.toLowerCase()}`;
  }
  if (buyingRole === 'technical_buyer') {
    return `Lead with technical capability and integration approach for ${topPriority.toLowerCase()}`;
  }
  if (buyingRole === 'champion') {
    return `Empower with evidence and ammunition for internal advocacy about ${topPriority.toLowerCase()}`;
  }

  return `Lead with insight on ${topPriority.toLowerCase()} relevant to their role as ${title}`;
}

// ── Suggested Message Generation (Template-based with intelligence context) ──

function generateSuggestedMessage(
  contactName: string,
  title: string,
  companyName: string,
  priorities: string[],
  triggerSignals: EmailIntelligence['triggerSignals'],
  relationshipStrength: string
): { subject: string; body: string } {
  const firstName = contactName.split(' ')[0] || 'there';
  const topPriority = priorities[0] || 'business growth';
  const topSignal = triggerSignals[0];

  let subject: string;
  let body: string;

  if (topSignal && relationshipStrength === 'none') {
    // Cold outreach with signal trigger
    subject = `${firstName}, ${topSignal.signal} — a thought for ${companyName}`;
    body = `Hi ${firstName},\n\nI noticed ${companyName} ${topSignal.relevance.toLowerCase()}. This caught my attention because our team has been working extensively with organizations navigating ${topPriority.toLowerCase()}.\n\n${topSignal.category === 'tech_change' || topSignal.category === 'leadership_change'
      ? 'With recent changes in your organization, there may be an opportunity to bring fresh intelligence to your decision-making process.'
      : 'I have some relevant insights that might be valuable as you evaluate your next steps.'}\n\nWould a brief 15-minute conversation be worthwhile? I can share specific examples of how similar organizations are approaching ${topPriority.toLowerCase()}.\n\nBest regards`;
  } else if (relationshipStrength === 'warm' || relationshipStrength === 'strong') {
    // Warm/follow-up
    subject = `${firstName}, following up on ${companyName}'s ${topPriority.toLowerCase()}`;
    body = `Hi ${firstName},\n\nI wanted to reconnect given some recent developments I've been tracking around ${topPriority.toLowerCase()} at ${companyName}.\n\n${topSignal ? `I noticed ${topSignal.relevance.toLowerCase()} — this seems like it could be a pivotal moment for your team.` : 'It seems like an active period for your organization, and I thought it would be valuable to reconnect.'}\n\nIf you're open to it, I'd love to share some updated intelligence that could inform your approach. Would a quick call this week work?\n\nBest regards`;
  } else {
    // Standard outreach
    subject = `${firstName}, insight on ${topPriority.toLowerCase()} for ${companyName}`;
    body = `Hi ${firstName},\n\nI've been researching ${companyName}'s approach to ${topPriority.toLowerCase()}, and I believe there's an opportunity to add measurable value to what your team is building.\n\nOur work with similar organizations has revealed some patterns that might be directly relevant to ${companyName}'s current stage. I'd welcome the chance to share these insights in a brief conversation.\n\nWould you be open to a 15-minute call this week?\n\nBest regards`;
  }

  return { subject, body };
}

// ── Main Engine ──

export async function generateEmailIntelligence(
  contactId: string
): Promise<EmailIntelligence> {
  const startMs = Date.now();

  // Fetch contact
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: { select: { id: true, rawName: true, normalizedName: true, industry: true } },
    },
  });

  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const companyName = contact.company?.normalizedName || contact.company?.rawName || 'Unknown';

  // Get person intelligence profile
  let personProfile;
  try {
    personProfile = await buildPersonProfile(contactId);
  } catch {
    // If profile fails, use basic data
    personProfile = null;
  }

  // Detect relevant signals
  const triggerSignals = await detectRelevantSignals(contact.companyId);

  // Generate message
  const priorities = personProfile?.detectedPriorities || [];
  const buyingRole = personProfile?.buyingRole || 'unknown';
  const buyingInfluence = personProfile?.buyingInfluence || 0;
  const relationshipStrength = personProfile?.relationshipStrength || 'none';
  const responseProbability = personProfile?.responseProbability || 30;

  const messageAngle = generateMessageAngle(
    contact.title || contact.role || '',
    buyingRole,
    priorities,
    triggerSignals
  );

  const { subject, body } = generateSuggestedMessage(
    contact.rawName,
    contact.title || contact.role || '',
    companyName,
    priorities,
    triggerSignals,
    relationshipStrength
  );

  // Build evidence chain
  const evidenceItems: EmailIntelligence['evidenceUsed'] = [];
  const whyParts: string[] = [];

  for (const s of triggerSignals) {
    const isUsed = s.signal === triggerSignals[0]?.signal;
    evidenceItems.push({
      signal: s.signal,
      evidence: s.relevance,
      source: `company-signal-${s.category}`,
      reliability: 0.8,
      usedInMessage: isUsed,
    });
    if (isUsed) whyParts.push(`signal: "${s.signal}"`);
  }

  if (priorities.length > 0) {
    evidenceItems.push({
      signal: 'Priority Detected',
      evidence: `${priorities[0]} detected from title analysis and company signals`,
      source: 'priority-detection',
      reliability: 0.7,
      usedInMessage: true,
    });
    whyParts.push(`priority: "${priorities[0]}"`);
  }

  if (personProfile) {
    evidenceItems.push({
      signal: 'Buying Influence',
      evidence: `${contact.rawName} has buying influence ${buyingInfluence}/100 (${buyingRole.replace('_', ' ')})`,
      source: 'contact-influence-engine',
      reliability: 0.85,
      usedInMessage: true,
    });
    whyParts.push(`buying role: ${buyingRole.replace('_', ' ')}`);

    evidenceItems.push({
      signal: 'Engagement Profile',
      evidence: `Relationship strength: ${relationshipStrength}, response probability: ${responseProbability}%`,
      source: 'engagement-prediction',
      reliability: 0.9,
      usedInMessage: true,
    });
    whyParts.push(`relationship: ${relationshipStrength}`);
  }

  evidenceItems.push({
    signal: 'Role Analysis',
    evidence: `${contact.title || contact.role || 'Unknown role'} at ${companyName}${contact.company?.industry ? ` (${contact.company.industry})` : ''}`,
    source: 'contact-data',
    reliability: 0.95,
    usedInMessage: true,
  });

  const whyThisMessage = evidenceItems.filter(e => e.usedInMessage).length > 0
    ? `${evidenceItems.filter(e => e.usedInMessage).length} evidence signals used: ${whyParts.join(', ')}`
    : 'Template-based message — no specific signals available';

  const signalDrivers = triggerSignals.map(s => s.signal).slice(0, 5);

  // AI Quality assessment
  const hallucinationRisk = assessHallucinationRisk({
    evidenceCount: evidenceItems.length,
    confidenceScore: 70,
    hasContradictions: false,
    sourceReliability: 0.85,
    isNovelClaim: false,
    hasSpecificNumbers: false,
    reasoningDepth: 65,
  });

  const aiConfidence = calibrateConfidence({
    rawConfidence: 70,
    evidenceCount: evidenceItems.length,
    evidenceQuality: evidenceItems.filter(e => e.reliability >= 0.8).length >= 3 ? 'corroborated' : 'inferred',
    sourceReliability: 0.85,
    hallucinationRisk,
  });

  // Personalization tokens
  const personalizationTokens: string[] = [];
  if (contact.company?.industry) personalizationTokens.push(contact.company.industry);
  if (contact.title) personalizationTokens.push(contact.title);
  if (priorities.length > 0) personalizationTokens.push(...priorities.slice(0, 2));
  if (triggerSignals.length > 0) personalizationTokens.push(triggerSignals[0].signal);

  // Next steps
  const recommendedNextSteps: string[] = [];
  if (responseProbability >= 60) recommendedNextSteps.push('High response probability — send the suggested message at optimal time');
  if (responseProbability < 40) recommendedNextSteps.push('Low response probability — consider nurturing with content first');
  if (triggerSignals.length > 0) recommendedNextSteps.push(`Reference ${triggerSignals[0].signal} as conversation opener`);
  if (buyingInfluence >= 70) recommendedNextSteps.push('High influence contact — personalize deeply and follow up within 48 hours');
  if (relationshipStrength === 'none' && triggerSignals.length > 0) recommendedNextSteps.push('Use signal-driven opener for cold outreach — higher response rate');
  if (personalizationTokens.length >= 3) recommendedNextSteps.push('Strong personalization data available — customize message further');

  // Track reliability
  try {
    await trackGeneration('email', '/api/ai/email-intelligence', async () => {}, {
      companyId: contact.companyId,
      contactId,
    });
  } catch {
    // Non-blocking
  }

  return {
    contactId,
    contactName: contact.rawName,
    companyName,
    suggestedMessage: body,
    suggestedSubject: subject,
    messageAngle,
    whyThisMessage,
    evidenceUsed: evidenceItems,
    signalDrivers,
    triggerSignals,
    buyingRole,
    buyingInfluence,
    detectedPriorities: priorities,
    relationshipStrength,
    responseProbability,
    confidenceScore: aiConfidence,
    evidenceQuality: evidenceItems.filter(e => e.reliability >= 0.8).length >= 3 ? 'corroborated' : 'inferred',
    hallucinationRisk,
    aiConfidence,
    bestSendTime: personProfile?.bestContactTime || 'Tuesday-Thursday, 9:00-11:00 AM',
    primaryChannel: personProfile?.preferredChannel || 'Email',
    personalizationTokens,
    recommendedNextSteps,
    generatedAt: new Date().toISOString(),
  };
}
