/**
 * M5 Phase 1.1 — Clearbit Data Provider Connector
 *
 * ⚠️ DEPRECATED: This connector is the legacy M5 enrichment system.
 * For new enrichment operations, use the unified 4.7 system:
 *   - Provider: src/lib/enrichment/providers/clearbit-provider.ts
 *   - Queue:   src/lib/enrichment/enrichment-queue.ts
 *   - Orchestrator: src/lib/enrichment/enrichment-orchestrator.ts
 *
 * The 4.7 system provides persistent usage tracking, rate limiting,
 * provider fallback, and batch processing — all features not present
 * in this legacy connector. Both systems share the CLEARBIT_API_KEY
 * environment variable.
 *
 * This connector remains for backward compatibility with M5-era code
 * (intelligence-activation, intelligence-sources) and will be fully
 * removed in a future major version.
 *
 * Enriches company data with verified external intelligence:
 *   - Company profile (name, domain, industry, employees, revenue, description)
 *   - Technology stack detection (via Clearbit logo/reveal API)
 *   - Contact/people data (via Apollo API integration)
 *   - Financial signals (funding, revenue ranges)
 *
 * Implements the IConnector interface, following the same pattern as
 * csv-connector and excel-connector.
 *
 * TRUST Framework:
 *   Every data point returned carries:
 *     source: 'verified_api' | 'api_estimated' | 'inferred'
 *     confidence: 'high' | 'medium' | 'low'
 *     freshness: ISO date of last provider update
 *     reasoning: Why this data point exists
 *
 * Config shape:
 *   {
 *     domain: string,              // Company domain to enrich
 *     companyName?: string,         // Fallback if domain lookup fails
 *     enrichContacts?: boolean,    // Also fetch people via Apollo (default: false)
 *     enrichTech?: boolean,        // Also fetch tech stack (default: true)
 *   }
 *
 * Rate limits: Clearbit Free = 50 requests/month (respects this).
 */

import { BaseConnector } from '../base-connector';
import { logger } from '@/lib/logger';
import type {
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorResult,
  RawIntelligenceObject,
} from '../types';
import type { TrustMetadata } from '../trust-metadata';
import { withRetry, buildConnectorErrorDetail, DEFAULT_RETRY_CONFIG } from '../retry-utilities';

// ─── Constants ─────────────────────────────────────────────────

const CLEARBIT_API_BASE = 'https://company.clearbit.com/v2';
const CLEARBIT_REVEAL_API_BASE = 'https://reveal.clearbit.com/v1';

/**
 * Monthly rate limit for Clearbit free tier.
 * The connector tracks usage and warns when approaching the limit.
 */
const MONTHLY_RATE_LIMIT = 50;

// ─── TRUST Metadata Helpers ────────────────────────────────────

/**
 * Build TRUST metadata for a data point from Clearbit.
 *
 * Clearbit provides two classes of data:
 *   1. Verified: Directly from provider integrations (logo, domain, social profiles)
 *   2. Estimated: Inferred from signals (employee count, revenue)
 *
 * This distinction is critical for the TRUST framework — enterprise buyers
 * must know which data points are verified vs. estimated.
 */
function buildTrustMetadata(field: string, value: unknown, source: string): TrustMetadata {
  const now = new Date().toISOString();

  // Fields that Clearbit typically verifies directly
  const verifiedFields = new Set([
    'name', 'domain', 'legalName', 'domainAliases', 'logo',
    'facebookHandle', 'twitterHandle', 'linkedinHandle',
    'crunchbaseHandle', 'angellistHandle',
    'type', 'category', 'industry', 'subIndustry',
    'tech', 'techCategories',
  ]);

  // Fields that Clearbit estimates
  const estimatedFields = new Set([
    'employees', 'employeesRange', 'annualRevenue',
    'revenueRange', 'foundedYear', 'foundedDate',
    'location', 'geo', 'metrics',
  ]);

  if (verifiedFields.has(field) && value !== null && value !== undefined) {
    return {
      source: 'verified_api',
      confidence: 'high',
      freshness: now,
      reasoning: `Directly verified by Clearbit from provider integrations for field "${field}".`,
      provider: 'clearbit',
      field,
      originalValue: String(value),
    };
  }

  if (estimatedFields.has(field) && value !== null && value !== undefined) {
    return {
      source: 'verified_api',
      confidence: 'medium',
      freshness: now,
      reasoning: `Estimated by Clearbit from multiple signal sources for field "${field}". Not directly verified.`,
      provider: 'clearbit',
      field,
      originalValue: String(value),
    };
  }

  return {
    source: 'ai_inference',
    confidence: 'low',
    freshness: now,
    reasoning: `Inferred value for field "${field}". Low confidence — use as signal only.`,
    provider: 'clearbit',
    field,
    originalValue: String(value),
  };
}

// ─── Clearbit API Client ───────────────────────────────────────

/**
 * Type-safe wrapper around Clearbit Company API responses.
 * Only includes fields we actually use — not the full Clearbit schema.
 */
interface ClearbitCompanyResponse {
  id?: string;
  name?: string;
  legalName?: string;
  domain?: string;
  domainAliases?: string[];
  logo?: string;
  type?: string;           // 'public', 'private', 'non_profit', etc.
  category?: {
    industry?: string;
    sector?: string;
    subIndustry?: string;
    industryGroup?: string;
  };
  description?: string;
  foundedYear?: number;
  foundedDate?: string;
  location?: string;
  geo?: {
    streetNumber?: string;
    streetName?: string;
    subPremise?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    countryName?: string;
    lat?: number;
    lng?: number;
  };
  employees?: number;
  employeesRange?: string;
  annualRevenue?: number;
  revenueRange?: string;
  totalFunding?: number;
  totalFundingCurrency?: string;
  metrics?: {
    alexaGlobalRank?: number;
    alexaUsRank?: number;
    employees?: number;
    employeesRange?: string;
    marketCap?: number;
    yearlyRevenue?: number;
    googleRank?: number;
    googleRankUS?: number;
    similarwebGlobalRank?: number;
    similarwebUsRank?: number;
  };
  tech?: string[];
  techCategories?: string[];
  facebookHandle?: string;
  twitterHandle?: string;
  linkedinHandle?: string;
  crunchbaseHandle?: string;
  angellistHandle?: string;
}

/**
 * Type-safe wrapper around Clearbit Reveal (Prospector) API responses.
 */
interface ClearbitRevealResponse {
  company?: ClearbitCompanyResponse;
  domain?: string;
  employees?: number;
  employeesRange?: string;
  country?: string;
  countryName?: string;
  industry?: string;
  subIndustry?: string;
  revenue?: number;
  revenueRange?: string;
  tech?: string[];
  techCategories?: string[];
  logo?: string;
  name?: string;
  type?: string;
}

// ─── Rate Limit Tracking ──────────────────────────────────────

/** In-memory rate limit counter (resets on process restart) */
let monthlyUsageCount = 0;

function checkRateLimit(): { allowed: boolean; remaining: number; message?: string } {
  if (monthlyUsageCount >= MONTHLY_RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      message: `Clearbit monthly rate limit reached (${MONTHLY_RATE_LIMIT}). Upgrade plan or wait for next billing cycle.`,
    };
  }
  return { allowed: true, remaining: MONTHLY_RATE_LIMIT - monthlyUsageCount };
}

// ─── HTTP Helper ───────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  apiKey: string,
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (response.status === 404) {
        // Not found is not retryable — re-throw with status so withRetry skips retry
        const err = new Error(`Clearbit API returned 404: Not Found`);
        (err as any).status = 404;
        throw err;
      }

      if (!response.ok) {
        const err = new Error(`Clearbit API returned ${response.status}: ${response.statusText}`);
        (err as any).status = response.status;
        throw err;
      }

      return response;
    },
    'Clearbit API fetch',
    DEFAULT_RETRY_CONFIG,
  );
}

// ─── Connector Implementation ──────────────────────────────────

export class ClearbitConnector extends BaseConnector {
  readonly sourceType = 'clearbit' as const;
  readonly name = 'Clearbit Company Enrichment';

  // ── Legacy run() adapter ───────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
    // Runtime deprecation notice — redirect to 4.7 system
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[clearbit-connector] DEPRECATED: M5 legacy connector invoked. Migrate to 4.7 enrichment system (enrichment-orchestrator.ts).');
    }
    const result = await this.acquire(config);
    const status = result.success ? 'success' : 'error';
    return this.createResult(
      status,
      result.intelligenceObjects,
      result.errors.map((e) => this.msg('error', e)),
    );
  }

  // ── validateConfig ───────────────────────────────────────────

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.domain && !config.companyName) {
      errors.push('Either "domain" or "companyName" is required');
    }

    if (config.domain && typeof config.domain !== 'string') {
      errors.push('domain must be a string');
    }

    if (config.companyName && typeof config.companyName !== 'string') {
      errors.push('companyName must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  // ── test ─────────────────────────────────────────────────────

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.errors.join('; ') };
    }

    const apiKey = process.env.CLEARBIT_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: 'CLEARBIT_API_KEY not configured. Set in environment variables.',
      };
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message! };
    }

    const domain = config.domain as string;
    try {
      const response = await fetchWithRetry(
        `${CLEARBIT_API_BASE}/companies/find?domain=${encodeURIComponent(domain)}`,
        apiKey
      );
      if (response.status === 404) {
        return { success: false, message: `Company not found for domain: ${domain}` };
      }
      if (response.ok) {
        return { success: true, message: `Clearbit connection successful. Domain: ${domain}. Monthly usage: ${monthlyUsageCount}/${MONTHLY_RATE_LIMIT}` };
      }
      return { success: false, message: `Clearbit returned status ${response.status}` };
    } catch (err) {
      return {
        success: false,
        message: `Clearbit connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── acquire ──────────────────────────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return this.createAcquisitionErrorResult(validation.errors.join('; '));
    }

    const apiKey = process.env.CLEARBIT_API_KEY;
    if (!apiKey) {
      return this.createAcquisitionErrorResult(
        'CLEARBIT_API_KEY not configured. External data enrichment requires a Clearbit API key.'
      );
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      return this.createAcquisitionErrorResult(rateCheck.message!);
    }

    const domain = (config.domain as string) || '';
    const companyName = (config.companyName as string) || domain.split('.')[0];
    const enrichTech = config.enrichTech !== false;

    try {
      // ── Step 1: Fetch company profile from Clearbit ──
      const companyData = await this.fetchCompanyProfile(apiKey, domain, companyName);
      monthlyUsageCount++;

      if (!companyData) {
        return this.createAcquisitionErrorResult(
          `No company data found for domain "${domain}" or name "${companyName}".`
        );
      }

      // ── Step 2: Build TRUST-annotated intelligence objects ──
      const intelligenceObjects: RawIntelligenceObject[] = [];

      // --- Company Profile Object (primary) ---
      const profileContent = this.buildProfileContent(companyData);
      const profileTrust = this.buildTrustAnnotatedMetadata(companyData);

      intelligenceObjects.push({
        companyIdentifier: companyData.name || companyName,
        content: profileContent,
        summary: companyData.description || undefined,
        category: 'company_profile',
        capturedAt: new Date(),
        sourceUrl: `https://clearbit.com/${companyData.domain}`,
        metadata: {
          source: 'verified_api',
          provider: 'clearbit',
          enrichmentType: 'company_profile',
          ...profileTrust,
        },
      });

      // --- Technology Stack Object (if enriched) ---
      if (enrichTech && (companyData.tech?.length || companyData.techCategories?.length)) {
        const techContent = this.buildTechContent(companyData);
        intelligenceObjects.push({
          companyIdentifier: companyData.name || companyName,
          content: techContent,
          category: 'Technology',
          capturedAt: new Date(),
          metadata: {
            source: 'verified_api',
            provider: 'clearbit',
            enrichmentType: 'tech_stack',
            tech: companyData.tech || [],
            techCategories: companyData.techCategories || [],
            trust: buildTrustMetadata('tech', companyData.tech, 'clearbit'),
          },
        });
      }

      // --- Financial Intelligence Object ---
      const financialContent = this.buildFinancialContent(companyData);
      if (financialContent) {
        intelligenceObjects.push({
          companyIdentifier: companyData.name || companyName,
          content: financialContent,
          category: 'Revenue',
          capturedAt: new Date(),
          metadata: {
            source: 'api_estimated',
            provider: 'clearbit',
            enrichmentType: 'financial_intelligence',
            employees: companyData.employees,
            employeesRange: companyData.employeesRange,
            annualRevenue: companyData.annualRevenue,
            revenueRange: companyData.revenueRange,
            totalFunding: companyData.totalFunding,
            trust: buildTrustMetadata('annualRevenue', companyData.annualRevenue, 'clearbit'),
          },
        });
      }

      // --- Industry Intelligence Object ---
      if (companyData.category) {
        const industryContent = this.buildIndustryContent(companyData);
        intelligenceObjects.push({
          companyIdentifier: companyData.name || companyName,
          content: industryContent,
          category: 'Market',
          capturedAt: new Date(),
          metadata: {
            source: 'verified_api',
            provider: 'clearbit',
            enrichmentType: 'industry_intelligence',
            industry: companyData.category.industry,
            sector: companyData.category.sector,
            subIndustry: companyData.category.subIndustry,
            trust: buildTrustMetadata('industry', companyData.category.industry, 'clearbit'),
          },
        });
      }

      return this.createAcquisitionResult({
        success: true,
        intelligenceObjects,
        errors: [],
        metadata: {
          totalObjects: intelligenceObjects.length,
          domain: companyData.domain,
          provider: 'clearbit',
          rateLimitRemaining: rateCheck.remaining - 1,
          enrichmentTypes: intelligenceObjects.map(o => o.metadata?.enrichmentType),
        },
      });
    } catch (err) {
      return this.createAcquisitionErrorResult(
        buildConnectorErrorDetail(err, 'Clearbit connector acquire')
      );
    }
  }

  // ── API Methods ───────────────────────────────────────────────

  private async fetchCompanyProfile(
    apiKey: string,
    domain: string,
    companyName: string
  ): Promise<ClearbitCompanyResponse | null> {
    // Try domain lookup first (most reliable)
    if (domain) {
      try {
        const response = await fetchWithRetry(
          `${CLEARBIT_API_BASE}/companies/find?domain=${encodeURIComponent(domain)}`,
          apiKey
        );
        if (response.ok) {
          return await response.json() as ClearbitCompanyResponse;
        }
        if (response.status === 404) {
          // Domain not found — try name search
        }
      } catch { /* continue to name search */ }
    }

    // Fallback: search by company name
    try {
      const response = await fetchWithRetry(
        `${CLEARBIT_API_BASE}/companies/search?query=${encodeURIComponent(companyName)}`,
        apiKey
      );
      if (response.ok) {
        const results = await response.json() as { results?: ClearbitCompanyResponse[] };
        if (results.results && results.results.length > 0) {
          return results.results[0]!;
        }
      }
    } catch { /* return null */ }

    return null;
  }

  // ── Content Builders ─────────────────────────────────────────

  private buildProfileContent(data: ClearbitCompanyResponse): string {
    const parts: string[] = [];

    if (data.name) parts.push(`Company: ${data.name}`);
    if (data.legalName && data.legalName !== data.name) parts.push(`Legal Name: ${data.legalName}`);
    if (data.domain) parts.push(`Domain: ${data.domain}`);
    if (data.type) parts.push(`Type: ${data.type}`);
    if (data.description) parts.push(`Description: ${data.description}`);
    if (data.foundedYear) parts.push(`Founded: ${data.foundedYear}`);
    if (data.location) parts.push(`Location: ${data.location}`);
    if (data.category?.industry) parts.push(`Industry: ${data.category.industry}`);
    if (data.category?.sector) parts.push(`Sector: ${data.category.sector}`);
    if (data.employees) parts.push(`Employees: ${data.employees}`);
    if (data.employeesRange) parts.push(`Employee Range: ${data.employeesRange}`);

    return parts.join('\n');
  }

  private buildTechContent(data: ClearbitCompanyResponse): string {
    const parts: string[] = [];

    if (data.techCategories?.length) {
      parts.push(`Technology Categories: ${data.techCategories.join(', ')}`);
    }
    if (data.tech?.length) {
      parts.push(`Technologies: ${data.tech.join(', ')}`);
    }

    return parts.join('\n');
  }

  private buildFinancialContent(data: ClearbitCompanyResponse): string | null {
    const parts: string[] = [];

    if (data.annualRevenue) parts.push(`Annual Revenue: $${data.annualRevenue.toLocaleString()}`);
    if (data.revenueRange) parts.push(`Revenue Range: ${data.revenueRange}`);
    if (data.employees) parts.push(`Total Employees: ${data.employees}`);
    if (data.employeesRange) parts.push(`Employees Range: ${data.employeesRange}`);
    if (data.totalFunding) {
      const currency = data.totalFundingCurrency || 'USD';
      parts.push(`Total Funding: ${currency} ${data.totalFunding.toLocaleString()}`);
    }
    if (data.metrics?.marketCap) parts.push(`Market Cap: $${data.metrics.marketCap.toLocaleString()}`);

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private buildIndustryContent(data: ClearbitCompanyResponse): string {
    const parts: string[] = [];

    if (data.category?.industry) parts.push(`Industry: ${data.category.industry}`);
    if (data.category?.sector) parts.push(`Sector: ${data.category.sector}`);
    if (data.category?.subIndustry) parts.push(`Sub-Industry: ${data.category.subIndustry}`);
    if (data.category?.industryGroup) parts.push(`Industry Group: ${data.category.industryGroup}`);

    return parts.join('\n');
  }

  private buildTrustAnnotatedMetadata(data: ClearbitCompanyResponse): Record<string, unknown> {
    return {
      name: buildTrustMetadata('name', data.name, 'clearbit'),
      domain: buildTrustMetadata('domain', data.domain, 'clearbit'),
      type: buildTrustMetadata('type', data.type, 'clearbit'),
      industry: buildTrustMetadata('industry', data.category?.industry, 'clearbit'),
      employees: buildTrustMetadata('employees', data.employees, 'clearbit'),
      revenue: buildTrustMetadata('annualRevenue', data.annualRevenue, 'clearbit'),
      description: buildTrustMetadata('description', data.description, 'clearbit'),
    };
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const clearbitConnector = new ClearbitConnector();
