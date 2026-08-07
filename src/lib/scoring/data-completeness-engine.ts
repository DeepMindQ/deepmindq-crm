/**
 * Data Completeness Scoring Engine (Session 8 — Component 4.1)
 *
 * Unified completeness scoring across the entire platform.
 * Consolidates field coverage analysis into a single, pure-function engine
 * that scores companies, contacts, and portfolios.
 *
 * Scoring dimensions (Company):
 *   - Core Identity  (25%): rawName, normalizedName, domain, website, industry, location
 *   - Financial       (20%): revenue, sizeRange, fundingStage
 *   - Intelligence    (20%): techStack, businessOverview, description
 *   - Relationships   (20%): contacts count, signals count
 *   - Activity        (15%): lastEnrichedAt, lastActivityAt
 *
 * Architecture:
 *   - All scoring functions are PURE — no DB access, no side effects
 *   - TypeScript interfaces for all data shapes
 *   - JSDoc on every public function
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Importance level for a data gap. */
export type GapImportance = 'critical' | 'high' | 'medium' | 'low';

/** Suggested enrichment action for a data gap. */
export type SuggestedAction = 'enrich_clearbit' | 'enrich_apollo' | 'import_crm' | 'manual_review';

/** Letter grade for a completeness score. */
export type CompletenessGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Dimension-level score breakdown. */
export interface DimensionScore {
  name: string;
  weight: number;
  score: number;      // 0–100
  weightedScore: number;
  details: string[];
}

/** Result of scoring a single entity (company or contact). */
export interface CompletenessResult {
  entityId: string;
  entityType: 'company' | 'contact';
  overallScore: number;    // 0–100 weighted average
  grade: CompletenessGrade;
  dimensions: DimensionScore[];
  scoredAt: string;        // ISO timestamp
}

/** A specific missing field identified by gap analysis. */
export interface DataGap {
  field: string;
  importance: GapImportance;
  currentStatus: 'missing' | 'empty' | 'stale';
  suggestedAction: SuggestedAction;
}

/** Company with all relations needed for completeness scoring. */
export interface CompanyWithRelations {
  id: string;
  rawName: string;
  normalizedName: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  sizeRange: string | null;
  internalSummary: string | null;
  lastEnrichedAt: Date | null;
  lastActivityAt: Date | null;
  researchCard?: {
    revenue: string | null;
    employeeCount: string | null;
    fundingStage: string | null;
    techStack: unknown | null;   // JSON — could be array, object, or string
    businessOverview: string | null;
  } | null;
  contacts?: Array<{ id: string }>;
  signals?: Array<{ id: string; status: string }>;
}

/** Contact with fields needed for completeness scoring. */
export interface ContactWithFields {
  id: string;
  rawName: string;
  normalizedName: string;
  email: string;
  linkedinUrl: string | null;
  title: string | null;
  role: string | null;
  phone: string | null;
  location: string | null;
  companyFitScore: number;
  engagementScore: number;
  enrichmentScore: number;
  enrichmentData: unknown | null;
  source: string | null;
  consentStatus: string;
}

/** Aggregate portfolio-level completeness report. */
export interface PortfolioCompletenessReport {
  totalCompanies: number;
  averageScore: number;
  medianScore: number;
  gradeDistribution: Record<CompletenessGrade, number>;
  dimensionAverages: Record<string, number>;
  companyScores: CompletenessResult[];
  generatedAt: string;
}

/** Enrichment priority entry. */
export interface EnrichmentPriority {
  companyId: string;
  companyName: string;
  completenessScore: number;
  opportunityScore: number;   // (100 - score) * valueMultiplier
  valueMultiplier: number;
  valueTier: 'enterprise' | 'mid-market' | 'smb' | 'unknown';
  topGaps: DataGap[];
  suggestedActions: SuggestedAction[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Dimension weights for company completeness scoring. */
const COMPANY_DIMENSION_WEIGHTS = {
  coreIdentity: 0.25,
  financial: 0.20,
  intelligence: 0.20,
  relationships: 0.20,
  activity: 0.15,
} as const;

/** Activity freshness thresholds (days → score). */
const ACTIVITY_THRESHOLDS: Array<[number, number]> = [
  [7, 100],    // <7 days
  [30, 80],    // <30 days
  [90, 50],    // <90 days
  [180, 25],   // <180 days
  [Infinity, 0], // >=180 days
];

/** Employee count tier thresholds for value multiplier. */
const EMPLOYEE_TIERS: Array<[number, { tier: EnrichmentPriority['valueTier']; multiplier: number }]> = [
  [1000, { tier: 'enterprise', multiplier: 1.5 }],
  [200,  { tier: 'mid-market', multiplier: 1.2 }],
  [10,   { tier: 'smb',        multiplier: 1.0 }],
  [0,    { tier: 'unknown',    multiplier: 0.8 }],
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Check if a string-like value is present and non-empty. */
function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Non-null object (e.g. techStack JSON) counts as present
    return Object.keys(value as object).length > 0;
  }
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/** Compute days between a date and now. Returns Infinity if null. */
function daysSince(date: Date | null): number {
  if (!date) return Infinity;
  const now = Date.now();
  const then = new Date(date).getTime();
  return Math.max(0, (now - then) / (1000 * 60 * 60 * 24));
}

/** Map a freshness score based on days-since thresholds. */
function freshnessScore(days: number): number {
  for (const [threshold, score] of ACTIVITY_THRESHOLDS) {
    if (days < threshold) return score;
  }
  return 0;
}

/** Derive a letter grade from a 0–100 score. */
export function toGrade(score: number): CompletenessGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Safe rounding to 1 decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Compute median of a number array. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Parse employee count from a string or number. */
function parseEmployeeCount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const num = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(num) ? num : 0;
}

/** Determine value tier from employee count. */
function getValueTier(employeeCount: number): { tier: EnrichmentPriority['valueTier']; multiplier: number } {
  for (const [threshold, result] of EMPLOYEE_TIERS) {
    if (employeeCount >= threshold) return result;
  }
  return { tier: 'unknown', multiplier: 0.8 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Company Dimension Scorers
// ═══════════════════════════════════════════════════════════════════════════

/** Score Core Identity dimension (25%). */
function scoreCoreIdentity(c: CompanyWithRelations): DimensionScore {
  const fields: Array<[string, unknown, string]> = [
    ['rawName', c.rawName, 'Raw company name'],
    ['normalizedName', c.normalizedName, 'Normalized name'],
    ['domain', c.domain, 'Domain'],
    ['website', c.website, 'Website'],
    ['industry', c.industry, 'Industry'],
    ['location', c.location, 'Location'],
  ];

  const details: string[] = [];
  let filled = 0;
  for (const [field, value, label] of fields) {
    if (isPresent(value)) {
      filled++;
      details.push(`${label}: present`);
    } else {
      details.push(`${label}: missing`);
    }
  }

  const score = Math.round((filled / fields.length) * 100);
  const weight = COMPANY_DIMENSION_WEIGHTS.coreIdentity;

  return {
    name: 'Core Identity',
    weight,
    score,
    weightedScore: round1(score * weight),
    details,
  };
}

/** Score Financial dimension (20%). */
function scoreFinancial(c: CompanyWithRelations): DimensionScore {
  const revenue = c.researchCard?.revenue ?? null;
  const sizeRange = c.sizeRange;
  const fundingStage = c.researchCard?.fundingStage ?? null;

  const fields: Array<[string, unknown, string]> = [
    ['revenue', revenue, 'Revenue'],
    ['sizeRange', sizeRange, 'Size range'],
    ['fundingStage', fundingStage, 'Funding stage'],
  ];

  const details: string[] = [];
  let filled = 0;
  for (const [_field, value, label] of fields) {
    if (isPresent(value)) {
      filled++;
      details.push(`${label}: present`);
    } else {
      details.push(`${label}: missing`);
    }
  }

  const score = Math.round((filled / fields.length) * 100);
  const weight = COMPANY_DIMENSION_WEIGHTS.financial;

  return {
    name: 'Financial',
    weight,
    score,
    weightedScore: round1(score * weight),
    details,
  };
}

/** Score Intelligence dimension (20%). */
function scoreIntelligence(c: CompanyWithRelations): DimensionScore {
  const techStack = c.researchCard?.techStack;
  const businessOverview = c.researchCard?.businessOverview ?? null;
  const description = c.internalSummary ?? null;

  const fields: Array<[string, unknown, string]> = [
    ['techStack', techStack, 'Tech stack'],
    ['businessOverview', businessOverview, 'Business overview'],
    ['description', description, 'Internal summary'],
  ];

  const details: string[] = [];
  let filled = 0;
  for (const [_field, value, label] of fields) {
    if (isPresent(value)) {
      filled++;
      details.push(`${label}: present`);
    } else {
      details.push(`${label}: missing`);
    }
  }

  const score = Math.round((filled / fields.length) * 100);
  const weight = COMPANY_DIMENSION_WEIGHTS.intelligence;

  return {
    name: 'Intelligence',
    weight,
    score,
    weightedScore: round1(score * weight),
    details,
  };
}

/** Score Relationships dimension (20%). */
function scoreRelationships(c: CompanyWithRelations): DimensionScore {
  const contactCount = c.contacts?.length ?? 0;
  const signalCount = c.signals?.length ?? 0;

  const details: string[] = [];

  // Contact scoring: 0→0, 1→50, 2+→100
  const contactScore = contactCount === 0 ? 0 : contactCount === 1 ? 50 : 100;
  details.push(`Contacts: ${contactCount} (${contactScore})`);

  // Signal scoring: 0→0, 1→40, 2→70, 3+→100
  let signalScore = 0;
  if (signalCount >= 3) signalScore = 100;
  else if (signalCount === 2) signalScore = 70;
  else if (signalCount === 1) signalScore = 40;
  details.push(`Signals: ${signalCount} (${signalScore})`);

  const score = Math.round((contactScore + signalScore) / 2);
  const weight = COMPANY_DIMENSION_WEIGHTS.relationships;

  return {
    name: 'Relationships',
    weight,
    score,
    weightedScore: round1(score * weight),
    details,
  };
}

/** Score Activity dimension (15%). */
function scoreActivity(c: CompanyWithRelations): DimensionScore {
  const enrichmentDays = daysSince(c.lastEnrichedAt);
  const activityDays = daysSince(c.lastActivityAt);

  const enrichmentFreshness = freshnessScore(enrichmentDays);
  const activityFreshness = freshnessScore(activityDays);

  const details: string[] = [
    `Last enriched: ${c.lastEnrichedAt ? `${Math.round(enrichmentDays)}d ago` : 'never'} (${enrichmentFreshness})`,
    `Last activity: ${c.lastActivityAt ? `${Math.round(activityDays)}d ago` : 'never'} (${activityFreshness})`,
  ];

  // Enrichment matters more than activity (60/40 split)
  const score = Math.round(enrichmentFreshness * 0.6 + activityFreshness * 0.4);
  const weight = COMPANY_DIMENSION_WEIGHTS.activity;

  return {
    name: 'Activity',
    weight,
    score,
    weightedScore: round1(score * weight),
    details,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Contact Dimension Scorers
// ═══════════════════════════════════════════════════════════════════════════

/** Contact completeness dimensions and weights. */
const CONTACT_DIMENSION_WEIGHTS = {
  identity: 0.25,
  professional: 0.25,
  enrichment: 0.25,
  engagement: 0.25,
} as const;

/** Score a contact's identity fields (25%). */
function scoreContactIdentity(c: ContactWithFields): DimensionScore {
  const fields: Array<[unknown, string]> = [
    [c.rawName, 'Raw name'],
    [c.normalizedName, 'Normalized name'],
    [c.email, 'Email'],
  ];
  const details: string[] = [];
  let filled = 0;
  for (const [val, label] of fields) {
    if (isPresent(val)) { filled++; details.push(`${label}: present`); }
    else { details.push(`${label}: missing`); }
  }
  const score = Math.round((filled / fields.length) * 100);
  const weight = CONTACT_DIMENSION_WEIGHTS.identity;
  return { name: 'Identity', weight, score, weightedScore: round1(score * weight), details };
}

/** Score a contact's professional fields (25%). */
function scoreContactProfessional(c: ContactWithFields): DimensionScore {
  const fields: Array<[unknown, string]> = [
    [c.title, 'Title'],
    [c.role, 'Role'],
    [c.linkedinUrl, 'LinkedIn URL'],
    [c.phone, 'Phone'],
    [c.location, 'Location'],
  ];
  const details: string[] = [];
  let filled = 0;
  for (const [val, label] of fields) {
    if (isPresent(val)) { filled++; details.push(`${label}: present`); }
    else { details.push(`${label}: missing`); }
  }
  const score = Math.round((filled / fields.length) * 100);
  const weight = CONTACT_DIMENSION_WEIGHTS.professional;
  return { name: 'Professional', weight, score, weightedScore: round1(score * weight), details };
}

/** Score a contact's enrichment data (25%). */
function scoreContactEnrichment(c: ContactWithFields): DimensionScore {
  const hasEnrichment = isPresent(c.enrichmentData);
  const hasSource = isPresent(c.source);
  const hasConsent = c.consentStatus !== 'unknown';

  const fields: Array<[boolean, string]> = [
    [hasEnrichment, 'Enrichment data'],
    [hasSource, 'Source tracking'],
    [hasConsent, 'Consent status'],
  ];
  const details: string[] = [];
  let filled = 0;
  for (const [present, label] of fields) {
    if (present) { filled++; details.push(`${label}: present`); }
    else { details.push(`${label}: missing`); }
  }
  const score = Math.round((filled / fields.length) * 100);
  const weight = CONTACT_DIMENSION_WEIGHTS.enrichment;
  return { name: 'Enrichment', weight, score, weightedScore: round1(score * weight), details };
}

/** Score a contact's engagement signals (25%). */
function scoreContactEngagement(c: ContactWithFields): DimensionScore {
  // Use existing score fields to gauge engagement readiness
  const hasCompanyFit = c.companyFitScore > 0;
  const hasEngagement = c.engagementScore > 0;
  const hasEnrichmentScore = c.enrichmentScore > 0;

  const fields: Array<[boolean, string]> = [
    [hasCompanyFit, 'Company fit score'],
    [hasEngagement, 'Engagement score'],
    [hasEnrichmentScore, 'Enrichment score'],
  ];
  const details: string[] = [];
  let filled = 0;
  for (const [present, label] of fields) {
    if (present) { filled++; details.push(`${label}: scored`); }
    else { details.push(`${label}: not scored`); }
  }
  const score = Math.round((filled / fields.length) * 100);
  const weight = CONTACT_DIMENSION_WEIGHTS.engagement;
  return { name: 'Engagement', weight, score, weightedScore: round1(score * weight), details };
}

// ═══════════════════════════════════════════════════════════════════════════
// Gap Analysis
// ═══════════════════════════════════════════════════════════════════════════

/** Field → (importance, suggestedAction) mapping for gap analysis. */
const GAP_FIELD_CONFIG: Record<string, { importance: GapImportance; action: SuggestedAction; check: (c: CompanyWithRelations) => boolean }> = {
  domain:            { importance: 'critical', action: 'enrich_clearbit', check: (c) => !isPresent(c.domain) },
  website:           { importance: 'critical', action: 'enrich_clearbit', check: (c) => !isPresent(c.website) },
  industry:          { importance: 'high',    action: 'enrich_apollo',  check: (c) => !isPresent(c.industry) },
  location:          { importance: 'high',    action: 'enrich_clearbit', check: (c) => !isPresent(c.location) },
  sizeRange:         { importance: 'high',    action: 'enrich_apollo',  check: (c) => !isPresent(c.sizeRange) },
  revenue:           { importance: 'high',    action: 'enrich_apollo',  check: (c) => !isPresent(c.researchCard?.revenue) },
  fundingStage:      { importance: 'medium',  action: 'enrich_apollo',  check: (c) => !isPresent(c.researchCard?.fundingStage) },
  techStack:         { importance: 'medium',  action: 'enrich_clearbit', check: (c) => !isPresent(c.researchCard?.techStack) },
  businessOverview:  { importance: 'medium',  action: 'enrich_apollo',  check: (c) => !isPresent(c.researchCard?.businessOverview) },
  contacts:          { importance: 'high',    action: 'import_crm',    check: (c) => (c.contacts?.length ?? 0) === 0 },
  signals:           { importance: 'medium',  action: 'manual_review',  check: (c) => (c.signals?.length ?? 0) === 0 },
  internalSummary:   { importance: 'low',     action: 'manual_review',  check: (c) => !isPresent(c.internalSummary) },
};

/** Determine staleness status for activity-based fields. */
function getActivityStatus(c: CompanyWithRelations, field: 'enrichment' | 'activity'): DataGap['currentStatus'] {
  const date = field === 'enrichment' ? c.lastEnrichedAt : c.lastActivityAt;
  if (!date) return 'missing';
  const days = daysSince(date);
  if (days >= 180) return 'stale';
  return 'empty'; // Not missing but flagged for gap report
}

// ═══════════════════════════════════════════════════════════════════════════
// DataCompletenessEngine
// ═══════════════════════════════════════════════════════════════════════════

export class DataCompletenessEngine {
  // ── Company Scoring ─────────────────────────────────────────────

  /**
   * Score a single company's data completeness across all tracked dimensions.
   *
   * Pure function — no DB access, no side effects.
   *
   * @param company - Company object with relations (researchCard, contacts, signals)
   * @returns CompletenessResult with per-dimension breakdown and letter grade
   */
  static scoreCompany(company: CompanyWithRelations): CompletenessResult {
    const dimensions: DimensionScore[] = [
      scoreCoreIdentity(company),
      scoreFinancial(company),
      scoreIntelligence(company),
      scoreRelationships(company),
      scoreActivity(company),
    ];

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.weightedScore, 0)
    );

    return {
      entityId: company.id,
      entityType: 'company',
      overallScore,
      grade: toGrade(overallScore),
      dimensions,
      scoredAt: new Date().toISOString(),
    };
  }

  // ── Contact Scoring ─────────────────────────────────────────────

  /**
   * Score a single contact's data completeness.
   *
   * Pure function — no DB access, no side effects.
   *
   * @param contact - Contact object with all relevant fields
   * @returns CompletenessResult with per-dimension breakdown and letter grade
   */
  static scoreContact(contact: ContactWithFields): CompletenessResult {
    const dimensions: DimensionScore[] = [
      scoreContactIdentity(contact),
      scoreContactProfessional(contact),
      scoreContactEnrichment(contact),
      scoreContactEngagement(contact),
    ];

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.weightedScore, 0)
    );

    return {
      entityId: contact.id,
      entityType: 'contact',
      overallScore,
      grade: toGrade(overallScore),
      dimensions,
      scoredAt: new Date().toISOString(),
    };
  }

  // ── Portfolio Scoring ───────────────────────────────────────────

  /**
   * Aggregate completeness scores across all companies in a portfolio.
   *
   * Pure function — no DB access, no side effects.
   *
   * @param companies - Array of companies with relations
   * @returns PortfolioCompletenessReport with aggregate statistics
   */
  static scorePortfolio(companies: CompanyWithRelations[]): PortfolioCompletenessReport {
    const results = companies.map((c) => DataCompletenessEngine.scoreCompany(c));

    const scores = results.map((r) => r.overallScore);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const med = median(scores);

    // Grade distribution
    const distribution: Record<CompletenessGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of results) {
      distribution[r.grade]++;
    }

    // Dimension averages
    const dimNames = ['Core Identity', 'Financial', 'Intelligence', 'Relationships', 'Activity'];
    const dimAverages: Record<string, number> = {};
    for (const name of dimNames) {
      const dimScores = results
        .map((r) => r.dimensions.find((d) => d.name === name)?.score ?? 0);
      dimAverages[name] = dimScores.length > 0
        ? Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length)
        : 0;
    }

    return {
      totalCompanies: results.length,
      averageScore: avg,
      medianScore: Math.round(med),
      gradeDistribution: distribution,
      dimensionAverages: dimAverages,
      companyScores: results,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Gap Analysis ────────────────────────────────────────────────

  /**
   * Identify specific missing high-value fields for a company.
   *
   * Pure function — no DB access, no side effects.
   *
   * @param company - Company object with relations
   * @returns Array of DataGap objects sorted by importance (critical first)
   */
  static identifyGaps(company: CompanyWithRelations): DataGap[] {
    const gaps: DataGap[] = [];

    // Static field gaps
    for (const [field, config] of Object.entries(GAP_FIELD_CONFIG)) {
      if (config.check(company)) {
        gaps.push({
          field,
          importance: config.importance,
          currentStatus: 'missing',
          suggestedAction: config.action,
        });
      }
    }

    // Activity staleness gaps
    const enrichmentStatus = getActivityStatus(company, 'enrichment');
    if (enrichmentStatus === 'stale') {
      gaps.push({
        field: 'lastEnrichedAt',
        importance: 'medium',
        currentStatus: 'stale',
        suggestedAction: 'enrich_clearbit',
      });
    }

    const activityStatus = getActivityStatus(company, 'activity');
    if (activityStatus === 'stale') {
      gaps.push({
        field: 'lastActivityAt',
        importance: 'low',
        currentStatus: 'stale',
        suggestedAction: 'manual_review',
      });
    }

    // Sort: critical → high → medium → low
    const importanceOrder: Record<GapImportance, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    gaps.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

    return gaps;
  }

  // ── Enrichment Priority ─────────────────────────────────────────

  /**
   * Rank companies by enrichment opportunity.
   *
   * Formula: opportunityScore = (100 - completenessScore) × valueMultiplier
   * valueMultiplier based on employee count tier:
   *   enterprise (≥1000) = 1.5, mid-market (≥200) = 1.2, smb (≥10) = 1.0, unknown = 0.8
   *
   * Pure function — no DB access, no side effects.
   *
   * @param companies - Array of companies with relations
   * @returns Sorted array of EnrichmentPriority (highest opportunity first)
   */
  static getEnrichmentPriority(companies: CompanyWithRelations[]): EnrichmentPriority[] {
    const priorities: EnrichmentPriority[] = [];

    for (const company of companies) {
      const result = DataCompletenessEngine.scoreCompany(company);
      const gaps = DataCompletenessEngine.identifyGaps(company);

      // Parse employee count from research card
      const employeeCount = parseEmployeeCount(company.researchCard?.employeeCount);
      const { tier, multiplier } = getValueTier(employeeCount);

      const opportunityScore = round1((100 - result.overallScore) * multiplier);

      // Deduplicate suggested actions from top gaps
      const actionSet = new Set<SuggestedAction>();
      const topGaps = gaps.slice(0, 5);
      for (const gap of topGaps) {
        actionSet.add(gap.suggestedAction);
      }

      priorities.push({
        companyId: company.id,
        companyName: company.normalizedName || company.rawName,
        completenessScore: result.overallScore,
        opportunityScore,
        valueMultiplier: multiplier,
        valueTier: tier,
        topGaps,
        suggestedActions: Array.from(actionSet),
      });
    }

    // Sort by opportunity score descending
    priorities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return priorities;
  }
}
