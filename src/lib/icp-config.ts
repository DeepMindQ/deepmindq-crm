import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   ICP (Ideal Customer Profile) Configuration

   Persists ICP profile to DB via SystemSetting model (key-value).
   - On first access, loads from DB; falls back to DEFAULT_ICP.
   - Every update/reset writes to DB immediately.
   - Survives restart, deployment, environment changes.
   ═══════════════════════════════════════════════════════════════ */

export interface IcpProfile {
  /** Target industries (case-insensitive partial match) */
  targetIndustries: string[];
  /** Target company size ranges */
  targetSizeRanges: string[];
  /** Target geographic regions (countries, case-insensitive partial match) */
  targetRegions: string[];
  /** Minimum employee count (parsed from sizeRange or employeeCount) */
  minEmployeeCount: number;
  /** Maximum employee count (-1 = no limit) */
  maxEmployeeCount: number;
  /** Minimum revenue band (e.g. "$1M") — used for text matching */
  minRevenue: string;
  /** Target funding stages */
  targetFundingStages: string[];
  /** Technology keywords that indicate good fit */
  preferredTechKeywords: string[];
  /** Excluded industries (companies here score 0 on static fit) */
  excludedIndustries: string[];
  /** Scoring weights for Static Fit sub-dimensions */
  weights: {
    industry: number;      // 0-1, default 0.3
    companySize: number;   // 0-1, default 0.25
    geography: number;     // 0-1, default 0.15
    revenue: number;       // 0-1, default 0.15
    techFit: number;       // 0-1, default 0.15
  };
}

export const DEFAULT_ICP: IcpProfile = {
  targetIndustries: [
    'technology', 'information technology', 'it services', 'software',
    'fintech', 'financial services', 'saas', 'cloud computing',
    'healthcare', 'healthtech', 'manufacturing', 'retail',
    'e-commerce', 'telecommunications', 'energy', 'automotive',
  ],
  targetSizeRanges: [
    '201-500', '501-1000', '1001-5000', '5001+',
    '5001-10000', '10001+',
  ],
  targetRegions: [
    'united states', 'usa', 'us', 'canada', 'united kingdom', 'uk',
    'india', 'australia', 'germany', 'singapore', 'uae',
  ],
  minEmployeeCount: 50,
  maxEmployeeCount: -1,
  minRevenue: '$1M',
  targetFundingStages: [
    'series a', 'series b', 'series c', 'series d', 'series e',
    'late stage', 'ipo', 'public', 'private equity',
  ],
  preferredTechKeywords: [
    'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker',
    'react', 'node', 'python', 'java', 'typescript',
    'sap', 'salesforce', 'servicenow', 'workday',
    'machine learning', 'ai', 'data analytics', 'microservices',
  ],
  excludedIndustries: [
    'gambling', 'casino', 'adult', 'weapons', 'cryptocurrency mining',
  ],
  weights: {
    industry: 0.3,
    companySize: 0.25,
    geography: 0.15,
    revenue: 0.15,
    techFit: 0.15,
  },
};

const ICP_SETTING_KEY = 'icp_profile_v1';

/* ── DB-backed store ── */

let _loaded = false;
let currentIcp: IcpProfile = { ...DEFAULT_ICP };

/** Load ICP from DB (called lazily on first access) */
async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const row = await db.systemSetting.findUnique({
      where: { key: ICP_SETTING_KEY },
    });
    if (row) {
      const parsed = JSON.parse(row.value) as Partial<IcpProfile>;
      currentIcp = deepMerge(DEFAULT_ICP, parsed) as IcpProfile;
    }
  } catch (err) {
    // DB not available yet (e.g. migration pending) — keep defaults
    console.warn('[icp-config] Could not load ICP from DB, using defaults:', err);
    currentIcp = { ...DEFAULT_ICP };
  }
}

/** Persist current ICP to DB */
async function persistIcp(): Promise<void> {
  try {
    await db.systemSetting.upsert({
      where: { key: ICP_SETTING_KEY },
      create: { key: ICP_SETTING_KEY, value: JSON.stringify(currentIcp) },
      update: { value: JSON.stringify(currentIcp) },
    });
  } catch (err) {
    console.error('[icp-config] Failed to persist ICP to DB:', err);
  }
}

/* ── Deep-merge helper ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(srcVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else if (srcVal !== undefined) {
      result[key] = srcVal;
    }
  }
  return result;
}

/* ═════════════════ Public API ═════════════════ */

/** Get the current ICP profile (loads from DB on first call) */
export async function getIcpProfile(): Promise<IcpProfile> {
  await ensureLoaded();
  return currentIcp;
}

/** Get the ICP profile synchronously (returns in-memory cache, no DB call) */
export function getIcpProfileSync(): IcpProfile {
  return currentIcp;
}

/** Update ICP profile (partial updates deep-merged) + persist to DB */
export async function updateIcpProfile(partial: Partial<IcpProfile>): Promise<IcpProfile> {
  await ensureLoaded();
  currentIcp = deepMerge(currentIcp, partial) as IcpProfile;
  await persistIcp();
  return currentIcp;
}

/** Reset ICP to defaults + persist to DB */
export async function resetIcpProfile(): Promise<IcpProfile> {
  currentIcp = { ...DEFAULT_ICP };
  await persistIcp();
  return currentIcp;
}

/* ═════════════════ Validation Helpers ═════════════════ */

/** Check if a company's industry matches any target industry */
export function industryMatch(industry: string | null, icp: IcpProfile): boolean {
  if (!industry) return false;
  const lower = industry.toLowerCase();
  // Check exclusions first
  if (icp.excludedIndustries.some(ex => lower.includes(ex.toLowerCase()))) {
    return false;
  }
  return icp.targetIndustries.some(ti => lower.includes(ti.toLowerCase()));
}

/** Check if company size range matches any target size range */
export function sizeMatch(sizeRange: string | null, icp: IcpProfile): boolean {
  if (!sizeRange) return false;
  const lower = sizeRange.toLowerCase().replace(/\s+/g, '');
  return icp.targetSizeRanges.some(ts => {
    const tsNorm = ts.toLowerCase().replace(/\s+/g, '');
    return lower.includes(tsNorm) || tsNorm.includes(lower);
  });
}

/** Check if company region matches any target region */
export function regionMatch(country: string | null, location: string | null, icp: IcpProfile): boolean {
  if (!country && !location) return false;
  const combined = `${(country || '').toLowerCase()} ${(location || '').toLowerCase()}`;
  return icp.targetRegions.some(r => combined.includes(r.toLowerCase()));
}

/** Check if tech stack contains preferred tech keywords */
export function techMatch(techStack: string | null, icp: IcpProfile): number {
  if (!techStack) return 0;
  const lower = techStack.toLowerCase();
  let matchCount = 0;
  for (const kw of icp.preferredTechKeywords) {
    if (lower.includes(kw.toLowerCase())) matchCount++;
  }
  // Return ratio: 0 = no match, 1 = many matches
  return Math.min(matchCount / 5, 1);
}

/** Parse employee count from size range string or enrichment data */
export function parseEmployeeCount(
  sizeRange: string | null,
  enrichmentEmployeeCount: string | null,
): number {
  if (enrichmentEmployeeCount) {
    const parsed = parseInt(enrichmentEmployeeCount.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (!sizeRange) return 0;
  // Extract the upper bound of the range
  const match = sizeRange.match(/(\d{1,3}(?:,\d{3})*)\s*[-+]\s*(\d{1,3}(?:,\d{3})*)?/);
  if (match) {
    const upper = match[2] ? parseInt(match[2].replace(/,/g, ''), 10) : parseInt(match[1].replace(/,/g, ''), 10);
    return Number.isFinite(upper) ? upper : 0;
  }
  // Handle "10001+" pattern
  const plusMatch = sizeRange.match(/(\d[\d,]+)\+/);
  if (plusMatch) {
    return parseInt(plusMatch[1].replace(/,/g, ''), 10) || 0;
  }
  return 0;
}