/**
 * Task 4.7 — Apollo Enrichment Provider
 *
 * Contact enrichment via Apollo.io API.
 * Uses https://api.apollo.io/v1/people/match endpoint.
 * Maps Apollo response → ContactEnrichmentResult.
 */

import type {
  EnrichmentProvider,
  EnrichmentResult,
  ContactEnrichmentResult,
} from '../enrichment-provider';
import { logger } from '@/lib/logger';

// ─── Configuration ────────────────────────────────────────────────────

const APOLLO_PEOPLE_MATCH_URL =
  process.env.APOLLO_PEOPLE_MATCH_URL || 'https://api.apollo.io/v1/people/match';

const APOLLO_ORG_ENRICH_URL =
  process.env.APOLLO_ORG_ENRICH_URL || 'https://api.apollo.io/v1/organizations/enrich';

const APOLLO_REQUEST_TIMEOUT_MS = 15000;

// ─── Apollo Response Types ────────────────────────────────────────────

interface ApolloPersonResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    title?: string;
    linkedin_url?: string;
    organization?: string;
    seniority?: string;
    department?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface ApolloOrgResponse {
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    industry?: string;
    num_employees?: string;
    annual_revenue?: number;
    linkedin_url?: string;
    twitter_url?: string;
    description?: string;
    logo_url?: string;
    city?: string;
    state?: string;
    country?: string;
    technologies?: string[];
    founded_year?: number;
  };
}

// ─── Provider Implementation ──────────────────────────────────────────

export class ApolloProvider implements EnrichmentProvider {
  readonly id = 'apollo';
  readonly name = 'Apollo';
  readonly type = 'apollo' as const;
  readonly priority = 2;

  private getApiKey(): string | null {
    return process.env.APOLLO_API_KEY || null;
  }

  async isAvailable(): Promise<boolean> {
 return !!this.getApiKey();
  }

  async getRemainingCredits(): Promise<number> {
    // Apollo has a generous free tier; we don't track precisely.
    // Return -1 to indicate "unknown / unlimited".
    return -1;
  }

  // ─── Contact Enrichment ────────────────────────────────────────────

  async enrichContact(email: string): Promise<ContactEnrichmentResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    const response = await fetch(APOLLO_PEOPLE_MATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(APOLLO_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Apollo API returned ${response.status}: ${response.statusText}`);
    }

    const raw = (await response.json()) as ApolloPersonResponse;

    logger.info('[apollo-provider] Contact enrichment success', {
      email,
      name: raw.person?.name,
    });

    return this.mapContactResponse(raw);
  }

  // ─── Company Enrichment ────────────────────────────────────────────

  async enrichCompany(domain: string): Promise<EnrichmentResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('APOLLO_API_KEY not configured');
    }

    const response = await fetch(APOLLO_ORG_ENRICH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
      },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(APOLLO_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Apollo API returned ${response.status}: ${response.statusText}`);
    }

    const raw = (await response.json()) as ApolloOrgResponse;

    logger.info('[apollo-provider] Company enrichment success', {
      domain,
      name: raw.organization?.name,
    });

    return this.mapCompanyResponse(raw);
  }

  // ─── Response Mapping ─────────────────────────────────────────────

  private mapContactResponse(raw: ApolloPersonResponse): ContactEnrichmentResult {
    const p = raw.person;
    if (!p) {
      return {
        provider: this.id,
        confidence: 0,
        data: {},
        rawResponse: raw,
        creditsUsed: 1,
      };
    }

    const fields = [p.name, p.email, p.title, p.linkedin_url, p.seniority];
    const filledCount = fields.filter(Boolean).length;
    const confidence = Math.min(filledCount / fields.length, 1);

    const location = [p.city, p.state, p.country].filter(Boolean).join(', ') || undefined;

    return {
      provider: this.id,
      confidence,
      data: {
        fullName: p.name || undefined,
        email: p.email || undefined,
        title: p.title || undefined,
        company: p.organization || undefined,
        linkedin: p.linkedin_url || undefined,
        seniority: p.seniority || undefined,
        department: p.department || undefined,
        location,
      },
      rawResponse: raw,
      creditsUsed: 1,
    };
  }

  private mapCompanyResponse(raw: ApolloOrgResponse): EnrichmentResult {
    const org = raw.organization;
    if (!org) {
      return {
        provider: this.id,
        confidence: 0,
        data: {},
        rawResponse: raw,
        creditsUsed: 1,
      };
    }

    const fields = [
      org.name, org.website_url, org.industry, org.num_employees,
      org.description, org.technologies,
    ];
    const filledCount = fields.filter(Boolean).length;
    const confidence = Math.min(filledCount / fields.length, 1);

    const location = [org.city, org.state, org.country].filter(Boolean).join(', ') || undefined;

    // Parse employee count (Apollo returns string like "1-10", "51-200")
    let employeeCount: number | undefined;
    if (org.num_employees) {
      const match = org.num_employees.match(/(\d+)/);
      if (match) employeeCount = parseInt(match[1]!, 10);
    }

    return {
      provider: this.id,
      confidence,
      data: {
        name: org.name || undefined,
        domain: org.website_url || undefined,
        industry: org.industry || undefined,
        employees: employeeCount,
        revenue: org.annual_revenue || undefined,
        linkedin: org.linkedin_url || undefined,
        twitter: org.twitter_url || undefined,
        description: org.description || undefined,
        logo: org.logo_url || undefined,
        location,
        technologies: org.technologies?.length ? org.technologies : undefined,
        foundedYear: org.founded_year || undefined,
      },
      rawResponse: raw,
      creditsUsed: 1,
    };
  }
}

export const apolloProvider = new ApolloProvider();
