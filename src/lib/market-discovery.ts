/**
 * M5 WOW #2 — Market Intelligence Discovery Service
 *
 * Composition layer that accepts a natural language query, parses it for
 * industry/geography/size criteria, queries the database, scores each company
 * using existing engines (ICP config, account scoring, buying intent), and
 * returns ranked results with TRUST metadata.
 *
 * Architecture Principle: DO NOT rebuild engines.
 * This service COMPOSES existing scoring/intent modules.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getIcpProfile,
  industryMatch,
  regionMatch,
  DEFAULT_ICP,
  type IcpProfile,
} from '@/lib/icp-config';
import { calculateAccountScore, type AccountScoreResult } from '@/lib/revenue-intelligence/account-scoring';
import { scoreBuyingIntent, type BuyingIntentScore } from '@/lib/scoring/buying-intent-engine';
import {
  aggregateTrust,
  platformComputedTrust,
  type TrustMetadata,
} from '@/lib/intelligence-sources/trust-metadata';

// ─── Types ────────────────────────────────────────────────────────

/** Parsed criteria from the NL query */
export interface ParsedQuery {
  /** Raw query string */
  rawQuery: string;
  /** Industry keywords extracted */
  industries: string[];
  /** Geography/country terms extracted */
  geographies: string[];
  /** Size preferences (e.g. 'enterprise', 'mid-market', 'startup') */
  sizePreferences: string[];
  /** Theme/technology keywords (e.g. 'AI', 'cloud', 'modernization') */
  themes: string[];
}

/** A relevant contact for a discovered company */
export interface RelevantContact {
  name: string;
  title: string | null;
  email: string | null;
  role: string | null;
  leadScore: number;
}

/** Evidence signal attached to a result */
export interface EvidenceSignal {
  type: string;
  label: string;
  score: number;
  source: string;
  date: string;
}

/** A single market discovery result */
export interface MarketDiscoveryResult {
  /** Company ID */
  companyId: string;
  /** Company name */
  companyName: string;
  /** Domain */
  domain: string | null;
  /** Industry */
  industry: string | null;
  /** Country */
  country: string | null;
  /** Location */
  location: string | null;
  /** Size range */
  sizeRange: string | null;

  // ── Composite Scores ──
  /** Overall market match score 0-100 */
  matchScore: number;
  /** ICP alignment score 0-100 */
  icpScore: number;
  /** Account score 0-100 */
  accountScore: number;
  /** Buying intent score 0-100 */
  buyingIntentScore: number;

  // ── Explanations ──
  /** Why this company matches */
  whyMatch: string[];
  /** Evidence signals driving the score */
  evidenceSignals: EvidenceSignal[];
  /** Buying indicators */
  buyingIndicators: string[];
  /** Relevant contacts */
  relevantContacts: RelevantContact[];
  /** Recommended approach */
  recommendedApproach: string;
  /** Timing window */
  timingWindow: string;

  // ── TRUST ──
  trust: TrustMetadata;
}

/** Full discovery response */
export interface MarketDiscoveryResponse {
  success: boolean;
  results: MarketDiscoveryResult[];
  trust: TrustMetadata;
  query: ParsedQuery;
  totalCompaniesQueried: number;
  latencyMs: number;
}

// ─── Query Parsing ────────────────────────────────────────────────

/** Geography keyword → canonical form mapping */
const GEOGRAPHY_MAP: Record<string, string> = {
  'europe': 'europe', 'european': 'europe',
  'uk': 'united kingdom', 'britain': 'united kingdom', 'england': 'united kingdom',
  'us': 'united states', 'usa': 'united states', 'america': 'united states',
  'germany': 'germany', 'france': 'france', 'spain': 'spain', 'italy': 'italy',
  'netherlands': 'netherlands', 'nordics': 'nordics', 'scandinavia': 'scandinavia',
  'india': 'india', 'australia': 'australia', 'canada': 'canada',
  'singapore': 'singapore', 'japan': 'japan', 'uae': 'uae', 'dubai': 'uae',
  'brazil': 'brazil', 'mexico': 'mexico', 'latam': 'latin america',
  'apac': 'asia pacific', 'emea': 'emea', 'sea': 'southeast asia',
  'middle east': 'middle east', 'africa': 'africa', 'asia': 'asia',
};

/** Size preference keywords */
const SIZE_KEYWORDS: Record<string, string[]> = {
  'enterprise': ['enterprise', 'large', '5000+', '10000+', '10001+'],
  'mid-market': ['mid-market', 'midmarket', 'mid market', '500-5000', '501-5000'],
  'smb': ['smb', 'small business', 'startup', 'small', '1-50', '1-200'],
};

/** Industry theme mapping */
const INDUSTRY_THEMES: Record<string, string[]> = {
  'technology': ['technology', 'tech', 'software', 'saas', 'it services', 'cloud',
    'ai', 'machine learning', 'data', 'fintech', 'healthtech', 'edtech',
    'information technology', 'cybersecurity', 'devops'],
  'financial services': ['financial services', 'finance', 'banking', 'insurance',
    'fintech', 'capital markets', 'wealth management'],
  'healthcare': ['healthcare', 'health', 'pharma', 'biotech', 'medical',
    'healthtech', 'life sciences', 'hospital'],
  'manufacturing': ['manufacturing', 'industrial', 'automotive', 'aerospace',
    'supply chain', 'logistics'],
  'retail': ['retail', 'e-commerce', 'ecommerce', 'consumer goods', 'fmcg'],
  'telecommunications': ['telecommunications', 'telecom', 'telco', '5g',
    'wireless', 'broadband'],
  'energy': ['energy', 'oil and gas', 'renewable', 'utilities', 'sustainability',
    'green energy', 'solar', 'wind'],
  'government': ['government', 'public sector', 'defense', 'federal', 'state'],
};

/** Parse a natural language query into structured criteria */
export function parseMarketQuery(query: string): ParsedQuery {
  const lower = query.toLowerCase();

  // Extract geography
  const geographies: string[] = [];
  for (const [keyword, canonical] of Object.entries(GEOGRAPHY_MAP)) {
    if (lower.includes(keyword) && !geographies.includes(canonical)) {
      geographies.push(canonical);
    }
  }

  // Extract size preferences
  const sizePreferences: string[] = [];
  for (const [sizeCategory, keywords] of Object.entries(SIZE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      sizePreferences.push(sizeCategory);
    }
  }

  // Extract industry themes
  const industries: string[] = [];
  for (const [theme, keywords] of Object.entries(INDUSTRY_THEMES)) {
    if (keywords.some(kw => lower.includes(kw)) && !industries.includes(theme)) {
      industries.push(theme);
    }
  }

  // Extract technology/business themes (remaining notable terms)
  const themeKeywords = [
    'ai', 'artificial intelligence', 'machine learning', 'ml',
    'cloud', 'cloud computing', 'aws', 'azure', 'gcp',
    'modernization', 'digital transformation', 'digital',
    'data analytics', 'analytics', 'big data',
    'kubernetes', 'docker', 'devops', 'ci/cd',
    'security', 'cybersecurity', 'compliance',
    'automation', 'rpa', 'integration',
    'crm', 'erp', 'sap', 'salesforce',
  ];
  const themes: string[] = [];
  for (const tk of themeKeywords) {
    if (lower.includes(tk) && !themes.includes(tk)) {
      themes.push(tk);
    }
  }

  return {
    rawQuery: query,
    industries,
    geographies,
    sizePreferences,
    themes,
  };
}

// ─── Company Querying ─────────────────────────────────────────────

/** Build a Prisma WHERE clause from parsed query criteria */
function buildCompanyWhere(parsed: ParsedQuery) {
  const conditions: Record<string, unknown>[] = [
    { status: { not: 'archived' } },
  ];

  // Industry filtering: use OR across all industry keywords
  if (parsed.industries.length > 0) {
    const allIndustryKeywords: string[] = [];
    for (const theme of parsed.industries) {
      const kws = INDUSTRY_THEMES[theme];
      if (kws) allIndustryKeywords.push(...kws);
    }
    if (allIndustryKeywords.length > 0) {
      conditions.push({
        OR: allIndustryKeywords.map(kw => ({
          industry: { contains: kw, mode: 'insensitive' as const },
        })),
      });
    }
  }

  // Theme filtering: match against industry or internalSummary
  if (parsed.themes.length > 0) {
    conditions.push({
      OR: [
        ...parsed.themes.map(t => ({
          industry: { contains: t, mode: 'insensitive' as const },
        })),
        ...parsed.themes.map(t => ({
          internalSummary: { contains: t, mode: 'insensitive' as const },
        })),
      ],
    });
  }

  // Geography filtering
  if (parsed.geographies.length > 0) {
    const geoConditions = parsed.geographies.flatMap(geo => [
      { country: { contains: geo, mode: 'insensitive' as const } },
      { location: { contains: geo, mode: 'insensitive' as const } },
    ]);
    conditions.push({ OR: geoConditions });
  }

  // Size filtering
  if (parsed.sizePreferences.includes('enterprise')) {
    conditions.push({
      sizeRange: { contains: '5001', mode: 'insensitive' as const },
    });
  } else if (parsed.sizePreferences.includes('mid-market')) {
    conditions.push({
      OR: [
        { sizeRange: { contains: '201', mode: 'insensitive' as const } },
        { sizeRange: { contains: '501', mode: 'insensitive' as const } },
        { sizeRange: { contains: '1001', mode: 'insensitive' as const } },
      ],
    });
  } else if (parsed.sizePreferences.includes('smb')) {
    conditions.push({
      OR: [
        { sizeRange: { contains: '1-10', mode: 'insensitive' as const } },
        { sizeRange: { contains: '11-50', mode: 'insensitive' as const } },
        { sizeRange: { contains: '1-50', mode: 'insensitive' as const } },
        { sizeRange: { contains: '1-200', mode: 'insensitive' as const } },
      ],
    });
  }

  return { AND: conditions };
}

// ─── Scoring Composition ──────────────────────────────────────────

/** Compute ICP alignment score (0-100) for a company against parsed criteria */
function computeIcpAlignment(
  company: { industry: string | null; country: string | null; location: string | null;
             sizeRange: string | null; domain: string | null },
  icp: IcpProfile,
  parsed: ParsedQuery,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Industry match
  if (company.industry) {
    const matchesIcp = industryMatch(company.industry, icp);
    const matchesQuery = parsed.industries.length === 0 ||
      parsed.industries.some(theme => {
        const kws = INDUSTRY_THEMES[theme];
        return kws?.some(kw => company.industry!.toLowerCase().includes(kw));
      });
    if (matchesIcp && matchesQuery) {
      score += 35;
      reasons.push(`Industry "${company.industry}" matches ICP and query criteria`);
    } else if (matchesQuery) {
      score += 20;
      reasons.push(`Industry "${company.industry}" matches query criteria`);
    }
  }

  // Geography match
  if (company.country || company.location) {
    const matchesIcp = regionMatch(company.country, company.location, icp);
    const matchesQuery = parsed.geographies.length === 0 ||
      parsed.geographies.some(geo => {
        const combined = `${(company.country || '').toLowerCase()} ${(company.location || '').toLowerCase()}`;
        return combined.includes(geo.toLowerCase());
      });
    if (matchesIcp && matchesQuery) {
      score += 25;
      reasons.push(`Location (${company.country || company.location}) matches ICP and query`);
    } else if (matchesQuery) {
      score += 15;
      reasons.push(`Location (${company.country || company.location}) matches query geography`);
    }
  }

  // Size match
  if (company.sizeRange) {
    const sizeLower = company.sizeRange.toLowerCase().replace(/\s+/g, '');
    const matchesIcp = icp.targetSizeRanges.some(ts =>
      sizeLower.includes(ts.toLowerCase().replace(/\s+/g, '')) ||
      ts.toLowerCase().replace(/\s+/g, '').includes(sizeLower)
    );
    if (matchesIcp) {
      score += 20;
      reasons.push(`Company size (${company.sizeRange}) aligns with ICP target ranges`);
    }
  }

  // Domain presence (digital maturity)
  if (company.domain) {
    score += 10;
    reasons.push('Has verified domain — digital presence confirmed');
  }

  // Theme match bonus (technology keywords in tags or industry)
  if (parsed.themes.length > 0) {
    const themeMatchCount = parsed.themes.filter(t =>
      (company.industry || '').toLowerCase().includes(t)
    ).length;
    if (themeMatchCount > 0) {
      const bonus = Math.min(10, themeMatchCount * 5);
      score += bonus;
      reasons.push(`${themeMatchCount} technology theme(s) match company profile`);
    }
  }

  return { score: Math.min(100, score), reasons };
}

// ─── Main Discovery Function ──────────────────────────────────────

/**
 * Discover companies matching a natural language market query.
 *
 * Pipeline:
 * 1. Parse NL query → structured criteria
 * 2. Query companies from DB matching criteria
 * 3. Score each company: ICP alignment + account score + buying intent
 * 4. Rank by composite match score
 * 5. Attach TRUST metadata
 * 6. Return top N results
 */
export async function discoverMarket(
  query: string,
  maxResults: number = 10,
): Promise<MarketDiscoveryResponse> {
  const startedAt = Date.now();

  // 1. Parse the query
  const parsed = parseMarketQuery(query);
  logger.info('[market-discovery] Query parsed', {
    industries: parsed.industries,
    geographies: parsed.geographies,
    sizePreferences: parsed.sizePreferences,
    themes: parsed.themes,
  });

  // 2. Load ICP profile
  let icp: IcpProfile;
  try {
    icp = await getIcpProfile();
  } catch (err) {
    logger.warn('[market-discovery] ICP profile load failed, using defaults', { error: err });
    icp = DEFAULT_ICP;
  }

  // 3. Query companies
  const whereClause = buildCompanyWhere(parsed);
  const companies = await db.company.findMany({
    where: whereClause,
    select: {
      id: true,
      rawName: true,
      domain: true,
      industry: true,
      country: true,
      location: true,
      sizeRange: true,
      internalSummary: true,
      intelligenceScore: true,
    },
    orderBy: { intelligenceScore: 'desc' },
    take: maxResults * 3, // Over-fetch for ranking
  });

  logger.info('[market-discovery] Companies queried', { count: companies.length });

  // 4. Score each company
  const results: MarketDiscoveryResult[] = [];
  const allTrustItems: TrustMetadata[] = [];

  for (const company of companies) {
    if (results.length >= maxResults) break;

    try {
      // 4a. ICP alignment score
      const icpResult = computeIcpAlignment(company, icp, parsed);

      // 4b. Account score (graceful degradation)
      let accountScoreVal = 0;
      let accountBreakdown: AccountScoreResult | null = null;
      try {
        accountBreakdown = await calculateAccountScore(company.id);
        accountScoreVal = accountBreakdown.score;
      } catch (err) {
        logger.debug('[market-discovery] Account scoring failed for', {
          companyId: company.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // 4c. Buying intent score (graceful degradation)
      let buyingIntentVal = 0;
      let buyingIntentData: BuyingIntentScore | null = null;
      try {
        buyingIntentData = await scoreBuyingIntent(company.id);
        buyingIntentVal = buyingIntentData.overallIntentScore;
      } catch (err) {
        logger.debug('[market-discovery] Buying intent scoring failed for', {
          companyId: company.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // 4d. Fetch relevant contacts
      const contacts = await db.contact.findMany({
        where: { companyId: company.id, status: { not: 'archived' } },
        select: {
          rawName: true,
          title: true,
          email: true,
          role: true,
          leadScore: true,
        },
        orderBy: { leadScore: 'desc' },
        take: 3,
      });

      const relevantContacts: RelevantContact[] = contacts.map(c => ({
        name: c.rawName,
        title: c.title,
        email: c.email,
        role: c.role,
        leadScore: c.leadScore,
      }));

      // 4e. Build evidence signals
      const evidenceSignals: EvidenceSignal[] = [];
      if (buyingIntentData) {
        for (const signal of buyingIntentData.topSignals.slice(0, 5)) {
          evidenceSignals.push({
            type: signal.category,
            label: signal.signal,
            score: signal.score,
            source: signal.source,
            date: signal.date,
          });
        }
      }
      if (accountBreakdown) {
        if (accountBreakdown.breakdown.signalStrength > 50) {
          evidenceSignals.push({
            type: 'account_signal',
            label: `Strong signal portfolio (${accountBreakdown.breakdown.signalStrength}/100)`,
            score: accountBreakdown.breakdown.signalStrength,
            source: 'account-scoring-engine',
            date: new Date().toISOString(),
          });
        }
      }

      // 4f. Build buying indicators
      const buyingIndicators: string[] = [];
      if (buyingIntentData) {
        if (buyingIntentData.categoryScores.technology_trigger >= 40) {
          buyingIndicators.push('Technology trigger signals detected');
        }
        if (buyingIntentData.categoryScores.growth >= 40) {
          buyingIndicators.push('Active growth phase with expansion signals');
        }
        if (buyingIntentData.categoryScores.pain_point >= 40) {
          buyingIndicators.push('Pain points identified — solution-ready');
        }
        if (buyingIntentData.categoryScores.engagement >= 30) {
          buyingIndicators.push('Existing engagement signals present');
        }
        if (buyingIntentData.intentStrength === 'very_high' || buyingIntentData.intentStrength === 'high') {
          buyingIndicators.push(`High buying intent (${buyingIntentData.overallIntentScore}/100)`);
        }
      }
      if (relevantContacts.length > 0 && relevantContacts[0].leadScore >= 70) {
        buyingIndicators.push(`High-value contact: ${relevantContacts[0].name} (${relevantContacts[0].title})`);
      }

      // 4g. Composite match score
      // Weights: ICP 40%, Account Score 35%, Buying Intent 25%
      const matchScore = Math.round(
        (icpResult.score * 0.40) +
        (accountScoreVal * 0.35) +
        (buyingIntentVal * 0.25)
      );

      // 4h. Recommended approach
      const recommendedApproach = buyingIntentData?.recommendedApproach ||
        (matchScore >= 70 ? 'Strong fit — proceed with personalized outreach'
          : matchScore >= 50 ? 'Moderate fit — nurture with value-driven content'
          : 'Early stage — monitor and enrich data');

      const timingWindow = buyingIntentData?.timingWindow || 'Undetermined';

      // 4i. TRUST metadata for this result
      const trustItems: TrustMetadata[] = [
        platformComputedTrust(
          'market_discovery_result',
          `Composite score ${matchScore}/100 from ICP(${icpResult.score}), Account(${accountScoreVal}), Intent(${buyingIntentVal})`,
          1 + (buyingIntentData?.topSignals.length || 0) + (evidenceSignals.length > 0 ? 1 : 0),
          matchScore >= 60 ? 'medium' : 'low',
        ),
      ];
      if (buyingIntentData && buyingIntentVal > 0) {
        trustItems.push(platformComputedTrust(
          'buying_intent',
          `Buying intent ${buyingIntentVal}/100 from ${buyingIntentData.topSignals.length} signals`,
          buyingIntentData.topSignals.length,
          buyingIntentVal >= 60 ? 'medium' : 'low',
        ));
      }
      const resultTrust = aggregateTrust(trustItems);
      allTrustItems.push(resultTrust);

      results.push({
        companyId: company.id,
        companyName: company.rawName,
        domain: company.domain,
        industry: company.industry,
        country: company.country,
        location: company.location,
        sizeRange: company.sizeRange,
        matchScore,
        icpScore: icpResult.score,
        accountScore: accountScoreVal,
        buyingIntentScore: buyingIntentVal,
        whyMatch: icpResult.reasons,
        evidenceSignals,
        buyingIndicators,
        relevantContacts,
        recommendedApproach,
        timingWindow,
        trust: resultTrust,
      });
    } catch (err) {
      logger.warn('[market-discovery] Failed to score company', {
        companyId: company.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue processing other companies (graceful degradation)
    }
  }

  // 5. Rank by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  // 6. Build aggregate TRUST metadata for the response
  const responseTrust = aggregateTrust(allTrustItems.length > 0 ? allTrustItems : [
    platformComputedTrust(
      'market_discovery_response',
      `Discovery completed with ${results.length} results from ${companies.length} candidates`,
      results.length,
      results.length > 0 ? 'medium' : 'low',
    ),
  ]);

  const latencyMs = Date.now() - startedAt;

  logger.info('[market-discovery] Discovery complete', {
    resultsCount: results.length,
    queriedCount: companies.length,
    latencyMs,
  });

  return {
    success: true,
    results,
    trust: responseTrust,
    query: parsed,
    totalCompaniesQueried: companies.length,
    latencyMs,
  };
}
