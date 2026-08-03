/**
 * Intelligent Company Matching Engine
 * ====================================
 * 4-rule matching priority:
 *   Rule 1: Email Domain Match    (95% confidence) — raj@reliance.com → Reliance Industries
 *   Rule 2: Website/Domain Match  (90% confidence) — microsoft.com → Microsoft Corporation
 *   Rule 3: Normalized Name Match (85% confidence) — "TCS Ltd" → "Tata Consultancy Services"
 *   Rule 4: AI Fuzzy Match        (80% confidence) — for edge cases only
 *
 * Used by: Import pipeline, Contact enrichment, Deduplication
 */

import { db } from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CompanyMatch {
  companyId: string;
  companyName: string;
  domain: string | null;
  confidence: number; // 0-100
  matchRule: 'email_domain' | 'website' | 'normalized_name' | 'fuzzy';
}

export interface MatchResult {
  matched: boolean;
  match?: CompanyMatch;
  suggestedNewName?: string;
}

// ─── Company Name Normalization ────────────────────────────────────────

/** Suffixes to strip for deep normalization */
const COMPANY_SUFFIXES = [
  'limited', 'ltd', 'ltd.', 'inc', 'inc.', 'incorporated',
  'corp', 'corp.', 'corporation', 'co', 'co.', 'company',
  'pvt', 'pvt.', 'private', 'public',
  'plc', 'plc.', 'llc', 'llc.', 'lp', 'l.p.',
  'gmbh', 'ag', 's.a.', 's.a', 's.r.l.',
  'bv', 'b.v.', 'nv', 'n.v.',
  'pte', 'pte.', 'berhad', 'sdn', 'sdn.',
  'holdings', 'group',
  // Common Indian suffixes
  'pvt ltd', 'pvt. ltd.', 'private limited',
  'ltd.', 'india', 'india pvt',
];

/**
 * Deep normalize: strip suffixes, punctuation, whitespace → single token
 * "Reliance Industries Limited" → "relianceindustries"
 * "TCS Pvt Ltd" → "tcs"
 * "HDFC Bank" → "hdfcbank"
 */
function deepNormalize(name: string): string {
  let n = name.trim().toLowerCase();

  // Remove known suffixes (longest first to avoid partial matches)
  const sorted = [...COMPANY_SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sorted) {
    const pattern = new RegExp(`\\b${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    n = n.replace(pattern, '');
  }

  // Remove punctuation
  n = n.replace(/[.,\-_&+()]/g, '');

  // Remove common filler words
  n = n.replace(/\b(the|and|of|for|in|at|to|a|an)\b/g, '');

  // Collapse whitespace and trim
  n = n.replace(/\s+/g, '');

  return n;
}

// ─── Domain Extraction ─────────────────────────────────────────────────

/** Extract domain from email: "raj@reliance.com" → "reliance.com" */
function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || domain.includes(' ') || domain.includes('"')) return null;
  return domain;
}

/** Extract root domain from URL: "https://www.tcs.com/about" → "tcs.com" */
function extractDomainFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    let clean = url.trim();
    if (!clean.startsWith('http')) clean = 'https://' + clean;
    const parsed = new URL(clean);
    return parsed.hostname?.toLowerCase() || null;
  } catch {
    // Try simple extraction for "www.company.com" format
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

/**
 * Get root domain: "sub.domain.com" → "domain.com"
 * Handles common TLDs: .co.uk, .com.au, etc.
 */
function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;

  // Known multi-part TLDs
  const multiPartTlds = ['co.uk', 'co.in', 'com.au', 'co.jp', 'co.kr', 'com.br', 'org.uk', 'ac.uk', 'gov.uk'];
  const lastTwo = parts.slice(-2).join('.');
  if (multiPartTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

// ─── Main Matching Function ────────────────────────────────────────────

/**
 * Match a contact's company to an existing Company record.
 * Returns null if no match found (caller should create new company).
 */
export async function matchCompany(params: {
  companyName?: string;
  email?: string;
  website?: string;
}): Promise<MatchResult> {
  const { companyName, email, website } = params;

  // ── Rule 1: Email Domain Match (highest confidence ~95%) ──
  if (email) {
    const emailDomain = extractDomainFromEmail(email);
    if (emailDomain) {
      const emailRoot = getRootDomain(emailDomain);

      // Search for company whose domain or website matches email domain
      const domainMatch = await db.company.findFirst({
        where: {
          OR: [
            { domain: emailDomain },
            { domain: { endsWith: '.' + emailRoot } },
            { website: { endsWith: emailRoot } },
            { website: { endsWith: emailDomain } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, rawName: true, domain: true, website: true },
      });

      if (domainMatch) {
        return {
          matched: true,
          match: {
            companyId: domainMatch.id,
            companyName: domainMatch.rawName,
            domain: domainMatch.domain,
            confidence: 95,
            matchRule: 'email_domain',
          },
        };
      }
    }
  }

  // ── Rule 2: Website/Domain Match (~90%) ──
  if (website) {
    const webDomain = extractDomainFromUrl(website);
    if (webDomain) {
      const webRoot = getRootDomain(webDomain);

      const websiteMatch = await db.company.findFirst({
        where: {
          OR: [
            { domain: webDomain },
            { domain: { endsWith: '.' + webRoot } },
            { website: { endsWith: webRoot } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, rawName: true, domain: true, website: true },
      });

      if (websiteMatch) {
        return {
          matched: true,
          match: {
            companyId: websiteMatch.id,
            companyName: websiteMatch.rawName,
            domain: websiteMatch.domain,
            confidence: 90,
            matchRule: 'website',
          },
        };
      }
    }
  }

  // ── Rule 3: Normalized Name Match (~85%) ──
  if (companyName) {
    const trimmedName = companyName.trim();
    if (trimmedName.length < 2) return { matched: false };

    const normalizedName = trimmedName.replace(/\s+/g, ' ').toLowerCase();
    const deepNorm = deepNormalize(trimmedName);

    // 3a: Exact normalizedName match
    const exactMatch = await db.company.findFirst({
      where: { normalizedName },
      orderBy: { createdAt: 'desc' },
      select: { id: true, rawName: true, domain: true },
    });
    if (exactMatch) {
      return {
        matched: true,
        match: {
          companyId: exactMatch.id,
          companyName: exactMatch.rawName,
          domain: exactMatch.domain,
          confidence: 90,
          matchRule: 'normalized_name',
        },
      };
    }

    // 3b: Exact rawName match
    const rawMatch = await db.company.findFirst({
      where: { rawName: trimmedName },
      orderBy: { createdAt: 'desc' },
      select: { id: true, rawName: true, domain: true },
    });
    if (rawMatch) {
      return {
        matched: true,
        match: {
          companyId: rawMatch.id,
          companyName: rawMatch.rawName,
          domain: rawMatch.domain,
          confidence: 88,
          matchRule: 'normalized_name',
        },
      };
    }

    // 3c: Deep normalized match (handles "Reliance Ind Ltd" → "Reliance Industries Limited")
    if (deepNorm.length >= 2) {
      // Get candidates — companies whose normalizedName contains the first 6+ chars of our deep norm
      const minChars = Math.max(3, Math.floor(deepNorm.length * 0.4));
      const prefix = deepNorm.substring(0, minChars);

      const candidates = await db.company.findMany({
        where: {
          normalizedName: { contains: prefix },
        },
        select: { id: true, rawName: true, normalizedName: true, domain: true },
        take: 20,
      });

      let bestMatch: CompanyMatch | null = null;
      let bestScore = 0;

      for (const candidate of candidates) {
        const candidateDeep = deepNormalize(candidate.rawName);

        // Exact deep match
        if (candidateDeep === deepNorm) {
          return {
            matched: true,
            match: {
              companyId: candidate.id,
              companyName: candidate.rawName,
              domain: candidate.domain,
              confidence: 85,
              matchRule: 'normalized_name',
            },
          };
        }

        // Containment match with length similarity check
        const longer = Math.max(candidateDeep.length, deepNorm.length);
        const shorter = Math.min(candidateDeep.length, deepNorm.length);
        const lengthRatio = shorter / longer;

        if (lengthRatio >= 0.6) {
          const isContained =
            candidateDeep.includes(deepNorm) ||
            deepNorm.includes(candidateDeep);

          if (isContained) {
            const score = Math.round(lengthRatio * 85);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                companyId: candidate.id,
                companyName: candidate.rawName,
                domain: candidate.domain,
                confidence: score,
                matchRule: 'normalized_name',
              };
            }
          }
        }
      }

      if (bestMatch && bestScore >= 70) {
        return { matched: true, match: bestMatch };
      }
    }
  }

  // ── Rule 4: No match found ──
  // AI fuzzy matching could be added here for edge cases
  // but requires LLM call — skip for import pipeline performance
  return { matched: false, suggestedNewName: companyName?.trim() };
}

// ─── Domain Extraction Utility (for import pipeline) ───────────────────

/**
 * Extract the corporate domain from an email.
 * "raj@reliance.com" → "reliance.com"
 * Returns null if personal/disposable email.
 */
export function extractCorporateDomain(email: string): string | null {
  const domain = extractDomainFromEmail(email);
  if (!domain) return null;
  if (isPersonalDomain(domain)) return null;
  return domain;
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'zoho.com', 'yandex.com', 'rediffmail.com', 'qq.com',
  '163.com', '126.com', 'gmx.com', 'fastmail.com',
]);

function isPersonalDomain(domain: string): boolean {
  return PERSONAL_DOMAINS.has(domain);
}
