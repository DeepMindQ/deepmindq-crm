/**
 * Contact Influence Engine (Wave 8.2)
 *
 * Scores a contact's buying influence based on:
 * - Title seniority (C-suite > VP > Director > Manager)
 * - Department relevance (Technology > Finance > Operations for tech sales)
 * - Engagement signals (replies, opens, meetings)
 * - Company relationship depth
 * - Network position (connections to other contacts in same account)
 */

import { db } from '@/lib/db';
import { createInsight } from '@/lib/ai-insight-service';

// ── Title Seniority Mapping ──
const SENIORITY_SCORES: Record<string, number> = {
  // C-suite
  'ceo': 100, 'cto': 95, 'cfo': 90, 'cio': 95, 'cmo': 85, 'coo': 90,
  'chief executive': 100, 'chief technology': 95, 'chief financial': 90,
  'chief information': 95, 'chief marketing': 85, 'chief operating': 90,
  'chief data': 90, 'chief digital': 90, 'chief strategy': 88,
  'president': 95, 'chairman': 90, 'chairwoman': 90,
  // VP
  'vp': 80, 'vice president': 80, 'svp': 85, 'senior vice president': 85,
  'evp': 85, 'executive vice president': 85,
  // Director
  'director': 65, 'head': 70, 'lead': 55,
  // Manager
  'manager': 45, 'associate': 30, 'senior': 50,
  // Individual contributor
  'analyst': 25, 'specialist': 25, 'consultant': 35,
  'coordinator': 20, 'administrator': 15, 'assistant': 10,
  'intern': 5, 'trainee': 5,
};

// ── Department Relevance (adjust based on ICP) ──
const DEPT_RELEVANCE: Record<string, number> = {
  'technology': 100, 'it': 100, 'engineering': 95, 'data': 95,
  'information technology': 100, 'digital': 90, 'innovation': 90,
  'finance': 60, 'operations': 55, 'marketing': 65, 'sales': 70,
  'product': 80, 'strategy': 75, 'procurement': 50, 'legal': 30,
  'human resources': 25, 'admin': 15,
};

// ── Buying Role Classification ──
type BuyingRole = 'economic_buyer' | 'technical_buyer' | 'champion' | 'coach' | 'user' | 'blocker' | 'unknown';

function classifyBuyingRole(title: string, seniority: number): BuyingRole {
  const lower = title.toLowerCase();

  if (seniority >= 90) return 'economic_buyer';
  if (lower.includes('architect') || lower.includes('engineer') || lower.includes('developer')) return 'technical_buyer';
  if (lower.includes('champion') || lower.includes('advocate')) return 'champion';
  if (seniority >= 60 && seniority < 90) return 'coach';
  if (seniority < 30) return 'user';
  return 'unknown';
}

function extractSeniority(title: string): number {
  const lower = title.toLowerCase();

  for (const [keyword, score] of Object.entries(SENIORITY_SCORES)) {
    if (lower.includes(keyword)) return score;
  }

  // Default based on title length and patterns
  if (lower.includes('senior')) return 55;
  if (lower.includes('junior')) return 20;
  if (lower.includes('lead') || lower.includes('principal')) return 60;
  if (lower.includes('staff')) return 50;

  return 30; // default
}

function extractDepartment(title: string): string {
  const lower = title.toLowerCase();

  for (const [dept] of Object.entries(DEPT_RELEVANCE)) {
    if (lower.includes(dept)) return dept;
  }

  return 'unknown';
}

export interface ContactInfluenceScore {
  contactId: string;
  influenceScore: number;       // 0-100 composite
  seniorityScore: number;      // 0-100
  departmentRelevance: number; // 0-100
  engagementScore: number;     // 0-100
  buyingRole: BuyingRole;
  decisionStyle: 'analytical' | 'relationship' | 'consensus' | 'authoritative' | 'unknown';
  breakdown: {
    seniority: { score: number; factor: string };
    department: { score: number; factor: string };
    engagement: { score: number; factor: string };
    network: { score: number; factor: string };
  };
}

/**
 * Score a single contact's buying influence.
 */
export async function scoreContactInfluence(
  contactId: string
): Promise<ContactInfluenceScore> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      _count: { select: { replies: true } },
    },
  });

  if (!contact) throw new Error(`Contact ${contactId} not found`);

  const title = contact.title || contact.role || '';
  const seniorityScore = extractSeniority(title);
  const department = extractDepartment(title);
  const departmentScore = DEPT_RELEVANCE[department] || 30;

  // Engagement: based on replies and status
  let engagementScore = 0;
  if (contact.status === 'replied') engagementScore = 80;
  else if (contact.status === 'sent') engagementScore = 30;
  else if (contact.status === 'queued' || contact.status === 'drafted') engagementScore = 10;
  engagementScore = Math.min(100, engagementScore + (contact.leadScore * 0.2));

  // Network: how many other contacts in same company
  const companyContacts = await db.contact.count({
    where: { companyId: contact.companyId, id: { not: contactId } },
  });
  const networkScore = Math.min(100, companyContacts * 15);

  // Composite influence score (weighted)
  const influenceScore = Math.round(
    (seniorityScore * 0.40) +
    (departmentScore * 0.25) +
    (engagementScore * 0.20) +
    (networkScore * 0.15)
  );

  const buyingRole = classifyBuyingRole(title, seniorityScore);

  // Decision style heuristic
  let decisionStyle: ContactInfluenceScore['decisionStyle'] = 'unknown';
  if (seniorityScore >= 90) decisionStyle = 'authoritative';
  else if (department === 'finance' || department === 'data') decisionStyle = 'analytical';
  else if (department === 'marketing' || department === 'sales') decisionStyle = 'relationship';
  else if (seniorityScore >= 60) decisionStyle = 'consensus';

  const result: ContactInfluenceScore = {
    contactId,
    influenceScore,
    seniorityScore,
    departmentRelevance: departmentScore,
    engagementScore: Math.round(engagementScore),
    buyingRole,
    decisionStyle,
    breakdown: {
      seniority: { score: seniorityScore, factor: `${title} → seniority ${seniorityScore}` },
      department: { score: departmentScore, factor: `${department} department → relevance ${departmentScore}` },
      engagement: { score: Math.round(engagementScore), factor: `status ${contact.status}, lead score ${contact.leadScore}` },
      network: { score: networkScore, factor: `${companyContacts} other contacts in account` },
    },
  };

  // Persist as AI Insight
  await createInsight({
    companyId: contact.companyId,
    contactId,
    type: 'SCORING',
    title: `Contact Influence: ${contact.rawName}`,
    description: `${contact.rawName} has influence score ${influenceScore}/100. Buying role: ${buyingRole}. Decision style: ${decisionStyle}.`,
    evidence: Object.entries(result.breakdown).map(([key, val]) => ({
      source: 'contact-influence-engine',
      snippet: val.factor,
      reliability: val.score / 100,
    })),
    confidenceScore: 75 + (engagementScore * 0.25), // higher engagement = higher confidence
    impactScore: influenceScore,
    urgencyScore: influenceScore >= 70 ? 60 : 20,
    recommendedAction: influenceScore >= 70
      ? `Prioritize outreach to ${contact.rawName} — high influence ${buyingRole.replace('_', ' ')}`
      : influenceScore >= 40
        ? `Nurture ${contact.rawName} — moderate influence potential`
        : `Deprioritize ${contact.rawName} — low buying influence`,
    sourceType: 'scoring_engine',
    sourceRoute: '/api/ai/score-contacts',
  });

  return result;
}

/**
 * Score all contacts for a company and return ranked list.
 */
export async function scoreCompanyContacts(
  companyId: string
): Promise<ContactInfluenceScore[]> {
  const contacts = await db.contact.findMany({
    where: { companyId },
    select: { id: true },
  });

  const scores: ContactInfluenceScore[] = [];
  for (const contact of contacts) {
    try {
      const score = await scoreContactInfluence(contact.id);
      scores.push(score);
    } catch {
      // Skip failed contacts
    }
  }

  return scores.sort((a, b) => b.influenceScore - a.influenceScore);
}
