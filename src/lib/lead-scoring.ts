import { db } from '@/lib/db';
import { getIcpProfileSync } from '@/lib/icp-config';

/* ═══════════════════════════════════════════════════
   L-02: Advanced Lead Scoring Model
   
   Scoring dimensions (total max: 100):
   - Role Score:        0-25
   - Email Health:      0-15
   - Company Fit:       0-20
   - Data Completeness: 0-15
   - Engagement:        0-15
   - Enrichment:        0-10
   ═══════════════════════════════════════════════════ */

export interface ScoreBreakdown {
  role: number;          // 0-25
  emailHealth: number;   // 0-15
  companyFit: number;    // 0-20
  dataCompleteness: number; // 0-15
  engagement: number;    // 0-15
  enrichment: number;    // 0-10
  total: number;         // 0-100
}

interface ContactData {
  title?: string | null;
  role?: string | null;
  emailHealth?: string | null;
  emailHealthScore?: number | null;
  linkedinUrl?: string | null;
  phone?: string | null;
  location?: string | null;
  enrichmentData?: string | null;
  company?: {
    industry?: string | null;
    sizeRange?: string | null;
    researchCard?: {
      revenue?: string | null;
      employeeCount?: string | null;
      fundingStage?: string | null;
      techStack?: string | null;
      enrichmentSource?: string | null;
    } | null;
  } | null;
}

interface EngagementData {
  opened?: boolean;
  clicked?: boolean;
  replied?: boolean;
}

/* ── Role Score (0-25) ── */
function scoreRole(contact: ContactData): number {
  const title = (contact.title || '').toLowerCase();
  const role = (contact.role || '').toLowerCase();

  if (role === 'executive' || /^(ceo|cto|cfo|coo|cmo|cpo|ciso|president|chief)/.test(title)) {
    return 25;
  }
  if (/^(vp|svp|evp|vice president)/.test(title)) {
    return 20;
  }
  if (/^(director|head|principal)/.test(title)) {
    return 20;
  }
  if (/^(manager|lead|senior|staff|sr\.)/.test(title) || role === 'manager') {
    return 15;
  }
  if (/^(senior|staff|sr\.|sr )/.test(title)) {
    return 10;
  }
  if (role === 'technical' || /^(engineer|developer|architect|scientist|analyst|programmer|devops|sre|data)/.test(title)) {
    return 10;
  }
  return 5;
}

/* ── Email Health Score (0-15) ── */
function scoreEmailHealth(contact: ContactData): number {
  const health = contact.emailHealth || 'unknown';
  if (health === 'valid') return 15;
  if (health === 'risky') return 8;
  return 0;
}

/* ── Company Fit Score (0-20) ── */
function scoreCompanyFit(contact: ContactData): number {
  let score = 0;
  const company = contact.company;
  const icp = getIcpProfileSync();

  // Industry match (+10) — uses configurable ICP profile
  const industry = (company?.industry || '').toLowerCase();
  if (industry && icp.excludedIndustries.some(ex => industry.includes(ex.toLowerCase()))) {
    // Excluded industry — 0 points for industry dimension
  } else if (industry && icp.targetIndustries.some(ti => industry.includes(ti.toLowerCase()))) {
    score += 10;
  } else if (industry) {
    score += 5; // partial match for any known industry
  }

  // Company size match (+5) — uses configurable ICP size ranges
  const size = (company?.sizeRange || '').toLowerCase();
  if (size) {
    const sizeNormalized = size.replace(/\s+/g, '');
    const sizeMatched = icp.targetSizeRanges.some(ts => {
      const tsNorm = ts.toLowerCase().replace(/\s+/g, '');
      return sizeNormalized.includes(tsNorm) || tsNorm.includes(sizeNormalized);
    });
    if (sizeMatched) {
      score += 5;
    }
  }

  // Has research data (+5)
  if (company?.researchCard) {
    score += 5;
  }

  return Math.min(20, score);
}

/* ── Data Completeness Score (0-15) ── */
function scoreDataCompleteness(contact: ContactData): number {
  let score = 0;
  if (contact.title) score += 3;
  if (contact.phone) score += 3;
  if (contact.linkedinUrl) score += 3;
  if (contact.location) score += 3;
  if (contact.company?.industry) score += 3;
  return score;
}

/* ── Engagement Score (0-15) ── */
function scoreEngagement(engagement?: EngagementData): number {
  if (!engagement) return 0;
  let score = 0;
  if (engagement.opened) score += 5;
  if (engagement.clicked) score += 5;
  if (engagement.replied) score += 5;
  return score;
}

/* ── Enrichment Score (0-10) ── */
function scoreEnrichment(contact: ContactData): number {
  if (contact.enrichmentData) return 10;
  if (contact.company?.researchCard?.enrichmentSource) return 10;
  return 0;
}

/* ═════════════════ Public API ═════════════════ */

export function calculateLeadScore(
  contact: ContactData,
  engagementData?: EngagementData,
): ScoreBreakdown {
  const role = scoreRole(contact);
  const emailHealth = scoreEmailHealth(contact);
  const companyFit = scoreCompanyFit(contact);
  const dataCompleteness = scoreDataCompleteness(contact);
  const engagement = scoreEngagement(engagementData);
  const enrichment = scoreEnrichment(contact);

  const total = role + emailHealth + companyFit + dataCompleteness + engagement + enrichment;

  return { role, emailHealth, companyFit, dataCompleteness, engagement, enrichment, total };
}

/* Recalculate scores for all contacts (batch operation) */
export async function recalculateAllScores(): Promise<{ updated: number }> {
  const contacts = await db.contact.findMany({
    include: {
      company: {
        include: { researchCard: true },
      },
      events: {
        select: { eventType: true },
      },
    },
  });

  // Calculate all scores in memory first
  const scoredContacts = (contacts as any[]).map(contact => {
    const eventTypes = new Set(contact.events?.map((e: any) => e.eventType) || []);
    const engagementData: EngagementData = {
      opened: eventTypes.has('open'),
      clicked: eventTypes.has('click'),
      replied: eventTypes.has('reply'),
    };

    const breakdown = calculateLeadScore(contact, engagementData);

    return {
      id: contact.id,
      leadScore: breakdown.total,
      companyFitScore: breakdown.companyFit,
      engagementScore: breakdown.engagement,
      enrichmentScore: breakdown.enrichment,
    };
  });

  // Batch DB updates (50 per transaction)
  const BATCH_SIZE = 50;
  for (let i = 0; i < scoredContacts.length; i += BATCH_SIZE) {
    const batch = scoredContacts.slice(i, i + BATCH_SIZE);
    await db.$transaction(
      batch.map(c =>
        db.contact.update({
          where: { id: c.id },
          data: {
            leadScore: c.leadScore,
            companyFitScore: c.companyFitScore,
            engagementScore: c.engagementScore,
            enrichmentScore: c.enrichmentScore,
          },
        })
      )
    );
  }

  return { updated: scoredContacts.length };
}

/* Get score breakdown for a single contact */
export async function getScoreBreakdown(contactId: string): Promise<ScoreBreakdown | null> {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: {
      company: {
        include: { researchCard: true },
      },
      events: {
        select: { eventType: true },
      },
    },
  });

  if (!contact) return null;

  const c = contact as any;
  const eventTypes = new Set(c.events?.map((e: any) => e.eventType) || []);
  const engagementData: EngagementData = {
    opened: eventTypes.has('open'),
    clicked: eventTypes.has('click'),
    replied: eventTypes.has('reply'),
  };

  return calculateLeadScore(c, engagementData);
}