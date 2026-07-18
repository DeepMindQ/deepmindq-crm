/**
 * Deduplicator — Data Intelligence Engine
 *
 * Detects duplicate records within an upload batch AND against
 * the existing database. Uses multiple strategies:
 *
 * 1. Exact email match (strongest signal)
 * 2. Domain + similar name
 * 3. Fuzzy company name match (Levenshtein-based)
 *
 * Deduplication thresholds could be made configurable in a
 * future iteration, but the core logic is field-tested.
 */

import { db } from '@/lib/db';

interface MappedRow {
  [key: string]: unknown;
}

export interface DuplicateMatch {
  type: 'email' | 'domain_name' | 'company_name';
  matchField: string;
  matchValue: string;
  existingId?: string;
  existingName?: string;
  batchRowIndex?: number;
  confidence: number; // 0-100
}

export interface DedupResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  bestMatch: DuplicateMatch | null;
}

// ── Levenshtein Distance ──

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 100;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 98;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(na, nb) / maxLen) * 100);
}

// ── Company Name Matching ──

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|corporation|limited|co|company|pvt|private|gmbh|ag|bv|sa|pte|srl|pty|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function companySimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 95;
  if (na.includes(nb) || nb.includes(na)) return 75;

  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);

  // Word overlap ratio
  const overlap = wordsA.filter(wa =>
    wordsB.some(wb => wb === wa || levenshtein(wa, wb) <= 1)
  );
  if (overlap.length === 0) return 0;

  return Math.round(
    (overlap.length / Math.max(wordsA.length, wordsB.length)) * 70
  );
}

// ── Existing DB Checks (batch-loaded for efficiency) ──

let existingEmailsCache: Set<string> | null = null;
let existingDomainsCache: Map<string, string[]> | null = null; // domain → company names
let existingCompanyNames: string[] | null = null;
let cacheLoadedAt = 0;
const DB_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function ensureDbCache() {
  if (
    existingEmailsCache &&
    cacheLoadedAt + DB_CACHE_TTL > Date.now()
  ) return;

  // Load existing data in parallel
  const [existingContacts, existingCompanies] = await Promise.all([
    db.contact.findMany({
      select: { email: true },
      where: { email: { not: '' } },
    }),
    db.company.findMany({
      select: { rawName: true, normalizedName: true, domain: true },
    }),
  ]);

  existingEmailsCache = new Set(
    existingContacts.map(c => c.email.toLowerCase().trim())
  );

  existingDomainsCache = new Map();
  for (const c of existingCompanies) {
    const domain = (c.domain || '').toLowerCase().trim();
    if (domain) {
      if (!existingDomainsCache.has(domain)) existingDomainsCache.set(domain, []);
      existingDomainsCache.get(domain)!.push(c.rawName);
    }
  }

  existingCompanyNames = existingCompanies.map(c => c.rawName);
  cacheLoadedAt = Date.now();
}

export function invalidateDedupCache() {
  existingEmailsCache = null;
  existingDomainsCache = null;
  existingCompanyNames = null;
  cacheLoadedAt = 0;
}

// ── Public API ──

/**
 * Check if a row is a duplicate against existing DB records.
 */
export async function checkAgainstExisting(row: MappedRow): Promise<DedupResult> {
  await ensureDbCache();
  const matches: DuplicateMatch[] = [];

  const email = String(row.email || '').toLowerCase().trim();
  const company = String(row.company || '').trim();
  const name = String(row.name || '').trim();
  const domain = String(row.domain || '').toLowerCase().trim();
  // Also try to extract domain from email
  const emailDomain = email.includes('@') ? email.split('@')[1] : '';

  // Strategy 1: Exact email match
  if (email && existingEmailsCache!.has(email)) {
    matches.push({
      type: 'email',
      matchField: 'email',
      matchValue: email,
      confidence: 100,
    });
  }

  // Strategy 2: Domain + similar name
  const checkDomain = domain || emailDomain;
  if (checkDomain && name && existingDomainsCache!.has(checkDomain)) {
    const existingNames = existingDomainsCache!.get(checkDomain)!;
    for (const en of existingNames) {
      const sim = companySimilarity(company || name, en);
      if (sim >= 60) {
        matches.push({
          type: 'domain_name',
          matchField: 'domain',
          matchValue: checkDomain,
          existingName: en,
          confidence: Math.min(sim, 90),
        });
      }
    }
  }

  // Strategy 3: Fuzzy company name match
  if (company && existingCompanyNames) {
    for (const ec of existingCompanyNames) {
      const sim = companySimilarity(company, ec);
      if (sim >= 75) {
        matches.push({
          type: 'company_name',
          matchField: 'company',
          matchValue: ec,
          existingName: ec,
          confidence: sim,
        });
      }
    }
  }

  // Find best match
  matches.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = matches.length > 0 ? matches[0] : null;

  return {
    isDuplicate: matches.some(m => m.confidence >= 80),
    matches,
    bestMatch,
  };
}

/**
 * Check for duplicates within the current batch.
 * Returns a map: rowIndex → duplicate info.
 *
 * This is called during chunk processing, passing in
 * rows already processed in previous chunks.
 */
export function checkWithinBatch(
  currentRow: MappedRow,
  rowIndex: number,
  previousRows: Array<{ row: MappedRow; index: number }>
): DedupResult {
  const matches: DuplicateMatch[] = [];
  const email = String(currentRow.email || '').toLowerCase().trim();
  const company = String(currentRow.company || '').trim();
  const domain = String(currentRow.domain || '').toLowerCase().trim();
  const emailDomain = email.includes('@') ? email.split('@')[1] : '';

  for (const { row: prev, index } of previousRows) {
    const prevEmail = String(prev.email || '').toLowerCase().trim();
    const prevCompany = String(prev.company || '').trim();
    const prevDomain = String(prev.domain || '').toLowerCase().trim();
    const prevDomain2 = prevEmail.includes('@') ? prevEmail.split('@')[1] : '';

    // Exact email match
    if (email && prevEmail && email === prevEmail) {
      matches.push({
        type: 'email',
        matchField: 'email',
        matchValue: email,
        batchRowIndex: index,
        confidence: 100,
      });
      continue;
    }

    // Domain + name match
    const checkDomain = domain || emailDomain;
    const prevCheckDomain = prevDomain || prevDomain2;
    if (checkDomain && prevCheckDomain && checkDomain === prevCheckDomain) {
      const sim = companySimilarity(company, prevCompany);
      if (sim >= 60) {
        matches.push({
          type: 'domain_name',
          matchField: 'domain',
          matchValue: checkDomain,
          batchRowIndex: index,
          confidence: Math.min(sim, 85),
        });
        continue;
      }
    }

    // Company name match
    if (company && prevCompany) {
      const sim = companySimilarity(company, prevCompany);
      if (sim >= 80) {
        matches.push({
          type: 'company_name',
          matchField: 'company',
          matchValue: prevCompany,
          batchRowIndex: index,
          confidence: sim,
        });
      }
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = matches.length > 0 ? matches[0] : null;

  return {
    isDuplicate: matches.some(m => m.confidence >= 80),
    matches,
    bestMatch,
  };
}