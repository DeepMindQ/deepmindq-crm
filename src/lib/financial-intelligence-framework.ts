/**
 * M5 Phase 1.2 — Financial Intelligence Framework
 *
 * The problem: Financial data across the platform is a mix of verified external data,
 * AI-estimated guesses, and customer-provided values — with NO distinction between them.
 * Revenue appears as "$10M-$50M" (AI string estimate) with no numeric value, no source,
 * no confidence. This makes the platform's intelligence untrustworthy for enterprise buyers.
 *
 * The solution: A unified financial data model that:
 *   1. Classifies every financial data point as KNOWN or ESTIMATED
 *   2. Provides numeric values alongside display strings
 *   3. Attaches TRUST metadata to every financial field
 *   4. Populates the existing fieldConfidence JSON on CompanyResearchCard
 *
 * Data Classification:
 *   KNOWN_VERIFIED    — From verified API (Clearbit, Apollo, SEC filings)
 *   KNOWN_CUSTOMER    — Provided by customer (CRM, upload)
 *   ESTIMATED_AI      — AI-generated estimate (Llama, web search inference)
 *   ESTIMATED_SIGNAL  — Inferred from signals (job postings, press releases)
 *   UNKNOWN           — No data available
 *
 * Design Principle:
 *   The platform must NEVER present an estimated value as a known value.
 *   Every financial display must show: value + source label + confidence indicator.
 */

import type { TrustMetadata } from './intelligence-sources/trust-metadata';
import {
  verifiedApiTrust,
  customerDataTrust,
  aiInferenceTrust,
  platformComputedTrust,
  computeTrustScore,
} from './intelligence-sources/trust-metadata';

// ─── Financial Data Classification ──────────────────────────────

export type FinancialDataSource =
  | 'known_verified'     // Verified by external API
  | 'known_customer'     // Provided by customer
  | 'estimated_ai'       // AI-generated estimate
  | 'estimated_signal'   // Inferred from signals
  | 'unknown';           // No data available

export type FinancialDataType =
  | 'revenue'            // Annual revenue / ARR
  | 'employees'          // Employee count
  | 'funding'            // Total funding raised
  | 'market_cap'         // Market capitalization (public companies)
  | 'growth_rate'        // YoY growth rate
  | 'tech_spend'         // Estimated technology spend
  | 'valuation';          // Company valuation

// ─── Financial Data Point ───────────────────────────────────────

/**
 * A single financial data point with full provenance.
 * This is the internal representation — NOT what gets shown to users.
 * The display layer transforms this into human-readable output.
 */
export interface FinancialDataPoint {
  /** The type of financial data */
  type: FinancialDataType;

  /** Numeric value (if available). Null for unknown. */
  numericValue: number | null;

  /** Display string for UI (e.g., "$10M-$50M", "1,000-5,000") */
  displayValue: string;

  /** Currency code (if applicable) */
  currency: string | null;

  /** Where this data came from */
  source: FinancialDataSource;

  /** Specific provider (e.g., 'clearbit', 'apollo', 'user_upload') */
  provider: string | null;

  /** When this was last verified/updated */
  verifiedAt: string | null;

  /** TRUST metadata for this specific data point */
  trust: TrustMetadata;

  /** Upper bound of range (for estimated values) */
  rangeUpper: number | null;

  /** Lower bound of range (for estimated values) */
  rangeLower: number | null;
}

// ─── Company Financial Profile ─────────────────────────────────

/**
 * Complete financial profile for a company.
 * Composed from multiple sources, each data point independently classified.
 */
export interface CompanyFinancialProfile {
  companyId: string;
  companyName: string;

  /** Individual financial data points */
  revenue: FinancialDataPoint;
  employees: FinancialDataPoint;
  funding: FinancialDataPoint;
  marketCap: FinancialDataPoint;
  growthRate: FinancialDataPoint;
  valuation: FinancialDataPoint;

  /** Composite TRUST score across all financial data */
  compositeTrustScore: number;
  compositeTrustGrade: string;

  /** Percentage of financial fields that have known (vs estimated) data */
  knownDataCoverage: number;

  /** When the profile was last computed */
  computedAt: string;
}

// ─── Field Confidence Builder ───────────────────────────────────

/**
 * Build the fieldConfidence JSON for CompanyResearchCard.
 * This is what gets persisted to the database.
 *
 * Format:
 * {
 *   revenue: { source: 'known_verified', confidence: 0.9, provider: 'clearbit' },
 *   employeeCount: { source: 'estimated_ai', confidence: 0.4, provider: 'llm' },
 *   fundingStage: { source: 'known_customer', confidence: 0.95, provider: 'user_upload' },
 *   ...
 * }
 */
export function buildFieldConfidence(
  financialProfile: CompanyFinancialProfile
): Record<string, FieldConfidenceEntry> {
  const entries: Record<string, FieldConfidenceEntry> = {};

  const fieldMap: Array<[string, FinancialDataPoint]> = [
    ['revenue', financialProfile.revenue],
    ['employeeCount', financialProfile.employees],
    ['funding', financialProfile.funding],
    ['marketCap', financialProfile.marketCap],
    ['growthRate', financialProfile.growthRate],
    ['valuation', financialProfile.valuation],
  ];

  for (const [fieldName, point] of fieldMap) {
    if (point.source !== 'unknown') {
      entries[fieldName] = {
        source: point.source,
        confidence: point.trust.confidence === 'high' ? 0.9
          : point.trust.confidence === 'medium' ? 0.6
          : 0.3,
        provider: point.provider,
        verifiedAt: point.verifiedAt,
        displayValue: point.displayValue,
      };
    }
  }

  return entries;
}

export interface FieldConfidenceEntry {
  source: FinancialDataSource;
  confidence: number;
  provider: string | null;
  verifiedAt: string | null;
  displayValue: string;
}

// ─── Financial Data Builders ─────────────────────────────────────

/**
 * Create a financial data point from verified API data.
 */
export function verifiedFinancialData(
  type: FinancialDataType,
  numericValue: number | null,
  displayValue: string,
  provider: string,
  currency?: string
): FinancialDataPoint {
  return {
    type,
    numericValue,
    displayValue,
    currency: currency || 'USD',
    source: 'known_verified',
    provider,
    verifiedAt: new Date().toISOString(),
    trust: verifiedApiTrust(type, provider, displayValue),
    rangeUpper: numericValue,
    rangeLower: numericValue,
  };
}

/**
 * Create a financial data point from customer-provided data.
 */
export function customerFinancialData(
  type: FinancialDataType,
  numericValue: number | null,
  displayValue: string,
  currency?: string
): FinancialDataPoint {
  return {
    type,
    numericValue,
    displayValue,
    currency: currency || 'USD',
    source: 'known_customer',
    provider: 'customer',
    verifiedAt: new Date().toISOString(),
    trust: customerDataTrust(type, displayValue),
    rangeUpper: numericValue,
    rangeLower: numericValue,
  };
}

/**
 * Create a financial data point from AI estimation.
 * MUST be clearly labeled as estimated — never presented as known.
 */
export function estimatedFinancialData(
  type: FinancialDataType,
  displayValue: string,
  reasoning: string,
  rangeLower?: number,
  rangeUpper?: number,
  provider?: string
): FinancialDataPoint {
  return {
    type,
    numericValue: null, // AI estimates are never treated as precise numbers
    displayValue,
    currency: null,
    source: 'estimated_ai',
    provider: provider || 'ai_estimation',
    verifiedAt: null, // Estimates are never "verified"
    trust: aiInferenceTrust(type, reasoning, 0, 'low'),
    rangeUpper: rangeUpper || null,
    rangeLower: rangeLower || null,
  };
}

/**
 * Create a financial data point inferred from signals.
 */
export function signalFinancialData(
  type: FinancialDataType,
  displayValue: string,
  reasoning: string,
  evidenceCount: number,
  rangeLower?: number,
  rangeUpper?: number
): FinancialDataPoint {
  return {
    type,
    numericValue: null,
    displayValue,
    currency: null,
    source: 'estimated_signal',
    provider: 'signal_inference',
    verifiedAt: null,
    trust: platformComputedTrust(
      type,
      reasoning,
      evidenceCount,
      evidenceCount >= 3 ? 'medium' : 'low'
    ),
    rangeUpper: rangeUpper || null,
    rangeLower: rangeLower || null,
  };
}

/**
 * Create an empty/unknown financial data point.
 */
export function unknownFinancialData(type: FinancialDataType): FinancialDataPoint {
  return {
    type,
    numericValue: null,
    displayValue: 'Unknown',
    currency: null,
    source: 'unknown',
    provider: null,
    verifiedAt: null,
    trust: {
      source: 'ai_inference',
      confidence: 'low',
      freshness: new Date().toISOString(),
      reasoning: `No ${type} data available for this company.`,
    },
    rangeUpper: null,
    rangeLower: null,
  };
}

// ─── Display Formatting ─────────────────────────────────────────

/**
 * Format a financial data point for executive display.
 * Shows the value with a source badge and confidence indicator.
 *
 * Examples:
 *   "$1.2B revenue [Verified: Clearbit]"
 *   "$10M-$50M [Estimated: AI]"
 *   "Unknown"
 */
export function formatFinancialForDisplay(point: FinancialDataPoint): string {
  if (point.source === 'unknown') return 'Unknown';

  const sourceLabel = getSourceLabel(point.source, point.provider);
  const confidenceIcon = point.trust.confidence === 'high' ? '✓'
    : point.trust.confidence === 'medium' ? '~'
    : '?';

  return `${point.displayValue} ${confidenceIcon} [${sourceLabel}]`;
}

function getSourceLabel(source: FinancialDataSource, provider: string | null): string {
  switch (source) {
    case 'known_verified': return `Verified: ${provider || 'API'}`;
    case 'known_customer': return 'Customer Data';
    case 'estimated_ai': return `Estimated: ${provider || 'AI'}`;
    case 'estimated_signal': return 'Inferred: Signals';
    case 'unknown': return 'Unknown';
  }
}

// ─── Profile Computation ────────────────────────────────────────

/**
 * Compute a complete financial profile from mixed sources.
 * Merges data from Clearbit, customer uploads, AI estimates, and signal inference.
 * Priority: verified > customer > signal > AI > unknown
 */
export function computeFinancialProfile(params: {
  companyId: string;
  companyName: string;

  // From Clearbit (or other verified API)
  clearbitRevenue?: number | null;
  clearbitRevenueRange?: string | null;
  clearbitEmployees?: number | null;
  clearbitEmployeesRange?: string | null;
  clearbitFunding?: number | null;
  clearbitMarketCap?: number | null;

  // From customer data
  customerRevenue?: string | null;
  customerEmployees?: string | null;
  customerFundingStage?: string | null;

  // From AI estimation (existing enrichment)
  aiEstimatedRevenue?: string | null;
  aiEstimatedEmployees?: string | null;
  aiEstimatedFundingStage?: string | null;

  // From signal inference
  signalBasedGrowthRate?: string | null;
  signalGrowthEvidence?: number;
}): CompanyFinancialProfile {
  // Revenue: priority = clearbit > customer > signal > ai
  let revenue: FinancialDataPoint;
  if (params.clearbitRevenue) {
    revenue = verifiedFinancialData('revenue', params.clearbitRevenue,
      formatCurrency(params.clearbitRevenue), 'clearbit');
  } else if (params.clearbitRevenueRange) {
    revenue = verifiedFinancialData('revenue', null,
      params.clearbitRevenueRange, 'clearbit');
  } else if (params.customerRevenue) {
    revenue = customerFinancialData('revenue', parseCurrencyString(params.customerRevenue),
      params.customerRevenue);
  } else if (params.aiEstimatedRevenue && params.aiEstimatedRevenue !== 'Unknown') {
    revenue = estimatedFinancialData('revenue', params.aiEstimatedRevenue,
      'AI-estimated from company name and industry context. No verified data available.');
  } else {
    revenue = unknownFinancialData('revenue');
  }

  // Employees: priority = clearbit > customer > ai
  let employees: FinancialDataPoint;
  if (params.clearbitEmployees) {
    employees = verifiedFinancialData('employees', params.clearbitEmployees,
      params.clearbitEmployees.toLocaleString(), 'clearbit');
  } else if (params.clearbitEmployeesRange) {
    employees = verifiedFinancialData('employees', null,
      params.clearbitEmployeesRange, 'clearbit');
  } else if (params.customerEmployees) {
    employees = customerFinancialData('employees',
      parseEmployeeString(params.customerEmployees), params.customerEmployees);
  } else if (params.aiEstimatedEmployees && params.aiEstimatedEmployees !== 'Unknown') {
    employees = estimatedFinancialData('employees', params.aiEstimatedEmployees,
      'AI-estimated from company name and industry context.');
  } else {
    employees = unknownFinancialData('employees');
  }

  // Funding: priority = clearbit > customer > ai
  let funding: FinancialDataPoint;
  if (params.clearbitFunding) {
    funding = verifiedFinancialData('funding', params.clearbitFunding,
      formatCurrency(params.clearbitFunding), 'clearbit');
  } else if (params.customerFundingStage && params.customerFundingStage !== 'Unknown') {
    funding = customerFinancialData('funding', null, params.customerFundingStage);
  } else if (params.aiEstimatedFundingStage && params.aiEstimatedFundingStage !== 'Unknown') {
    funding = estimatedFinancialData('funding', params.aiEstimatedFundingStage,
      'AI-estimated funding stage from company profile analysis.');
  } else {
    funding = unknownFinancialData('funding');
  }

  // Market Cap (only from verified sources)
  let marketCap: FinancialDataPoint;
  if (params.clearbitMarketCap) {
    marketCap = verifiedFinancialData('market_cap', params.clearbitMarketCap,
      formatCurrency(params.clearbitMarketCap), 'clearbit');
  } else {
    marketCap = unknownFinancialData('market_cap');
  }

  // Growth rate (only from signal inference)
  let growthRate: FinancialDataPoint;
  if (params.signalBasedGrowthRate) {
    growthRate = signalFinancialData('growth_rate', params.signalBasedGrowthRate,
      `Inferred from ${params.signalGrowthEvidence || 0} growth-related signals.`,
      params.signalGrowthEvidence || 0);
  } else {
    growthRate = unknownFinancialData('growth_rate');
  }

  // Valuation (no direct source — always unknown unless derived)
  const valuation = unknownFinancialData('valuation');

  // Compute composite metrics
  const allPoints = [revenue, employees, funding, marketCap, growthRate, valuation];
  const knownCount = allPoints.filter(p =>
    p.source === 'known_verified' || p.source === 'known_customer'
  ).length;
  const knownDataCoverage = Math.round((knownCount / allPoints.length) * 100);

  // Composite trust: weighted average of non-unknown fields
  const scoredPoints = allPoints.filter(p => p.source !== 'unknown');
  const compositeTrustScore = scoredPoints.length > 0
    ? Math.round(scoredPoints.reduce((sum, p) => sum + computeTrustScore(p.trust).score, 0) / scoredPoints.length)
    : 0;
  const compositeTrustGrade = compositeTrustScore >= 90 ? 'A+'
    : compositeTrustScore >= 80 ? 'A'
    : compositeTrustScore >= 65 ? 'B'
    : compositeTrustScore >= 50 ? 'C'
    : compositeTrustScore >= 35 ? 'D' : 'F';

  return {
    companyId: params.companyId,
    companyName: params.companyName,
    revenue,
    employees,
    funding,
    marketCap,
    growthRate,
    valuation,
    compositeTrustScore,
    compositeTrustGrade,
    knownDataCoverage,
    computedAt: new Date().toISOString(),
  };
}

// ─── Parsing Helpers ────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function parseCurrencyString(str: string): number | null {
  // Extract first number from strings like "$10M-$50M", "$1.2B", "$500K"
  const match = str.match(/\$?([\d.]+)\s*([BMK]|Billion|Million|Thousand)/i);
  if (!match) return null;

  const num = parseFloat(match[1]!);
  const unit = (match[2] || '').toUpperCase();

  if (unit.startsWith('B')) return num * 1_000_000_000;
  if (unit.startsWith('M')) return num * 1_000_000;
  if (unit.startsWith('K') || unit.startsWith('T')) return num * 1_000;
  return num;
}

function parseEmployeeString(str: string): number | null {
  // Extract from "1,000-5,000", "10000+", "51-200"
  const match = str.match(/([\d,]+)/);
  if (!match) return null;
  return parseInt(match[1]!.replace(/,/g, ''), 10);
}
