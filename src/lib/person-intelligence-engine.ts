/**
 * Person Intelligence Engine (Wave 5.1)
 *
 * Produces the "Person Intelligence Profile" — one of DeepMindQ's strongest
 * differentiators. Combines:
 * - Lead Scoring (role fit, email health, company fit, engagement)
 * - Contact Influence Engine (buying role, decision style, seniority)
 * - Company Intelligence (from Intelligence Contract Layer)
 * - Engagement signals (replies, opens, timeline events)
 * - AI-detected priorities and recommended conversation topics
 *
 * Output format:
 *   John Smith
 *   Chief Data Officer
 *   Buying Influence: 92/100
 *   Role: Economic Buyer
 *   Current Priorities: AI Governance, Cloud Modernization
 *   Relationship: Last interaction 14 days ago
 *   Recommended Conversation: Discuss enterprise AI governance framework
 */

import { db } from '@/lib/db';
import { calculateLeadScore } from '@/lib/lead-scoring';
import { scoreContactInfluence, type ContactInfluenceScore } from '@/lib/scoring/contact-influence-engine';
import { buildEvidenceOutput, evidence, buildScoreBreakdown, factor, persistScoreAsInsight } from '@/lib/ai-evidence-framework';
import { assessHallucinationRisk, assessFreshness, calibrateConfidence, trackGeneration } from '@/lib/ai-reliability';
import { logger } from '@/lib/logger';

// ── Types ──

export interface PersonIntelligenceProfile {
  contactId: string;
  name: string;
  email: string;
  title: string;
  role: string | null;

  // Company context
  companyId: string;
  companyName: string;
  industry: string | null;

  // Intelligence Scores
  buyingInfluence: number;      // 0-100 from Contact Influence Engine
  buyingRole: string;           // economic_buyer, technical_buyer, champion, coach, user
  decisionStyle: string;        // analytical, relationship, consensus, authoritative

  leadScore: number;            // 0-100 from Lead Scoring
  leadTier: 'hot' | 'warm' | 'cold';

  // Person Intelligence Score (composite)
  personScore: number;          // 0-100 composite
  personGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  scoreBreakdown: string;       // "+25 Executive (CIO), +20 Active engagement, -5 Low data coverage"

  // Detected Priorities (from company signals + knowledge + title analysis)
  detectedPriorities: string[];

  // Relationship Intelligence
  lastInteraction: string | null;   // ISO date or null
  daysSinceLastInteraction: number;
  interactionCount: number;
  relationshipStrength: 'strong' | 'warm' | 'cold' | 'none';
  recommendedConversation: string;
  conversationAngle: string;

  // Engagement Prediction
  responseProbability: number;      // 0-100
  bestContactTime: string;         // e.g., "Tuesday AM, Thursday PM"
  preferredChannel: string;         // email, linkedin, phone

  // Enrichment Status
  enrichmentLevel: 'full' | 'partial' | 'basic';
  dataCompleteness: number;         // 0-100
  missingFields: string[];

  // AI Evidence
  evidence: Array<{
    signal: string;
    evidence: string;
    source: string;
    reliability: number;
  }>;

  // Confidence
  confidenceScore: number;
  aiConfidence: number;

  // Recommended Actions
  nextBestActions: string[];
  priorityTier: 'critical' | 'high' | 'medium' | 'low' | 'nurture';

  // Generated timestamp
  profiledAt: string;
}

// ── Priority Detection ──

function detectPrioritiesFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  const priorities: string[] = [];

  if (/data|analytics|bi|intelligence/.test(lower)) priorities.push('Data & Analytics');
  if (/cloud|aws|azure|gcp|infrastructure/.test(lower)) priorities.push('Cloud Infrastructure');
  if (/security|ciso|cyber|compliance/.test(lower)) priorities.push('Security & Compliance');
  if (/ai|machine learning|ml|automation/.test(lower)) priorities.push('AI & Automation');
  if (/digital|transformation|innovation/.test(lower)) priorities.push('Digital Transformation');
  if (/finance|cfo|revenue|profit/.test(lower)) priorities.push('Financial Optimization');
  if (/product|engineering|cto|development/.test(lower)) priorities.push('Product & Engineering');
  if (/marketing|cmo|growth|brand/.test(lower)) priorities.push('Marketing & Growth');
  if (/operation|coo|efficiency|process/.test(lower)) priorities.push('Operational Efficiency');
  if (/hr|people|talent|chief people/.test(lower)) priorities.push('Talent & People');
  if (/sales|revenue|chief revenue/.test(lower)) priorities.push('Revenue Growth');
  if (/legal|general counsel|regulation/.test(lower)) priorities.push('Legal & Governance');
  if (/customer|experience|success|cx/.test(lower)) priorities.push('Customer Experience');

  return priorities.length > 0 ? priorities : ['General Business Operations'];
}

async function detectPrioritiesFromSignals(companyId: string): Promise<string[]> {
  const signals = await db.companySignal.findMany({
    where: {
      companyId,
      status: { in: ['detected', 'validated', 'active'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const priorities: string[] = [];
  for (const s of signals) {
    const title = (s.title || '').toLowerCase();
    if (/cloud|aws|azure|migration/.test(title) && !priorities.includes('Cloud Migration')) priorities.push('Cloud Migration');
    if (/ai|machine learning|automation/.test(title) && !priorities.includes('AI Adoption')) priorities.push('AI Adoption');
    if (/hire|talent|recruit/.test(title) && !priorities.includes('Talent Acquisition')) priorities.push('Talent Acquisition');
    if (/fund|investment|series/.test(title) && !priorities.includes('Growth Investment')) priorities.push('Growth Investment');
    if (/security|breach|compliance/.test(title) && !priorities.includes('Security')) priorities.push('Security');
    if (/expansion|new office|growth/.test(title) && !priorities.includes('Expansion')) priorities.push('Expansion');
  }

  return priorities;
}

// ── Conversation Recommendation ──

function generateConversationRecommendation(
  title: string,
  buyingRole: string,
  priorities: string[],
  relationshipStrength: string
): string {
  const lower = title.toLowerCase();

  if (priorities.length === 0) {
    return `Introduce DeepMindQ capabilities and learn about ${title} priorities`;
  }

  const topPriority = priorities[0];

  if (/ceo|president|chief executive/.test(lower)) {
    return `Discuss how DeepMindQ's revenue intelligence can accelerate ${topPriority.toLowerCase()} initiatives and deliver measurable ROI`;
  }
  if (/cto|chief technology|vp engineering/.test(lower)) {
    return `Share technical architecture and integration approach for ${topPriority.toLowerCase()}, focusing on data security and AI reliability`;
  }
  if (/cfo|chief financial|vp finance/.test(lower)) {
    return `Present business case for DeepMindQ — quantify revenue impact of ${topPriority.toLowerCase()} with pipeline analytics and forecast accuracy`;
  }
  if (/cio|chief information/.test(lower)) {
    return `Explore how DeepMindQ's AI intelligence layer complements ${topPriority.toLowerCase()} strategy while maintaining enterprise governance standards`;
  }
  if (buyingRole === 'economic_buyer') {
    return `Frame conversation around business outcomes — how DeepMindQ drives revenue through ${topPriority.toLowerCase()}`;
  }
  if (buyingRole === 'technical_buyer') {
    return `Focus on technical capabilities supporting ${topPriority.toLowerCase()} — AI accuracy, data pipeline, integration architecture`;
  }

  if (relationshipStrength === 'strong') {
    return `Deepen the relationship by sharing ${topPriority.toLowerCase()} insights and proposing next collaborative step`;
  }
  if (relationshipStrength === 'warm') {
    return `Reference recent ${topPriority.toLowerCase()} trends and offer specific value-add insight to strengthen engagement`;
  }

  return `Open conversation about ${topPriority.toLowerCase()} challenges and position DeepMindQ as a thought partner`;
}

function generateConversationAngle(
  title: string,
  buyingRole: string,
  priorities: string[],
  daysSinceInteraction: number
): string {
  const topPriority = priorities[0] || 'business growth';

  if (daysSinceInteraction > 30) {
    return `Re-engagement angle: Recent development in ${topPriority.toLowerCase()} that's relevant to their role`;
  }
  if (daysSinceInteraction > 14) {
    return `Follow-up angle: New intelligence on their ${topPriority.toLowerCase()} initiative`;
  }

  if (buyingRole === 'economic_buyer') {
    return `Value proposition: Revenue impact quantification for ${topPriority.toLowerCase()}`;
  }
  if (buyingRole === 'champion') {
    return `Empowerment angle: Provide ammunition for internal champion to advocate for DeepMindQ`;
  }

  return `Insight angle: Share relevant ${topPriority.toLowerCase()} intelligence to build credibility`;
}

// ── Engagement Prediction ──

function predictResponseProbability(contact: {
  status: string;
  leadScore: number;
  engagementScore: number;
  daysSinceLastInteraction: number;
}): number {
  let probability = 30; // base

  // Status-based boost
  if (contact.status === 'replied') probability += 35;
  else if (contact.status === 'sent') probability += 10;
  else if (contact.status === 'bounced') probability -= 20;
  else if (contact.status === 'suppressed') probability -= 40;

  // Score-based boost
  probability += (contact.leadScore / 100) * 20;
  probability += (contact.engagementScore / 100) * 15;

  // Recency penalty
  if (contact.daysSinceLastInteraction > 60) probability -= 20;
  else if (contact.daysSinceLastInteraction > 30) probability -= 10;
  else if (contact.daysSinceLastInteraction < 7) probability += 5;

  return Math.max(0, Math.min(100, Math.round(probability)));
}

function suggestBestContactTime(): string {
  // Research-backed: Tuesday-Thursday 9-11 AM and 2-4 PM are optimal
  return 'Tuesday-Thursday, 9:00-11:00 AM or 2:00-4:00 PM';
}

function suggestPreferredChannel(title: string, linkedinUrl: string | null): string {
  if (linkedinUrl) return 'Email with LinkedIn connection request';
  return 'Email (primary channel)';
}

// ── Main Profile Builder ──

export async function buildPersonProfile(contactId: string): Promise<PersonIntelligenceProfile> {
  const startMs = Date.now();

  // Fetch contact with all relations
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: {
        select: {
          id: true, rawName: true, normalizedName: true,
          industry: true, sizeRange: true, domain: true,
          intelligenceScore: true,
        },
      },
      _count: { select: { replies: true } },
    },
  });

  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const title = contact.title || contact.role || 'Unknown Title';

  // ── 1. Lead Score ──
  const leadBreakdown = calculateLeadScore({
    title: contact.title,
    role: contact.role,
    emailHealth: contact.emailHealth,
    emailHealthScore: contact.emailHealthScore,
    linkedinUrl: contact.linkedinUrl,
    phone: contact.phone,
    location: contact.location,
    enrichmentData: typeof contact.enrichmentData === 'string' ? contact.enrichmentData : contact.enrichmentData ? JSON.stringify(contact.enrichmentData) : null,
    company: contact.company ? {
      industry: contact.company.industry,
      sizeRange: contact.company.sizeRange,
      researchCard: null,
    } : null,
  });

  // ── 2. Contact Influence ──
  let influenceScore: ContactInfluenceScore | null = null;
  try {
    influenceScore = await scoreContactInfluence(contactId);
  } catch {
    logger.warn(`[person-intel] Failed to score influence for ${contactId}`);
  }

  // ── 3. Detected Priorities ──
  const titlePriorities = detectPrioritiesFromTitle(title);
  const signalPriorities = await detectPrioritiesFromSignals(contact.companyId);
  const allPriorities = [...new Set([...titlePriorities, ...signalPriorities])].slice(0, 5);

  // ── 4. Relationship Intelligence ──
  const lastContactedAt = contact.lastContactedAt;
  const lastInteraction = lastContactedAt ? lastContactedAt.toISOString() : null;
  const daysSinceLastInteraction = lastContactedAt
    ? Math.floor((Date.now() - lastContactedAt.getTime()) / 86400000)
    : 999;
  const interactionCount = contact._count.replies || 0;

  let relationshipStrength: PersonIntelligenceProfile['relationshipStrength'];
  if (interactionCount >= 3) relationshipStrength = 'strong';
  else if (interactionCount >= 1 || (interactionCount === 0 && daysSinceLastInteraction < 14)) relationshipStrength = 'warm';
  else if (daysSinceLastInteraction < 30) relationshipStrength = 'cold';
  else relationshipStrength = 'none';

  const buyingRole = influenceScore?.buyingRole || 'unknown';
  const conversationRec = generateConversationRecommendation(title, buyingRole, allPriorities, relationshipStrength);
  const conversationAngle = generateConversationAngle(title, buyingRole, allPriorities, daysSinceLastInteraction);

  // ── 5. Engagement Prediction ──
  const responseProbability = predictResponseProbability({
    status: contact.status,
    leadScore: leadBreakdown.total,
    engagementScore: contact.engagementScore,
    daysSinceLastInteraction,
  });

  // ── 6. Data Completeness ──
  const missingFields: string[] = [];
  if (!contact.title) missingFields.push('title');
  if (!contact.phone) missingFields.push('phone');
  if (!contact.linkedinUrl) missingFields.push('linkedin');
  if (!contact.location) missingFields.push('location');
  if (!contact.enrichmentData) missingFields.push('enrichment');
  const dataCompleteness = Math.round(((10 - missingFields.length) / 10) * 100);

  const enrichmentLevel: PersonIntelligenceProfile['enrichmentLevel'] =
    missingFields.length <= 1 ? 'full' : missingFields.length <= 3 ? 'partial' : 'basic';

  // ── 7. Composite Person Score ──
  const buyingInfluence = influenceScore?.influenceScore || 0;
  const scoreBreakdownObj = buildScoreBreakdown({
    factors: [
      factor('buying_influence', 'Buying Influence', Math.round(buyingInfluence * 0.4), 40,
        `${title} — influence ${buyingInfluence}/100 (${buyingRole.replace('_', ' ')})`, 'contact-influence-engine'),
      factor('lead_score', 'Lead Quality', Math.round(leadBreakdown.total * 0.3), 30,
        `Lead score ${leadBreakdown.total}/100 (${leadBreakdown.total >= 75 ? 'hot' : leadBreakdown.total >= 45 ? 'warm' : 'cold'})`, 'lead-scoring'),
      factor('engagement', 'Engagement', Math.min(15, interactionCount * 8 + (responseProbability > 50 ? 8 : 0)), 15,
        `${interactionCount} replies, ${responseProbability}% response probability`, 'engagement-tracking'),
      factor('data_quality', 'Data Coverage', Math.round(dataCompleteness * 0.15), 15,
        `${dataCompleteness}% complete, ${missingFields.length} missing fields`, 'data-quality'),
    ],
    confidence: 70,
  });

  // ── 8. Evidence Collection ──
  const evidenceItems = [
    ...(influenceScore ? Object.values(influenceScore.breakdown).map(b => evidence(
      b.factor.split('→')[0].trim(),
      b.factor,
      'contact-influence-engine',
      { quality: 'corroborated' }
    )) : []),
    evidence('Lead Score', `${leadBreakdown.total}/100 — role ${leadBreakdown.role}, company fit ${leadBreakdown.companyFit}`, 'lead-scoring', { quality: 'verified' }),
    ...(allPriorities.map(p => evidence('Priority Detected', `${p} — detected from title analysis and company signals`, 'priority-detection', { quality: 'inferred' }))),
    ...(lastInteraction ? [evidence('Last Interaction', `${lastInteraction} (${daysSinceLastInteraction} days ago)`, 'engagement-tracking', { quality: 'verified' })] : []),
  ];

  // ── 9. AI Confidence Calibration ──
  const hallucinationRisk = assessHallucinationRisk({
    evidenceCount: evidenceItems.length,
    confidenceScore: scoreBreakdownObj.confidence,
    hasContradictions: false,
    sourceReliability: 0.85,
    isNovelClaim: allPriorities.length > 0,
    hasSpecificNumbers: true,
    reasoningDepth: 75,
  });

  const freshness = assessFreshness({
    latestEvidenceDate: lastInteraction || undefined,
    signalCount: allPriorities.length,
    daysSinceLastUpdate: daysSinceLastInteraction,
    hasCurrentData: missingFields.length < 5,
  });

  const aiConfidence = calibrateConfidence({
    rawConfidence: scoreBreakdownObj.confidence,
    evidenceCount: evidenceItems.length,
    evidenceQuality: dataCompleteness >= 80 ? 'corroborated' : 'inferred',
    sourceReliability: 0.85,
    hallucinationRisk,
  });

  // ── 10. Next Best Actions ──
  const nextBestActions: string[] = [];
  if (buyingInfluence >= 80 && daysSinceLastInteraction > 14) nextBestActions.push(`Priority outreach to ${contact.rawName} — high influence buyer, ${daysSinceLastInteraction} days inactive`);
  if (responseProbability >= 60) nextBestActions.push(`${contact.rawName} has ${responseProbability}% response probability — send personalized message`);
  if (allPriorities.length > 0) nextBestActions.push(`Lead with ${allPriorities[0]} conversation angle`);
  if (relationshipStrength === 'none') nextBestActions.push('Build initial relationship — share relevant insight before asking for time');
  if (missingFields.length > 3) nextBestActions.push(`Enrich ${contact.rawName}'s profile — missing: ${missingFields.join(', ')}`);
  if (interactionCount >= 2 && buyingInfluence >= 60) nextBestActions.push('Escalate to opportunity — multiple interactions with high-influence contact');

  // ── 11. Persist as AI Insight ──
  try {
    await persistScoreAsInsight(scoreBreakdownObj, {
      companyId: contact.companyId,
      contactId,
      entityName: contact.rawName,
      scoreType: 'Person Intelligence',
      metadata: {
        buyingInfluence,
        buyingRole,
        detectedPriorities: allPriorities,
        responseProbability,
        relationshipStrength,
        hallucinationRisk,
        freshness,
        aiConfidence,
      },
    });
  } catch (e) {
    logger.warn('[person-intel] Failed to persist insight:', { error: e });
  }

  // ── 12. Track reliability ──
  try {
    await trackGeneration('contact_intelligence', '/api/contacts/person-profile', async () => {}, {
      companyId: contact.companyId,
      contactId,
    });
  } catch {
    // Non-blocking
  }

  const result: PersonIntelligenceProfile = {
    contactId,
    name: contact.rawName,
    email: contact.email,
    title,
    role: contact.role,
    companyId: contact.companyId,
    companyName: contact.company.normalizedName || contact.company.rawName,
    industry: contact.company.industry,
    buyingInfluence,
    buyingRole,
    decisionStyle: influenceScore?.decisionStyle || 'unknown',
    leadScore: leadBreakdown.total,
    leadTier: leadBreakdown.total >= 75 ? 'hot' : leadBreakdown.total >= 45 ? 'warm' : 'cold',
    personScore: scoreBreakdownObj.totalScore,
    personGrade: scoreBreakdownObj.grade,
    scoreBreakdown: scoreBreakdownObj.breakdown,
    detectedPriorities: allPriorities,
    lastInteraction,
    daysSinceLastInteraction,
    interactionCount,
    relationshipStrength,
    recommendedConversation: conversationRec,
    conversationAngle,
    responseProbability,
    bestContactTime: suggestBestContactTime(),
    preferredChannel: suggestPreferredChannel(title, contact.linkedinUrl),
    enrichmentLevel,
    dataCompleteness,
    missingFields,
    evidence: evidenceItems.slice(0, 8).map(e => ({
      signal: e.signal,
      evidence: e.evidence,
      source: e.source,
      reliability: e.reliability,
    })),
    confidenceScore: scoreBreakdownObj.confidence,
    aiConfidence,
    nextBestActions,
    priorityTier: scoreBreakdownObj.priorityTier,
    profiledAt: new Date().toISOString(),
  };

  return result;
}

// ── Batch: Profile all contacts for a company ──

export async function buildCompanyPersonProfiles(
  companyId: string,
  limit = 20
): Promise<PersonIntelligenceProfile[]> {
  const contacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    select: { id: true },
    orderBy: { leadScore: 'desc' },
    take: limit,
  });

  const profiles: PersonIntelligenceProfile[] = [];
  for (const c of contacts) {
    try {
      const profile = await buildPersonProfile(c.id);
      profiles.push(profile);
    } catch (err) {
      logger.warn(`[person-intel] Failed to profile contact ${c.id}:`, { error: err });
    }
  }

  return profiles.sort((a, b) => b.personScore - a.personScore);
}
