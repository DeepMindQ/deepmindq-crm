import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   Duplicates API — Real fuzzy matching against DB contacts

   GET /api/duplicates
   Returns duplicate candidates found via Levenshtein-based
   matching rules, plus an empty merge history array.
   ═══════════════════════════════════════════════════════════════ */

// ── Levenshtein Distance ────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  }
  return dp[m][n];
}

// ── Split name into first / last ────────────────────────────────────
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

// ── Extract email local part ────────────────────────────────────────
function emailLocal(email: string): string {
  return email.split('@')[0]?.toLowerCase() || '';
}

// ── Extract email domain ────────────────────────────────────────────
function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

// ── Build field comparison array ────────────────────────────────────
interface FlatContact {
  id: string;
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  phone: string;
  location: string;
  sourceBatch: string;
  companyId: string;
  linkedinUrl: string | null;
}

function buildFields(existing: FlatContact, source: FlatContact) {
  const fields: {
    key: string;
    label: string;
    existingValue: string;
    newValue: string;
    differs: boolean;
  }[] = [
    { key: 'name', label: 'Name', existingValue: existing.name, newValue: source.name, differs: existing.name !== source.name },
    { key: 'email', label: 'Email', existingValue: existing.email, newValue: source.email, differs: existing.email !== source.email },
    { key: 'company', label: 'Company', existingValue: existing.company, newValue: source.company, differs: existing.company !== source.company },
    { key: 'jobTitle', label: 'Job Title', existingValue: existing.jobTitle, newValue: source.jobTitle, differs: existing.jobTitle !== source.jobTitle },
    { key: 'phone', label: 'Phone', existingValue: existing.phone || '—', newValue: source.phone || '—', differs: (existing.phone || '') !== (source.phone || '') },
    { key: 'location', label: 'Location', existingValue: existing.location || '—', newValue: source.location || '—', differs: (existing.location || '') !== (source.location || '') },
  ];
  return fields;
}

// ── Score calculation ───────────────────────────────────────────────
function calculateScore(rule: 'email' | 'name+company' | 'linkedin', existing: FlatContact, source: FlatContact): number {
  let score = 0;

  if (rule === 'linkedin') {
    // LinkedIn match is very high confidence
    score = 95;
    // Small penalty if names differ a lot
    const nameDist = levenshtein(existing.name.toLowerCase(), source.name.toLowerCase());
    const maxLen = Math.max(existing.name.length, source.name.length, 1);
    score -= Math.round((nameDist / maxLen) * 10);
    return Math.min(100, Math.max(0, score));
  }

  // For email and name+company rules, compute a composite score
  const nameDist = levenshtein(existing.name.toLowerCase(), source.name.toLowerCase());
  const maxNameLen = Math.max(existing.name.length, source.name.length, 1);
  const nameSimilarity = 1 - (nameDist / maxNameLen);

  const eDomain = emailDomain(existing.email);
  const sDomain = emailDomain(source.email);
  const domainMatch = eDomain && sDomain && eDomain === sDomain ? 1 : 0;

  const companyMatch = existing.company.toLowerCase() === source.company.toLowerCase() ? 1 : 0;

  const titleDist = levenshtein(
    (existing.jobTitle || '').toLowerCase(),
    (source.jobTitle || '').toLowerCase(),
  );
  const maxTitleLen = Math.max(
    (existing.jobTitle || '').length,
    (source.jobTitle || '').length,
    1,
  );
  const titleSimilarity = 1 - (titleDist / maxTitleLen);

  // Weighted scoring
  score = Math.round(
    nameSimilarity * 40 +
    domainMatch * 25 +
    companyMatch * 20 +
    titleSimilarity * 15,
  );

  // Boost for email rule
  if (rule === 'email' && domainMatch) score = Math.min(100, score + 10);

  // Boost for name+company rule
  if (rule === 'name+company' && companyMatch) score = Math.min(100, score + 5);

  return Math.min(100, Math.max(0, score));
}

/* ── GET Handler ──────────────────────────────────────────────────── */
export async function GET() {
  try {
    // Fetch all contacts with company and batch info
    const contacts = await db.contact.findMany({
      where: {
        status: { not: 'duplicate' },
      },
      include: {
        company: {
          select: { id: true, rawName: true, normalizedName: true, domain: true },
        },
        batch: {
          select: { id: true, fileName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Flatten contacts into a usable shape
    const flat: FlatContact[] = contacts.map(c => ({
      id: c.id,
      name: c.editedName || c.rawName,
      email: c.email,
      company: c.company?.rawName || 'Unknown',
      jobTitle: c.title || c.role || '',
      phone: c.phone || '',
      location: c.location || '',
      sourceBatch: c.batch?.fileName || c.batchId,
      companyId: c.companyId,
      linkedinUrl: c.linkedinUrl,
    }));

    const totalScanned = flat.length;
    const candidates: {
      id: string;
      entityType: 'contact';
      existingRecord: Omit<FlatContact, 'id' | 'companyId' | 'linkedinUrl'>;
      newRecord: Omit<FlatContact, 'id' | 'companyId' | 'linkedinUrl'>;
      fields: ReturnType<typeof buildFields>;
      matchScore: number;
      matchRule: 'email' | 'name+company' | 'linkedin';
      status: 'pending';
    }[] = [];

    const seenPairs = new Set<string>();

    const addPair = (
      existing: FlatContact,
      source: FlatContact,
      rule: 'email' | 'name+company' | 'linkedin',
    ) => {
      // Sort IDs to avoid duplicates
      const [aId, bId] = existing.id < source.id ? [existing.id, source.id] : [source.id, existing.id];
      const pairKey = `${aId}-${bId}`;
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);

      // Don't add if we already have 50
      if (candidates.length >= 50) return;

      const score = calculateScore(rule, existing, source);
      // Skip very low scores
      if (score < 40) return;

      const { id: _eId, companyId: _eCid, linkedinUrl: _eLi, ...existingRec } = existing;
      const { id: _sId, companyId: _sCid, linkedinUrl: _sLi, ...sourceRec } = source;

      candidates.push({
        id: `dup-${aId}-${bId}`,
        entityType: 'contact',
        existingRecord: existingRec,
        newRecord: sourceRec,
        fields: buildFields(existing, source),
        matchScore: score,
        matchRule: rule,
        status: 'pending',
      });
    }

    // ── Strategy 1: Group by company, pairwise name comparison ─────
    const byCompany = new Map<string, FlatContact[]>();
    for (const c of flat) {
      const key = c.companyId || 'unknown';
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(c);
    }

    for (const [_key, group] of Array.from(byCompany)) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length && candidates.length < 50; i++) {
        for (let j = i + 1; j < group.length && candidates.length < 50; j++) {
          const a = group[i];
          const b = group[j];

          // Name + Company match: same company + Levenshtein ≤ 2 on first or last name
          const aName = splitName(a.name);
          const bName = splitName(b.name);
          const firstDist = levenshtein(aName.first.toLowerCase(), bName.first.toLowerCase());
          const lastDist = levenshtein(aName.last.toLowerCase(), bName.last.toLowerCase());

          if (firstDist <= 2 || lastDist <= 2) {
            addPair(a, b, 'name+company');
          }
        }
      }
    }

    // ── Strategy 2: Same email domain + similar name ───────────────
    const byDomain = new Map<string, FlatContact[]>();
    for (const c of flat) {
      const domain = emailDomain(c.email);
      if (!domain) continue;
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(c);
    }

    for (const [_key, group] of Array.from(byDomain)) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length && candidates.length < 50; i++) {
        for (let j = i + 1; j < group.length && candidates.length < 50; j++) {
          const a = group[i];
          const b = group[j];

          // Skip if same company (already handled above)
          if (a.companyId === b.companyId) continue;

          // Email match: same domain + Levenshtein ≤ 2 on first or last name
          const aName = splitName(a.name);
          const bName = splitName(b.name);
          const firstDist = levenshtein(aName.first.toLowerCase(), bName.first.toLowerCase());
          const lastDist = levenshtein(aName.last.toLowerCase(), bName.last.toLowerCase());

          if (firstDist <= 2 || lastDist <= 2) {
            addPair(a, b, 'email');
          }
        }
      }
    }

    // ── Strategy 3: LinkedIn URL match ─────────────────────────────
    const byLinkedin = new Map<string, FlatContact[]>();
    for (const c of flat) {
      if (!c.linkedinUrl) continue;
      // Normalize LinkedIn URL — strip trailing slashes, extract slug
      let slug = c.linkedinUrl
        .replace(/\/$/, '')
        .split('/')
        .pop()
        ?.toLowerCase() || '';
      if (!slug) continue;
      if (!byLinkedin.has(slug)) byLinkedin.set(slug, []);
      byLinkedin.get(slug)!.push(c);
    }

    for (const [_key, group] of Array.from(byLinkedin)) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length && candidates.length < 50; i++) {
        for (let j = i + 1; j < group.length && candidates.length < 50; j++) {
          addPair(group[i], group[j], 'linkedin');
        }
      }
    }

    // Sort by match score descending
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      candidates,
      mergeHistory: [],
      totalScanned,
      totalFound: candidates.length,
    });
  } catch (error) {
    console.error('Duplicates scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan for duplicates', candidates: [], mergeHistory: [], totalScanned: 0, totalFound: 0 },
      { status: 500 },
    );
  }
}