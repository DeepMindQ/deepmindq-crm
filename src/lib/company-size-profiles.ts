/**
 * Company Size Profiles — Phase 1 Enterprise Readiness
 * ====================================================
 *
 * Defines intelligence expectations, data availability patterns,
 * and outreach strategies per company-size segment.
 *
 * Used by:
 *   - ReasoningStrategyRouter (select reasoning depth per segment)
 *   - RecommendationEngine (dynamic target role selection)
 *   - GroundingEngine (coverage expectations)
 *
 * SEGMENTS (based on employee count):
 *   - Enterprise:  5,000+ employees
 *   - Mid-Market:  200–4,999 employees
 *   - SMB:         10–199 employees
 *   - Startup:     <10 employees
 *
 * DESIGN:
 *   - Non-throwing: all functions return results, never throw
 *   - Extensible: new segments can be added without breaking consumers
 *   - Configurable: thresholds are exported for customization
 */

import { logger } from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────

export type CompanySegment = 'enterprise' | 'mid_market' | 'smb' | 'startup';

export type DataAvailability = 'high' | 'medium' | 'low' | 'minimal';

export type ReasoningDepth = 'skip' | 'quick' | 'standard' | 'deep';

export interface CompanySizeProfile {
  /** Segment identifier */
  segment: CompanySegment;
  /** Human-readable label */
  label: string;
  /** Employee count range */
  employeeRange: { min: number; max: number };
  /** Typical data availability for public information */
  dataAvailability: DataAvailability;
  /**
   * Expected intelligence sources for this segment.
   * Sources listed as "expected" should be actively sought.
   * Sources listed as "unlikely" should be skipped gracefully.
   */
  expectedSources: {
    expected: string[];
    unlikely: string[];
  };
  /**
   * Priority signal types for this segment.
   * Signals in this list get a 1.5x weight boost.
   */
  prioritySignals: string[];
  /**
   * Default target roles for outreach.
   * Ordered by relevance (first = most relevant).
   */
  targetRoles: string[];
  /**
   * Default reasoning depth for the 30-step chain.
   * Maps step number to depth override.
   * Steps not listed use "standard".
   */
  stepDepthOverrides: Partial<Record<number, ReasoningDepth>>;
  /**
   * Steps to skip by default for this segment
   * (when prerequisite data is typically unavailable).
   */
  defaultSkipSteps: number[];
  /**
   * LLM tier to use: controls cost vs quality tradeoff.
   */
  llmTier: 'deep' | 'smart' | 'fast';
  /**
   * Maximum tokens per reasoning step.
   */
  maxTokensPerStep: number;
  /**
   * Description of this segment's intelligence characteristics.
   */
  description: string;
  /**
   * Outreach strategy guidance.
   */
  outreachStrategy: string;
}

export interface CompanyClassification {
  segment: CompanySegment;
  profile: CompanySizeProfile;
  confidence: number; // 0-1 how confident we are in this classification
  /** What data the classification was based on */
  basedOn: string[];
}

// ── Segment Thresholds (configurable) ────────────────────────────────

export const SEGMENT_THRESHOLDS = {
  enterprise: { min: 5000, max: Infinity },
  mid_market: { min: 200, max: 4999 },
  smb: { min: 10, max: 199 },
  startup: { min: 0, max: 9 },
} as const;

// ── Profile Definitions ────────────────────────────────────────────

const PROFILES: Record<CompanySegment, CompanySizeProfile> = {
  enterprise: {
    segment: 'enterprise',
    label: 'Enterprise (5,000+ employees)',
    employeeRange: { min: 5000, max: Infinity },
    dataAvailability: 'high',
    expectedSources: {
      expected: [
        'SEC_EDGAR',       // 10-K, 10-Q, 8-K filings
        'NEWS',            // Major news outlets
        'LINKEDIN',        // Employee data, org structure
        'CRUNCHBASE',      // Acquisitions, subsidiaries
        'WEBSITE',         // Product pages, pricing, careers
        'CLEARBIT',        // Firmographic data
        'RSS',             // Press releases, blogs
        'SOCIAL',          // Twitter/X, Glassdoor
      ],
      unlikely: [],
    },
    prioritySignals: [
      'leadership_change', 'tech_change', 'partnership',
      'acquisition', 'expansion', 'rfp',
    ],
    targetRoles: [
      'VP of relevant department',
      'C-suite sponsor',
      'Director of relevant function',
      'Senior Manager',
    ],
    stepDepthOverrides: {
      // Deep analysis for enterprise — run all steps at standard or deep
      7: 'deep',   // Funding & Financial Health (SEC data available)
      8: 'deep',   // Growth Trajectory
      9: 'deep',   // Risk Signal Detection
      10: 'deep',  // Leadership & Org Structure
      11: 'deep',  // Buying Committee Mapping
      12: 'deep',  // Key Decision Maker Profiling
      13: 'deep',  // Strategic Initiative Identification
      14: 'deep',  // Pain Area & Business Problem Analysis
      18: 'deep',  // Opportunity Window Assessment
    },
    defaultSkipSteps: [],
    llmTier: 'deep',
    maxTokensPerStep: 4000,
    description:
      'Large organizations with extensive public data: SEC filings, news coverage, ' +
      'LinkedIn presence, analyst reports. Intelligence is data-rich but complex — ' +
      'multiple stakeholders, layered decision processes, long sales cycles.',
    outreachStrategy:
      'Multi-threaded enterprise engagement: target C-suite for sponsorship, ' +
      'VP-level for requirements, Director-level for evaluation. Leverage SEC filing ' +
      'insights for strategic conversation angles. Expect 6-12 month sales cycle.',
  },

  mid_market: {
    segment: 'mid_market',
    label: 'Mid-Market (200–4,999 employees)',
    employeeRange: { min: 200, max: 4999 },
    dataAvailability: 'medium',
    expectedSources: {
      expected: [
        'NEWS',        // Local and industry news
        'LINKEDIN',    // Employee data, hiring patterns
        'WEBSITE',     // Product pages, team pages, blog
        'CLEARBIT',    // Firmographic data
        'RSS',         // Press releases, blog posts
        'SOCIAL',      // Twitter/X, LinkedIn company page
      ],
      unlikely: [
        'SEC_EDGAR',   // Not public companies typically
        'CRUNCHBASE',  // May not have recent funding data
      ],
    },
    prioritySignals: [
      'hiring', 'tech_change', 'leadership_change',
      'funding', 'partnership', 'expansion',
    ],
    targetRoles: [
      'CTO / VP Engineering',
      'Head of relevant department',
      'Director',
      'CEO/Founder (for smaller mid-market)',
    ],
    stepDepthOverrides: {
      // Focused analysis — skip deep financial, focus on tech and growth
      7: 'quick',   // Funding (may not have SEC data)
      8: 'standard', // Growth Trajectory
      10: 'standard', // Leadership
      11: 'standard', // Buying Committee
      12: 'quick',   // Decision Makers (less publicly known)
    },
    defaultSkipSteps: [], // Don't skip, just reduce depth
    llmTier: 'smart',
    maxTokensPerStep: 2000,
    description:
      'Growing companies with moderate public footprint: LinkedIn presence, ' +
      'website, some news coverage, possibly funding announcements. Data is ' +
      'available but less structured than enterprise. Decision-making is faster.',
    outreachStrategy:
      'Direct engagement with department heads and VPs. Focus on growth signals, ' +
      'technology modernization, and operational efficiency. Leverage hiring patterns ' +
      'and tech stack changes for conversation angles. Expect 3-6 month sales cycle.',
  },

  smb: {
    segment: 'smb',
    label: 'SMB (10–199 employees)',
    employeeRange: { min: 10, max: 199 },
    dataAvailability: 'low',
    expectedSources: {
      expected: [
        'WEBSITE',     // Basic website info
        'LINKEDIN',    // Limited — may have company page
        'SOCIAL',      // Twitter/X, Facebook
        'CLEARBIT',    // Basic firmographics
      ],
      unlikely: [
        'SEC_EDGAR',   // Not public
        'CRUNCHBASE',  // Unlikely to have entries
        'NEWS',        // Rare news coverage
      ],
    },
    prioritySignals: [
      'tech_change', 'website_change', 'hiring',
      'expansion', 'partnership',
    ],
    targetRoles: [
      'Owner / CEO',
      'CTO / Technical Lead',
      'Operations Manager',
    ],
    stepDepthOverrides: {
      // Compressed analysis — skip steps with no data
      7: 'skip',    // Funding (no data)
      8: 'quick',   // Growth (limited data)
      9: 'quick',   // Risk (limited signals)
      10: 'skip',   // Leadership (usually owner/CEO only)
      11: 'skip',   // Buying Committee (too small)
      12: 'skip',   // Decision Makers (same as #10)
      13: 'quick',   // Strategic Initiatives (may be informal)
      15: 'skip',   // Business Problem Prioritization (compressed into #14)
    },
    defaultSkipSteps: [7, 10, 11, 12],
    llmTier: 'fast',
    maxTokensPerStep: 1500,
    description:
      'Small businesses with limited public data. May have a website and social ' +
      'presence but limited structured information. Decision-making is concentrated ' +
      'in 1-2 people. Intelligence quality depends on website depth and social activity.',
    outreachStrategy:
      'Direct outreach to owner/CEO. Focus on immediate pain points and quick wins. ' +
      'Website changes and hiring patterns are key signals. Keep recommendations ' +
      'simple and actionable. Expect 1-3 month sales cycle.',
  },

  startup: {
    segment: 'startup',
    label: 'Startup (<10 employees)',
    employeeRange: { min: 0, max: 9 },
    dataAvailability: 'minimal',
    expectedSources: {
      expected: [
        'WEBSITE',     // May have minimal site or landing page
        'SOCIAL',      // Twitter/X, LinkedIn personal profiles
      ],
      unlikely: [
        'SEC_EDGAR', 'CRUNCHBASE', 'NEWS',
        'LINKEDIN', 'CLEARBIT', 'RSS',
      ],
    },
    prioritySignals: [
      'tech_change', 'website_change', 'hiring',
    ],
    targetRoles: [
      'Founder / CEO',
      'Co-founder / CTO',
    ],
    stepDepthOverrides: {
      // Minimal analysis — most steps skipped
      2: 'skip',    // Industry Context (quick inference only)
      5: 'skip',    // Vendor Ecosystem (no data)
      6: 'skip',    // Digital Maturity (minimal)
      7: 'skip',    // Funding (may have seed round only)
      8: 'skip',    // Growth Trajectory (no historical data)
      9: 'skip',    // Risk Signals (no data)
      10: 'skip',   // Leadership (founder only)
      11: 'skip',   // Buying Committee (too small)
      12: 'skip',   // Decision Makers (founder only)
      13: 'skip',   // Strategic Initiatives (informal)
      14: 'quick',  // Pain Areas (generic inference)
      15: 'skip',   // Business Problem Prioritization
      16: 'quick',  // Signal Synthesis
      17: 'quick',  // Signal Meaning
      19: 'quick',  // Capability Match
      20: 'skip',   // Case Study Match (no data)
      22: 'skip',   // Delivery Experience
      23: 'skip',   // Pricing Alignment
      24: 'skip',   // Proposal (too early)
    },
    defaultSkipSteps: [5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 20, 22, 23, 24],
    llmTier: 'fast',
    maxTokensPerStep: 500,
    description:
      'Very early stage companies with minimal public footprint. Intelligence is ' +
      'extremely limited — may only have a landing page and social profiles. Most ' +
      'reasoning steps produce empty or guessed outputs. Best approach: acknowledge ' +
      'data limitations and provide minimal actionable intelligence.',
    outreachStrategy:
      'Founder-to-founder outreach. Focus on immediate needs and product-market fit. ' +
      'Minimal intelligence available — set expectations low. Website is the primary ' +
      'intelligence source. Best approach: "We saw you\'re building X — can we help?"',
  },
};

// ── Main Classification Function ──────────────────────────────────

/**
 * Classify a company into a size segment based on available data.
 *
 * Classification priority:
 *   1. Employee count (most reliable)
 *   2. Revenue estimate (if available)
 *   3. Company type tags (startup, agency, enterprise)
 *   4. Signal-based inference (funding rounds, hiring volume)
 *
 * Non-throwing: returns 'smb' as default if no data available.
 */
export function classifyCompany(input: {
  employeeCount?: number | null;
  revenue?: number | null;
  companyType?: string | null;
  fundingRounds?: number;
  hiringSignals?: number;
  industry?: string | null;
}): CompanyClassification {
  const { employeeCount, revenue, companyType, fundingRounds, hiringSignals, industry } = input;
  const basedOn: string[] = [];
  let confidence = 0;

  // ── Method 1: Direct employee count (most reliable) ──
  if (employeeCount !== undefined && employeeCount !== null && employeeCount >= 0) {
    const segment = classifyByEmployees(employeeCount);
    basedOn.push(`employee_count=${employeeCount}`);
    confidence = 0.95; // Direct data is highly reliable
    return {
      segment,
      profile: PROFILES[segment],
      confidence,
      basedOn,
    };
  }

  // ── Method 2: Revenue estimate ──
  if (revenue !== undefined && revenue !== null) {
    const segment = classifyByRevenue(revenue);
    if (segment) {
      basedOn.push(`revenue_estimate=$${(revenue / 1_000_000).toFixed(1)}M`);
      confidence = 0.7;
      return {
        segment,
        profile: PROFILES[segment],
        confidence,
        basedOn,
      };
    }
  }

  // ── Method 3: Company type tags ──
  if (companyType) {
    const typeLower = companyType.toLowerCase();
    if (typeLower.includes('startup') || typeLower.includes('early stage')) {
      basedOn.push(`company_type="${companyType}"`);
      return { segment: 'startup', profile: PROFILES.startup, confidence: 0.8, basedOn };
    }
    if (typeLower.includes('enterprise') || typeLower.includes('large')) {
      basedOn.push(`company_type="${companyType}"`);
      return { segment: 'enterprise', profile: PROFILES.enterprise, confidence: 0.8, basedOn };
    }
  }

  // ── Method 4: Signal-based inference ──
  if (fundingRounds !== undefined || hiringSignals !== undefined) {
    const totalSignals = (fundingRounds || 0) + (hiringSignals || 0);
    if (totalSignals === 0 && !employeeCount) {
      // No signals at all — likely very small or unknown
      basedOn.push('no_signals_detected');
      return { segment: 'smb', profile: PROFILES.smb, confidence: 0.3, basedOn };
    }
    if (fundingRounds !== undefined && fundingRounds > 0) {
      basedOn.push(`funding_rounds=${fundingRounds}`);
      // Companies with many funding rounds tend to be mid-market+
      if (fundingRounds >= 3) {
        return { segment: 'mid_market', profile: PROFILES.mid_market, confidence: 0.5, basedOn };
      }
      return { segment: 'startup', profile: PROFILES.startup, confidence: 0.5, basedOn };
    }
  }

  // ── Default: SMB (middle ground, lowest risk assumption) ──
  basedOn.push('default_assumption');
  logger.info(`[company-size] No classification data available — defaulting to SMB`);
  return { segment: 'smb', profile: PROFILES.smb, confidence: 0.2, basedOn };
}

/**
 * Classify by employee count directly.
 */
function classifyByEmployees(count: number): CompanySegment {
  if (count >= SEGMENT_THRESHOLDS.enterprise.min) return 'enterprise';
  if (count >= SEGMENT_THRESHOLDS.mid_market.min) return 'mid_market';
  if (count >= SEGMENT_THRESHOLDS.smb.min) return 'smb';
  return 'startup';
}

/**
 * Classify by revenue estimate.
 * Returns null if revenue doesn't clearly indicate a segment.
 */
function classifyByRevenue(revenue: number): CompanySegment | null {
  // Revenue in USD
  if (revenue >= 1_000_000_000) return 'enterprise';     // $1B+
  if (revenue >= 50_000_000) return 'mid_market';          // $50M+
  if (revenue >= 5_000_000) return 'smb';                  // $5M+
  return null; // Below $5M — ambiguous, don't classify by revenue alone
}

// ── Accessors ──────────────────────────────────────────────────────

/**
 * Get the profile for a specific segment.
 */
export function getProfile(segment: CompanySegment): CompanySizeProfile {
  return PROFILES[segment];
}

/**
 * Get all profiles.
 */
export function getAllProfiles(): Record<CompanySegment, CompanySizeProfile> {
  return { ...PROFILES };
}

/**
 * Get appropriate target roles for a company based on available data.
 * This is the dynamic replacement for hardcoded "CTO or VP Engineering".
 */
export function resolveTargetRoles(input: {
  employeeCount?: number | null;
  companyType?: string | null;
  knownContacts?: Array<{ role?: string | null; level?: string | null }>;
  signals?: Array<{ signalType: string }>;
}): string[] {
  // If we have known contacts, use their actual roles
  if (input.knownContacts && input.knownContacts.length > 0) {
    const contactRoles = input.knownContacts
      .map(c => c.role)
      .filter((r): r is string => !!r && r.length > 0);

    if (contactRoles.length > 0) {
      return [...new Set(contactRoles)].slice(0, 4);
    }
  }

  // Classify company and use segment defaults
  const classification = classifyCompany({
    employeeCount: input.employeeCount,
    companyType: input.companyType,
  });

  // For signal-specific role overrides
  const signalRoles: string[] = [];
  if (input.signals) {
    for (const signal of input.signals) {
      if (signal.signalType === 'funding' || signal.signalType === 'leadership_change') {
        signalRoles.push('CFO');
      }
      if (signal.signalType === 'tech_change') {
        signalRoles.push('CTO');
      }
      if (signal.signalType === 'hiring') {
        signalRoles.push('VP HR');
        signalRoles.push('Talent Acquisition Lead');
      }
    }
  }

  // Merge: segment defaults + signal-specific roles
  const merged = [...classification.profile.targetRoles];
  for (const role of signalRoles) {
    if (!merged.includes(role)) {
      merged.push(role);
    }
  }

  return merged.slice(0, 5);
}

/**
 * Determine if a data source is expected for a given segment.
 * Used by grounding engine to adjust coverage expectations.
 */
export function isSourceExpected(
  segment: CompanySegment,
  sourceName: string
): { expected: boolean; priority: 'primary' | 'secondary' | 'skip' } {
  const profile = PROFILES[segment];
  const sourceLower = sourceName.toUpperCase();

  if (profile.expectedSources.unlikely.some(s => sourceLower.includes(s.toUpperCase()))) {
    return { expected: false, priority: 'skip' };
  }

  const isExpected = profile.expectedSources.expected.some(
    s => sourceLower.includes(s.toUpperCase())
  );

  return {
    expected: isExpected,
    priority: isExpected ? 'primary' : 'secondary',
  };
}
