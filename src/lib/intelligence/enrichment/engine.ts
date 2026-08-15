// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Entity Enrichment Engine
//
// Enriches entity data from external providers (Clearbit, Apollo).
// Falls back gracefully when API keys are not configured.
// Uses web search as a universal fallback.
//
// Pipeline: Entity → Provider Lookup → Data Merge → Update
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { webSearch } from '@/lib/llm-client';

// ─── Types ───────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  organizationId: string;
  provider: string;
  fieldsUpdated: string[];
  confidence: number;
  error?: string;
}

export interface EnrichmentConfig {
  providers: ('clearbit' | 'apollo' | 'web_search')[];
  maxRequestsPerBatch: number;
  skipIfExists: boolean;
}

// ─── Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG: EnrichmentConfig = {
  providers: ['web_search'],
  maxRequestsPerBatch: 10,
  skipIfExists: true,
};

// ─── Main Enrichment ────────────────────────────────────────────────────

/**
 * Enrich a single organization using available providers.
 * Tries each provider in order, merges results, updates the DB record.
 */
export async function enrichOrganization(
  orgId: string,
  config: Partial<EnrichmentConfig> = {},
): Promise<EnrichmentResult | null> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const correlationId = crypto.randomUUID();

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    logger.warn('[ENRICH] Organization not found', { orgId, correlationId });
    return null;
  }

  // Skip if recently enriched (within 7 days)
  if (org.lastEnrichedAt) {
    const daysSinceEnrichment = (Date.now() - org.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEnrichment < 7) {
      logger.debug('[ENRICH] Skipping recently enriched org', {
        orgId,
        daysSinceEnrichment: Math.round(daysSinceEnrichment * 10) / 10,
        correlationId,
      });
      return null;
    }
  }

  let fieldsUpdated: string[] = [];
  let bestProvider = 'none';
  let bestConfidence = 0;

  // Determine available providers based on API keys
  const availableProviders: string[] = [];
  if (process.env.CLEARBIT_API_KEY) availableProviders.push('clearbit');
  if (process.env.APOLLO_API_KEY) availableProviders.push('apollo');
  availableProviders.push('web_search');

  for (const provider of availableProviders) {
    try {
      let enrichment: Record<string, unknown> | null = null;
      let confidence = 0;

      switch (provider) {
        case 'clearbit':
          ({ data: enrichment, confidence } = await enrichViaClearbit(org));
          break;
        case 'apollo':
          ({ data: enrichment, confidence } = await enrichViaApollo(org));
          break;
        case 'web_search':
          ({ data: enrichment, confidence } = await enrichViaWebSearch(org));
          break;
      }

      if (enrichment && Object.keys(enrichment).length > 0) {
        const updated = await mergeEnrichmentData(
          orgId,
          enrichment,
          org,
          mergedConfig.skipIfExists,
        );
        fieldsUpdated = [...new Set([...fieldsUpdated, ...updated])];
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestProvider = provider;
        }
        logger.info('[ENRICH] Provider returned data', {
          orgId,
          provider,
          fieldsFound: Object.keys(enrichment),
          confidence,
          correlationId,
        });
      }
    } catch (error) {
      logger.warn('[ENRICH] Provider failed, trying next', {
        orgId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown',
        correlationId,
      });
    }
  }

  if (fieldsUpdated.length === 0) {
    logger.info('[ENRICH] No new data found from any provider', { orgId, correlationId });
    await db.organization.update({
      where: { id: orgId },
      data: { lastEnrichedAt: new Date() },
    });
    return null;
  }

  await db.organization.update({
    where: { id: orgId },
    data: {
      lastEnrichedAt: new Date(),
      source: 'external',
    },
  });

  logger.info('[ENRICH] Organization enriched successfully', {
    orgId,
    provider: bestProvider,
    fieldsUpdated,
    confidence: bestConfidence,
    correlationId,
  });

  return {
    organizationId: orgId,
    provider: bestProvider,
    fieldsUpdated,
    confidence: bestConfidence,
  };
}

// ─── Clearbit Provider ─────────────────────────────────────────────────

async function enrichViaClearbit(org: {
  domain?: string | null;
  name: string;
}): Promise<{ data: Record<string, unknown>; confidence: number }> {
  const domain = org.domain || inferDomain(org.name);
  if (!domain) return { data: {}, confidence: 0 };

  const apiKey = process.env.CLEARBIT_API_KEY;
  if (!apiKey) return { data: {}, confidence: 0 };

  try {
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      logger.warn('[ENRICH-CLEARBIT] API error', { status: response.status, domain });
      return { data: {}, confidence: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json();

    const data: Record<string, unknown> = {};
    if (json.name) data.name = json.name;
    if (json.description) data.description = json.description;
    if (json.category?.industry) data.industry = json.category.industry;
    if (json.metrics?.employees) data.employeeCount = json.metrics.employees;
    if (json.metrics?.annualRevenue) data.revenue = String(json.metrics.annualRevenue);
    if (json.foundedYear) data.foundedYear = json.foundedYear;
    if (json.headquarters) data.headquarters = json.headquarters;
    if (json.domain) data.website = `https://${json.domain}`;

    return { data, confidence: json.name ? 85 : 60 };
  } catch (error) {
    logger.warn('[ENRICH-CLEARBIT] Request failed', {
      domain,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { data: {}, confidence: 0 };
  }
}

// ─── Apollo Provider ────────────────────────────────────────────────────

async function enrichViaApollo(org: {
  domain?: string | null;
  name: string;
}): Promise<{ data: Record<string, unknown>; confidence: number }> {
  const domain = org.domain || inferDomain(org.name);
  if (!domain) return { data: {}, confidence: 0 };

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { data: {}, confidence: 0 };

  try {
    const response = await fetch('https://api.apollo.io/v1/organizations/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ organization_domains: [domain] }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn('[ENRICH-APOLLO] API error', { status: response.status, domain });
      return { data: {}, confidence: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json();
    const orgData = json?.organizations?.[0];
    if (!orgData) return { data: {}, confidence: 0 };

    const data: Record<string, unknown> = {};
    if (orgData.name) data.name = orgData.name;
    if (orgData.description) data.description = orgData.description;
    if (orgData.industry) data.industry = orgData.industry;
    if (orgData.employees) data.employeeCount = orgData.employees;
    if (orgData.revenue) data.revenue = String(orgData.revenue);
    if (orgData.founded_year) data.foundedYear = orgData.founded_year;
    if (orgData.headquarters) data.headquarters = orgData.headquarters;
    if (orgData.website_url) data.website = orgData.website_url;

    return { data, confidence: orgData.name ? 85 : 60 };
  } catch (error) {
    logger.warn('[ENRICH-APOLLO] Request failed', {
      domain,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { data: {}, confidence: 0 };
  }
}

// ─── Web Search Fallback ───────────────────────────────────────────────

async function enrichViaWebSearch(org: {
  domain?: string | null;
  name: string;
}): Promise<{ data: Record<string, unknown>; confidence: number }> {
  const query = org.domain
    ? `${org.name} company info site:${org.domain}`
    : `${org.name} company industry employees revenue headquarters`;

  try {
    const results = await webSearch(query, 5);
    if (!results || results.length === 0) return { data: {}, confidence: 0 };

    const data: Record<string, unknown> = {};
    for (const result of results) {
      const snippet = (result.snippet || '').toLowerCase();

      const industryMatch = snippet.match(/industry[:\s]+([a-z\s,&]+)/i);
      if (industryMatch && !data.industry) data.industry = industryMatch[1].trim();

      const employeeMatch = snippet.match(/(\d[\d,]*)\s*employees/i);
      if (employeeMatch && !data.employeeCount) {
        data.employeeCount = parseInt(employeeMatch[1].replace(/,/g, ''), 10);
      }

      const hqMatch = snippet.match(/headquarters\s+in\s+([a-z\s,]+)/i);
      if (hqMatch && !data.headquarters) data.headquarters = hqMatch[1].trim();

      if (!data.description && result.snippet) {
        data.description = result.snippet;
      }
    }

    return { data, confidence: Object.keys(data).length > 2 ? 50 : 30 };
  } catch (error) {
    logger.warn('[ENRICH-SEARCH] Web search failed', {
      query,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { data: {}, confidence: 0 };
  }
}

// ─── Data Merge ─────────────────────────────────────────────────────────

async function mergeEnrichmentData(
  orgId: string,
  enrichment: Record<string, unknown>,
  existing: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    description?: string | null;
    employeeCount?: number | null;
    revenue?: string | null;
    headquarters?: string | null;
    foundedYear?: number | null;
  },
  skipIfExists: boolean,
): Promise<string[]> {
  const updateData: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];

  if (enrichment.industry && (!existing.industry || !skipIfExists)) {
    updateData.industry = String(enrichment.industry);
    fieldsUpdated.push('industry');
  }
  if (enrichment.description && (!existing.description || !skipIfExists)) {
    updateData.description = String(enrichment.description);
    fieldsUpdated.push('description');
  }
  if (enrichment.employeeCount && typeof enrichment.employeeCount === 'number') {
    if (!existing.employeeCount || !skipIfExists) {
      updateData.employeeCount = enrichment.employeeCount;
      fieldsUpdated.push('employeeCount');
    }
  }
  if (enrichment.revenue && (!existing.revenue || !skipIfExists)) {
    updateData.revenue = String(enrichment.revenue);
    fieldsUpdated.push('revenue');
  }
  if (enrichment.headquarters && (!existing.headquarters || !skipIfExists)) {
    updateData.headquarters = String(enrichment.headquarters);
    fieldsUpdated.push('headquarters');
  }
  if (enrichment.foundedYear && typeof enrichment.foundedYear === 'number') {
    if (!existing.foundedYear || !skipIfExists) {
      updateData.foundedYear = enrichment.foundedYear;
      fieldsUpdated.push('foundedYear');
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.organization.update({
      where: { id: orgId },
      data: updateData,
    });
  }

  return fieldsUpdated;
}

// ─── Batch Enrichment & Staleness ──────────────────────────────────────

/**
 * Enrich multiple stale organizations. Designed for cron usage.
 */
export async function enrichStaleOrganizations(
  maxCount: number = 10,
): Promise<{ enriched: number; errors: number }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const staleOrgs = await db.organization.findMany({
    where: {
      trackingStatus: 'active',
      OR: [{ lastEnrichedAt: null }, { lastEnrichedAt: { lt: thirtyDaysAgo } }],
    },
    orderBy: { updatedAt: 'desc' },
    take: maxCount,
  });

  let enriched = 0;
  let errors = 0;

  for (const org of staleOrgs) {
    try {
      const result = await enrichOrganization(org.id);
      if (result && result.fieldsUpdated.length > 0) enriched++;
    } catch (error) {
      errors++;
      logger.warn('[ENRICH-BATCH] Failed to enrich org', {
        orgId: org.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.info('[ENRICH-BATCH] Batch complete', {
    total: staleOrgs.length,
    enriched,
    errors,
  });

  return { enriched, errors };
}

/**
 * Detect stale entities that need enrichment.
 * FIX EI-7: Staleness detection for entities.
 */
export async function detectStaleEntities(): Promise<{
  stale: number;
  total: number;
  staleOrgs: Array<{ id: string; name: string; lastEnrichedAt: Date | null; updatedAt: Date }>;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const staleOrgs = await db.organization.findMany({
    where: {
      trackingStatus: 'active',
      OR: [{ lastEnrichedAt: null }, { lastEnrichedAt: { lt: thirtyDaysAgo } }],
    },
    select: { id: true, name: true, lastEnrichedAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 50,
  });

  const total = await db.organization.count({ where: { trackingStatus: 'active' } });

  return { stale: staleOrgs.length, total, staleOrgs };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function inferDomain(name: string): string | null {
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (clean.length < 2) return null;
  return `${clean}.com`;
}
