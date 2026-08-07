/**
 * Task 4.7 — Clearbit Enrichment Provider
 *
 * Wraps the existing Clearbit Company API with the unified EnrichmentProvider interface.
 * Uses https://company.clearbit.com/v2/companies/find?domain= for company lookups.
 * Tracks credit usage and maps responses to EnrichmentResult.
 */

import type {
  EnrichmentProvider,
  EnrichmentResult,
  ContactEnrichmentResult,
} from '../enrichment-provider';
import { logger } from '@/lib/logger';

// ─── Configuration ────────────────────────────────────────────────────

const CLEARBIT_COMPANY_API =
  process.env.CLEARBIT_COMPANY_API_URL || 'https://company.clearbit.com/v2/companies/find';

const CLEARBIT_MONTHLY_LIMIT = 50;
const CLEARBIT_REQUEST_TIMEOUT_MS = 15000;

// ─── Internal State ───────────────────────────────────────────────────

let monthlyUsageCount = 0;

// ─── Clearbit Response Types ──────────────────────────────────────────

interface ClearbitCompanyResponse {
  id?: string;
  name?: string;
  legalName?: string;
  domain?: string;
  logo?: string;
  type?: string;
  category?: {
    industry?: string;
    sector?: string;
    subIndustry?: string;
  };
  description?: string;
  foundedYear?: number;
  location?: string;
  employees?: number;
  annualRevenue?: number;
  metrics?: {
    alexaGlobalRank?: number;
  };
  tech?: string[];
  twitterHandle?: string;
  linkedinHandle?: string;
}

// ─── Provider Implementation ──────────────────────────────────────────

export class ClearbitProvider implements EnrichmentProvider {
  readonly id = 'clearbit';
  readonly name = 'Clearbit';
  readonly type = 'clearbit' as const;
  readonly priority = 1; // highest priority

  private getApiKey(): string | null {
    return process.env.CLEARBIT_API_KEY || null;
  }

  async isAvailable(): Promise<boolean> {
    const key = this.getApiKey();
    if (!key) return false;
    if (monthlyUsageCount >= CLEARBIT_MONTHLY_LIMIT) return false;
    return true;
  }

  async getRemainingCredits(): Promise<number> {
    return Math.max(0, CLEARBIT_MONTHLY_LIMIT - monthlyUsageCount);
  }

  async enrichCompany(domain: string): Promise<EnrichmentResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('CLEARBIT_API_KEY not configured');
    }

    if (monthlyUsageCount >= CLEARBIT_MONTHLY_LIMIT) {
      throw new Error('Clearbit monthly rate limit reached');
    }

    const url = `${CLEARBIT_COMPANY_API}?domain=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
      },
      signal: AbortSignal.timeout(CLEARBIT_REQUEST_TIMEOUT_MS),
    });

    monthlyUsageCount++;

    if (response.status === 404) {
      return {
        provider: this.id,
        confidence: 0,
        data: {},
        creditsUsed: 1,
      };
    }

    if (!response.ok) {
      throw new Error(`Clearbit API returned ${response.status}: ${response.statusText}`);
    }

    const raw = (await response.json()) as ClearbitCompanyResponse;

    logger.info('[clearbit-provider] Company enrichment success', {
      domain,
      name: raw.name,
    });

    return this.mapCompanyResponse(raw);
  }

  async enrichContact(_email: string): Promise<ContactEnrichmentResult> {
    // Clearbit does not offer contact-level enrichment.
    // This provider only supports company enrichment.
    throw new Error('Clearbit does not support contact enrichment. Use Apollo or ProxyCurl provider.');
  }

  // ─── Response Mapping ─────────────────────────────────────────────

  private mapCompanyResponse(raw: ClearbitCompanyResponse): EnrichmentResult {
    // Confidence based on data completeness
    const fields = [
      raw.name, raw.domain, raw.category?.industry, raw.employees,
      raw.description, raw.location, raw.tech,
    ];
    const filledCount = fields.filter(Boolean).length;
    const confidence = Math.min(filledCount / fields.length, 1);

    return {
      provider: this.id,
      confidence,
      data: {
        name: raw.name || undefined,
        domain: raw.domain || undefined,
        industry: raw.category?.industry || undefined,
        employees: raw.employees || undefined,
        revenue: raw.annualRevenue || undefined,
        linkedin: raw.linkedinHandle
          ? `https://linkedin.com/company/${raw.linkedinHandle}`
          : undefined,
        twitter: raw.twitterHandle
          ? `https://twitter.com/${raw.twitterHandle}`
          : undefined,
        description: raw.description || undefined,
        logo: raw.logo || undefined,
        location: raw.location || undefined,
        technologies: raw.tech?.length ? raw.tech : undefined,
        foundedYear: raw.foundedYear || undefined,
        alexaRank: raw.metrics?.alexaGlobalRank || undefined,
      },
      rawResponse: raw as unknown,
      creditsUsed: 1,
    };
  }
}

export const clearbitProvider = new ClearbitProvider();
