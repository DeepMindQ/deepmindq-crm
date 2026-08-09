/**
 * Crunchbase Intelligence Connector
 *
 * Pulls funding, investors, acquisitions, IPO data, and company profile
 * information for funded companies from the Crunchbase API v4.
 *
 * Data categories retrieved:
 *   - Company profile (description, categories, founded date, employee count, homepage)
 *   - Funding rounds (series, amount, investors, date, pre/post valuation)
 *   - Current investors (name, type, firm)
 *   - Acquisitions (acquired company, date, price, status)
 *   - IPO data (date, price, valuation, exchange)
 *
 * Config shape:
 *   {
 *     identifier: string,              // Crunchbase permalink, domain, or name
 *     identifierType?: 'permalink' | 'domain' | 'name',  // default: 'domain'
 *     apiKey?: string,                // Falls back to CRUNCHBASE_API_KEY env var
 *     includeFunding?: boolean,       // Default: true
 *     includeAcquisitions?: boolean,  // Default: true
 *     includeIPO?: boolean,           // Default: true
 *     maxRounds?: number,             // Default: 20
 *   }
 *
 * Feature flag: ENABLE_CRUNCHBASE_CONNECTOR (default: false).
 *
 * Implements the IConnector interface, following the same pattern as
 * clearbit-connector, csv-connector, and excel-connector.
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

// ─── Feature Flag ─────────────────────────────────────────────

const CRUNCHBASE_ENABLED =
  process.env.ENABLE_CRUNCHBASE_CONNECTOR === 'true';

// ─── Constants ───────────────────────────────────────────────

const CRUNCHBASE_API_BASE = 'https://api.crunchbase.com/api/v4';

/** Default config values */
const DEFAULT_IDENTIFIER_TYPE = 'domain' as const;
const DEFAULT_MAX_ROUNDS = 20;

// ─── Crunchbase API Response Types ────────────────────────────

/** Minimal shape of the Crunchbase API v4 entity response */
interface CrunchbaseEntityResponse {
  uuid?: string;
  type?: string;
  properties?: CrunchbaseEntityProperties;
  cards?: CrunchbaseCards;
}

interface CrunchbaseEntityProperties {
  identifier?: {
    uuid?: string;
    value?: string;   // permalink
    image_id?: string;
    permalink?: string;
    entity_def_id?: string;
  };
  name?: string;
  short_description?: string;
  description?: string;
  website_url?: string;
  founded_on?: string;       // ISO date
  closed_on?: string;
  num_employees_min?: number;
  num_employees_max?: number;
  employee_count?: string;   // e.g. "51-100"
  stock_symbol?: string;
  stock_exchange_symbol?: string;
  categories?: Array<{ name?: string; uuid?: string }>;
  headquarters_locations?: Array<{
    city?: string;
    region?: string;
    country?: string;
  }>;
  company_type?: string;
  status?: string;
  total_funding_usd?: number;
  number_of_investments?: number;
  ipo?: string;              // UUID reference or "true"
  is_iPO?: boolean;
  cb_url?: string;
}

interface CrunchbaseCards {
  funding_rounds?: {
    paging?: { total_items?: number; first_page_url?: string; next_page_url?: string };
    items?: CrunchbaseFundingRound[];
  };
  current_investors?: {
    paging?: { total_items?: number };
    items?: CrunchbaseInvestor[];
  };
  acquisitions?: {
    paging?: { total_items?: number };
    items?: CrunchbaseAcquisition[];
  };
  ipo?: {
    items?: CrunchbaseIPO[];
  };
  raised_investments?: {
    paging?: { total_items?: number };
    items?: unknown[];
  };
}

interface CrunchbaseFundingRound {
  uuid?: string;
  type?: string;
  properties?: {
    investment_type?: string;     // e.g. "Series A", "Seed", "Angel"
    money_raised_usd?: number;
    money_raised?: string;        // e.g. "$10M"
    announced_on?: string;        // ISO date
    pre_money_valuation_usd?: number;
    post_money_valuation_usd?: number;
    target_money_raised_usd?: number;
    series?: string;
    participated?: boolean;
  };
  relationships?: Array<{
    title?: string;
    entity?: {
      name?: string;
      uuid?: string;
      type?: string;
      properties?: {
        investor_type?: string;
        investment_count?: number;
      };
    };
  }>;
}

interface CrunchbaseInvestor {
  uuid?: string;
  type?: string;
  properties?: {
    name?: string;
    type?: string;               // e.g. "organization", "person"
    investor_type?: string;      // e.g. "venture", "angel", "corporate"
    investment_count?: number;
  };
}

interface CrunchbaseAcquisition {
  uuid?: string;
  type?: string;
  properties?: {
    acquisition_type?: string;
    announced_on?: string;
    price_usd?: number;
    payment_type?: string;
    disposition_of_acquired?: string;
    acquired_company?: {
      name?: string;
      uuid?: string;
      type?: string;
    };
    acquirer?: {
      name?: string;
      uuid?: string;
    };
  };
}

interface CrunchbaseIPO {
  uuid?: string;
  type?: string;
  properties?: {
    went_public_on?: string;
    price_usd?: number;
    share_price_usd?: number;
    valuation_usd?: number;
    stock_exchange_symbol?: string;
    stock_symbol?: string;
    money_raised_usd?: number;
    number_of_shares_offered?: number;
  };
}

// ─── Config Type ──────────────────────────────────────────────

/** Strongly-typed config for the Crunchbase connector */
interface CrunchbaseConfig {
  identifier: string;
  identifierType?: 'permalink' | 'domain' | 'name';
  apiKey?: string;
  includeFunding?: boolean;
  includeAcquisitions?: boolean;
  includeIPO?: boolean;
  maxRounds?: number;
}

// ─── TRUST Metadata Helpers ────────────────────────────────────

/**
 * Build TRUST metadata for a data point from Crunchbase.
 *
 * Crunchbase data is directly sourced from a verified platform,
 * but individual fields may have varying reliability.
 */
function buildTrustMetadata(
  field: string,
  value: unknown,
  confidence?: 'high' | 'medium',
): TrustMetadata {
  const now = new Date().toISOString();

  // Funding amounts and valuations are often estimated
  const estimatedFields = new Set([
    'money_raised_usd', 'pre_money_valuation_usd', 'post_money_valuation_usd',
    'num_employees_min', 'num_employees_max', 'employee_count',
    'price_usd', 'valuation_usd',
  ]);

  const isEstimated = estimatedFields.has(field);
  const resolvedConfidence = confidence || (isEstimated ? 'medium' : 'high');

  return {
    source: 'verified_api',
    confidence: resolvedConfidence,
    freshness: now,
    reasoning: isEstimated
      ? `Estimated by Crunchbase from public filings and sources for field "${field}".`
      : `Directly verified by Crunchbase API for field "${field}".`,
    provider: 'crunchbase',
    field,
    originalValue: value !== null && value !== undefined ? String(value) : undefined,
    verificationStatus: 'verified',
  };
}

// ─── HTTP Helper ───────────────────────────────────────────────

/**
 * Make an authenticated request to the Crunchbase API with retry
 * and rate-limit handling. Never throws — returns null on failure.
 */
async function fetchCrunchbaseApi(
  path: string,
  apiKey: string,
): Promise<{ data: CrunchbaseEntityResponse | null; error?: string }> {
  const url = `${CRUNCHBASE_API_BASE}${path}`;

  try {
    const response = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            'X-cb-user-key': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
          },
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) {
          const err = new Error(`Crunchbase API returned ${res.status}: ${res.statusText}`);
          (err as any).status = res.status;
          throw err;
        }
        return res;
      },
      'Crunchbase API fetch',
      DEFAULT_RETRY_CONFIG,
    );

    const body = await response.json();
    return { data: body as CrunchbaseEntityResponse };
  } catch (err) {
    return { data: null, error: buildConnectorErrorDetail(err, 'Crunchbase connector', DEFAULT_RETRY_CONFIG.maxRetries + 1) };
  }
}

// ─── Connector Implementation ──────────────────────────────────

export class CrunchbaseConnector extends BaseConnector {
  readonly sourceType = 'crunchbase' as const;
  readonly name = 'Crunchbase Intelligence';

  // ── Legacy run() adapter ───────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
    if (!CRUNCHBASE_ENABLED) {
      return this.createErrorResult(
        'Crunchbase connector is disabled. Set ENABLE_CRUNCHBASE_CONNECTOR=true to enable.',
      );
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

    if (!config.identifier || typeof config.identifier !== 'string') {
      errors.push('"identifier" is required and must be a string (Crunchbase permalink, domain, or company name)');
    }

    if (config.identifierType && !['permalink', 'domain', 'name'].includes(config.identifierType as string)) {
      errors.push('"identifierType" must be one of: "permalink", "domain", "name"');
    }

    // apiKey is checked at runtime (can come from env), but if provided it must be a string
    if (config.apiKey !== undefined && typeof config.apiKey !== 'string') {
      errors.push('"apiKey" must be a string if provided');
    }

    if (config.maxRounds !== undefined && (typeof config.maxRounds !== 'number' || config.maxRounds < 1)) {
      errors.push('"maxRounds" must be a positive number if provided');
    }

    return { valid: errors.length === 0, errors };
  }

  // ── test ─────────────────────────────────────────────────────

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    // Check feature flag
    if (!CRUNCHBASE_ENABLED) {
      return {
        success: false,
        message: 'Crunchbase connector is disabled. Set ENABLE_CRUNCHBASE_CONNECTOR=true to enable.',
      };
    }

    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.errors.join('; ') };
    }

    const apiKey = (config.apiKey as string) || process.env.CRUNCHBASE_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: 'No Crunchbase API key provided. Pass "apiKey" in config or set CRUNCHBASE_API_KEY environment variable. Get a key at https://data.crunchbase.com/',
      };
    }

    const identifier = config.identifier as string;
    const identifierType = (config.identifierType as string) || DEFAULT_IDENTIFIER_TYPE;

    // For test, try to resolve the identifier and make a lightweight call
    try {
      const permalink = await this.resolvePermalink(identifier, identifierType as 'permalink' | 'domain' | 'name', apiKey);
      if (!permalink) {
        return {
          success: false,
          message: `Could not resolve "${identifier}" to a Crunchbase organization. Verify the identifier and try again.`,
        };
      }

      // Make a basic request to verify the API key works
      const { data, error } = await fetchCrunchbaseApi(
        `/entities/organizations/${permalink}?card_ids=`,
        apiKey,
      );

      if (error) {
        return { success: false, message: `Crunchbase API error: ${error}` };
      }

      const companyName = data?.properties?.name || permalink;
      return {
        success: true,
        message: `Crunchbase connection successful. Company: ${companyName} (permalink: ${permalink}).`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Crunchbase connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── acquire ──────────────────────────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    // Check feature flag
    if (!CRUNCHBASE_ENABLED) {
      return this.createAcquisitionErrorResult(
        'Crunchbase connector is disabled. Set ENABLE_CRUNCHBASE_CONNECTOR=true to enable.',
      );
    }

    // Validate config
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return this.createAcquisitionErrorResult(validation.errors.join('; '));
    }

    // Resolve API key
    const apiKey = (config.apiKey as string) || process.env.CRUNCHBASE_API_KEY;
    if (!apiKey) {
      return this.createAcquisitionErrorResult(
        'No Crunchbase API key provided. Pass "apiKey" in config or set CRUNCHBASE_API_KEY environment variable. Get a key at https://data.crunchbase.com/',
      );
    }

    // Parse config
    const cfg: CrunchbaseConfig = {
      identifier: config.identifier as string,
      identifierType: (config.identifierType as CrunchbaseConfig['identifierType']) || DEFAULT_IDENTIFIER_TYPE,
      includeFunding: config.includeFunding !== false,
      includeAcquisitions: config.includeAcquisitions !== false,
      includeIPO: config.includeIPO !== false,
      maxRounds: (config.maxRounds as number) || DEFAULT_MAX_ROUNDS,
    };

    logger.info(`[crunchbase-connector] Acquiring data for "${cfg.identifier}" (type: ${cfg.identifierType})`);

    try {
      // ── Step 1: Resolve identifier to Crunchbase permalink ──
      const permalink = await this.resolvePermalink(
        cfg.identifier,
        cfg.identifierType!,
        apiKey,
      );

      if (!permalink) {
        return this.createAcquisitionErrorResult(
          `Could not resolve "${cfg.identifier}" to a Crunchbase organization. Try using the Crunchbase permalink directly (identifierType: "permalink").`,
        );
      }

      // ── Step 2: Build card_ids query ──
      const cardIds = this.buildCardIdsQuery(cfg);

      // ── Step 3: Fetch organization data ──
      const { data, error } = await fetchCrunchbaseApi(
        `/entities/organizations/${permalink}?card_ids=${cardIds}`,
        apiKey,
      );

      if (error || !data) {
        return this.createAcquisitionErrorResult(
          `Failed to fetch Crunchbase data for "${permalink}": ${error || 'No data returned'}`,
        );
      }

      // ── Step 4: Parse into intelligence objects ──
      const intelligenceObjects = this.parseEntityResponse(data, cfg);

      logger.info(
        `[crunchbase-connector] Successfully acquired ${intelligenceObjects.length} intelligence objects for "${data.properties?.name || permalink}"`,
      );

      return this.createAcquisitionResult({
        success: true,
        intelligenceObjects,
        errors: [],
        metadata: {
          totalObjects: intelligenceObjects.length,
          permalink,
          companyName: data.properties?.name,
          provider: 'crunchbase',
          objectTypes: intelligenceObjects.map((o) => o.metadata?.objectType),
        },
      });
    } catch (err) {
      return this.createAcquisitionErrorResult(
        buildConnectorErrorDetail(err, 'Crunchbase connector acquire'),
      );
    }
  }

  // ── Identifier Resolution ────────────────────────────────────

  /**
   * Resolve a domain or company name to a Crunchbase permalink.
   * If identifierType is 'permalink', returns it directly (after validation).
   */
  private async resolvePermalink(
    identifier: string,
    identifierType: 'permalink' | 'domain' | 'name',
    apiKey: string,
  ): Promise<string | null> {
    // If it's already a permalink, validate it exists
    if (identifierType === 'permalink') {
      // Normalize: strip any leading/trailing slashes
      const normalized = identifier.replace(/^\//, '').replace(/\/$/, '');
      const { data, error } = await fetchCrunchbaseApi(
        `/entities/organizations/${normalized}?card_ids=`,
        apiKey,
      );
      if (error || !data) {
        logger.warn(`[crunchbase-connector] Permalink "${normalized}" not found: ${error}`);
        return null;
      }
      return normalized;
    }

    // Search by domain or name using the search endpoint
    const query = identifierType === 'domain'
      ? `domain_name:${identifier}`
      : `${identifier}`;

    // Crunchbase search API
    const searchUrl = `${CRUNCHBASE_API_BASE}/autocompletes?query=${encodeURIComponent(query)}&collection_ids=organizations&limit=1`;

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(searchUrl, {
            headers: {
              'X-cb-user-key': apiKey,
              'Accept': 'application/json',
              'User-Agent': 'DeepMindQ-Enterprise-Intelligence/1.0',
            },
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) {
            const err = new Error(`Crunchbase search returned ${res.status}: ${res.statusText}`);
            (err as any).status = res.status;
            throw err;
          }
          return res;
        },
        'Crunchbase search API fetch',
        DEFAULT_RETRY_CONFIG,
      );

      const body = await response.json() as {
        entities?: Array<{
          identifier?: {
            uuid?: string;
            value?: string;    // permalink
            permalink?: string;
          };
          short_description?: string;
          name?: string;
        }>;
      };

      const match = body.entities?.[0];
      if (match?.identifier?.value) {
        return match.identifier.value;
      }
      if (match?.identifier?.permalink) {
        return match.identifier.permalink;
      }

      // No results from search — try a direct permalink guess
      return this.guessAndValidatePermalink(identifier, identifierType, apiKey);
    } catch (err) {
      logger.warn(
        `[crunchbase-connector] Search failed: ${buildConnectorErrorDetail(err, 'Crunchbase search', DEFAULT_RETRY_CONFIG.maxRetries + 1)}`,
      );
      return this.guessAndValidatePermalink(identifier, identifierType, apiKey);
    }
  }

  /**
   * When search fails, try converting domain/name to a likely permalink
   * and validate it. E.g. "stripe.com" → "stripe".
   */
  private async guessAndValidatePermalink(
    identifier: string,
    identifierType: 'domain' | 'name',
    apiKey: string,
  ): Promise<string | null> {
    // Strip TLD for domain-based identifiers
    let guess: string;
    if (identifierType === 'domain') {
      guess = identifier.replace(/^https?:\/\//, '').replace(/www\./, '').split('.')[0];
    } else {
      // For names, lowercase and replace spaces with hyphens
      guess = identifier.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    if (!guess) return null;

    const { data } = await fetchCrunchbaseApi(
      `/entities/organizations/${guess}?card_ids=`,
      apiKey,
    );

    return data ? guess : null;
  }

  // ── Card ID Builder ──────────────────────────────────────────

  /**
   * Build the card_ids query parameter based on config flags.
   * Only requests the cards we need to minimize API response size.
   */
  private buildCardIdsQuery(cfg: CrunchbaseConfig): string {
    const cards: string[] = [];

    if (cfg.includeFunding) {
      cards.push('funding_rounds', 'current_investors');
    }
    if (cfg.includeAcquisitions) {
      cards.push('acquisitions');
    }
    if (cfg.includeIPO) {
      cards.push('ipo');
    }

    return cards.join(',');
  }

  // ── Response Parsing ─────────────────────────────────────────

  /**
   * Parse the full Crunchbase entity response into RawIntelligenceObjects.
   */
  private parseEntityResponse(
    data: CrunchbaseEntityResponse,
    cfg: CrunchbaseConfig,
  ): RawIntelligenceObject[] {
    const objects: RawIntelligenceObject[] = [];
    const props = data.properties;
    const companyName = props?.name || cfg.identifier;
    const permalink = props?.identifier?.value || props?.identifier?.permalink || cfg.identifier;
    const sourceUrl = props?.cb_url || `https://www.crunchbase.com/organization/${permalink}`;

    // --- 1. Company Profile Object ---
    objects.push(this.buildCompanyProfileObject(companyName, props, sourceUrl));

    // --- 2. Funding Round Objects ---
    if (cfg.includeFunding && data.cards?.funding_rounds?.items?.length) {
      const rounds = data.cards.funding_rounds.items.slice(0, cfg.maxRounds!);
      for (const round of rounds) {
        const obj = this.buildFundingRoundObject(companyName, round, sourceUrl);
        if (obj) objects.push(obj);
      }
    }

    // --- 3. Current Investors Object (aggregated) ---
    if (cfg.includeFunding && data.cards?.current_investors?.items?.length) {
      objects.push(this.buildInvestorsObject(companyName, data.cards.current_investors.items, sourceUrl));
    }

    // --- 4. Acquisition Objects ---
    if (cfg.includeAcquisitions && data.cards?.acquisitions?.items?.length) {
      for (const acquisition of data.cards.acquisitions.items) {
        const obj = this.buildAcquisitionObject(companyName, acquisition, sourceUrl);
        if (obj) objects.push(obj);
      }
    }

    // --- 5. IPO Object ---
    if (cfg.includeIPO && data.cards?.ipo?.items?.length) {
      const ipo = data.cards.ipo.items[0];
      if (ipo) {
        const obj = this.buildIPOObject(companyName, ipo, sourceUrl);
        if (obj) objects.push(obj);
      }
    }

    return objects;
  }

  // ── Object Builders ──────────────────────────────────────────

  private buildCompanyProfileObject(
    companyName: string,
    props: CrunchbaseEntityProperties | undefined,
    sourceUrl: string,
  ): RawIntelligenceObject {
    const lines: string[] = [];

    if (props?.name) lines.push(`Company: ${props.name}`);
    if (props?.short_description) lines.push(`Summary: ${props.short_description}`);
    if (props?.description) lines.push(`Description: ${props.description}`);
    if (props?.website_url) lines.push(`Website: ${props.website_url}`);
    if (props?.founded_on) lines.push(`Founded: ${props.founded_on}`);
    if (props?.company_type) lines.push(`Company Type: ${props.company_type}`);
    if (props?.status) lines.push(`Status: ${props.status}`);

    if (props?.categories?.length) {
      lines.push(`Categories: ${props.categories.map((c) => c.name).filter(Boolean).join(', ')}`);
    }

    if (props?.employee_count) {
      lines.push(`Employees: ${props.employee_count}`);
    } else if (props?.num_employees_min !== undefined && props?.num_employees_max !== undefined) {
      lines.push(`Employees: ${props.num_employees_min} - ${props.num_employees_max}`);
    }

    if (props?.headquarters_locations?.length) {
      const hq = props.headquarters_locations[0];
      const parts = [hq?.city, hq?.region, hq?.country].filter(Boolean).join(', ');
      if (parts) lines.push(`Headquarters: ${parts}`);
    }

    if (props?.total_funding_usd !== undefined) {
      lines.push(`Total Funding: $${this.formatCurrency(props.total_funding_usd)}`);
    }

    if (props?.stock_symbol) {
      lines.push(`Stock Symbol: ${props.stock_symbol}`);
      if (props?.stock_exchange_symbol) lines.push(`Stock Exchange: ${props.stock_exchange_symbol}`);
    }

    const trust = {
      name: buildTrustMetadata('name', props?.name),
      description: buildTrustMetadata('description', props?.description),
      categories: buildTrustMetadata('categories', props?.categories?.map((c) => c.name).join(', ')),
      foundedOn: buildTrustMetadata('founded_on', props?.founded_on),
      employees: buildTrustMetadata('employee_count', props?.employee_count || `${props?.num_employees_min}-${props?.num_employees_max}`),
      totalFunding: buildTrustMetadata('total_funding_usd', props?.total_funding_usd, 'medium'),
      website: buildTrustMetadata('website_url', props?.website_url),
    };

    return {
      companyIdentifier: companyName,
      content: lines.join('\n'),
      summary: props?.short_description || props?.description?.substring(0, 200) || undefined,
      category: 'company_profile',
      capturedAt: new Date(),
      sourceUrl,
      metadata: {
        source: 'Crunchbase',
        provider: 'crunchbase',
        objectType: 'company_profile',
        confidence: 'high',
        permalink: props?.identifier?.value || props?.identifier?.permalink,
        uuid: props?.identifier?.uuid,
        totalFundingUsd: props?.total_funding_usd,
        foundedOn: props?.founded_on,
        employeeCount: props?.employee_count,
        categories: props?.categories?.map((c) => c.name),
        websiteUrl: props?.website_url,
        companyType: props?.company_type,
        status: props?.status,
        trust,
      },
    };
  }

  private buildFundingRoundObject(
    companyName: string,
    round: CrunchbaseFundingRound,
    sourceUrl: string,
  ): RawIntelligenceObject | null {
    const props = round.properties;
    if (!props) return null;

    const lines: string[] = [];

    if (props.investment_type) lines.push(`Round Type: ${props.investment_type}`);
    if (props.announced_on) lines.push(`Date: ${props.announced_on}`);
    if (props.money_raised_usd !== undefined) {
      lines.push(`Amount: $${this.formatCurrency(props.money_raised_usd)}`);
    } else if (props.money_raised) {
      lines.push(`Amount: ${props.money_raised}`);
    }
    if (props.pre_money_valuation_usd !== undefined) {
      lines.push(`Pre-Money Valuation: $${this.formatCurrency(props.pre_money_valuation_usd)}`);
    }
    if (props.post_money_valuation_usd !== undefined) {
      lines.push(`Post-Money Valuation: $${this.formatCurrency(props.post_money_valuation_usd)}`);
    }

    // Extract investor names from relationships
    const investors = round.relationships
      ?.map((r) => r.entity?.name)
      .filter(Boolean);
    if (investors?.length) {
      lines.push(`Investors: ${investors.join(', ')}`);
    }

    return {
      companyIdentifier: companyName,
      content: lines.join('\n'),
      summary: `${props.investment_type || 'Funding round'}${props.money_raised_usd ? ` — $${this.formatCurrency(props.money_raised_usd)}` : ''}${props.announced_on ? ` (${props.announced_on})` : ''}`,
      category: 'funding_event',
      capturedAt: props.announced_on ? new Date(props.announced_on) : new Date(),
      sourceUrl,
      metadata: {
        source: 'Crunchbase',
        provider: 'crunchbase',
        objectType: 'funding_event',
        confidence: 'high',
        uuid: round.uuid,
        investmentType: props.investment_type,
        moneyRaisedUsd: props.money_raised_usd,
        moneyRaised: props.money_raised,
        announcedOn: props.announced_on,
        preMoneyValuationUsd: props.pre_money_valuation_usd,
        postMoneyValuationUsd: props.post_money_valuation_usd,
        investors,
        investorCount: investors?.length || 0,
        trust: {
          investmentType: buildTrustMetadata('investment_type', props.investment_type),
          moneyRaised: buildTrustMetadata('money_raised_usd', props.money_raised_usd, 'medium'),
          preMoneyValuation: buildTrustMetadata('pre_money_valuation_usd', props.pre_money_valuation_usd, 'medium'),
          postMoneyValuation: buildTrustMetadata('post_money_valuation_usd', props.post_money_valuation_usd, 'medium'),
          announcedOn: buildTrustMetadata('announced_on', props.announced_on),
        },
      },
    };
  }

  private buildInvestorsObject(
    companyName: string,
    investors: CrunchbaseInvestor[],
    sourceUrl: string,
  ): RawIntelligenceObject {
    const investorLines = investors.map((inv) => {
      const name = inv.properties?.name || 'Unknown';
      const type = inv.properties?.investor_type || inv.type || 'unknown';
      return `- ${name} (${type})`;
    });

    const content = `Current Investors:\n${investorLines.join('\n')}`;

    const investorData = investors.map((inv) => ({
      name: inv.properties?.name,
      type: inv.type,
      investorType: inv.properties?.investor_type,
      investmentCount: inv.properties?.investment_count,
      uuid: inv.uuid,
    }));

    return {
      companyIdentifier: companyName,
      content,
      summary: `${investors.length} current investors including ${investorData[0]?.name || 'various firms'}`,
      category: 'investors',
      capturedAt: new Date(),
      sourceUrl,
      metadata: {
        source: 'Crunchbase',
        provider: 'crunchbase',
        objectType: 'investor_list',
        confidence: 'high',
        totalInvestors: investors.length,
        investors: investorData,
        trust: buildTrustMetadata('investors', `${investors.length} investors`),
      },
    };
  }

  private buildAcquisitionObject(
    companyName: string,
    acquisition: CrunchbaseAcquisition,
    sourceUrl: string,
  ): RawIntelligenceObject | null {
    const props = acquisition.properties;
    if (!props) return null;

    const lines: string[] = [];

    if (props.acquired_company?.name) lines.push(`Acquired: ${props.acquired_company.name}`);
    if (props.acquisition_type) lines.push(`Type: ${props.acquisition_type}`);
    if (props.announced_on) lines.push(`Date: ${props.announced_on}`);
    if (props.price_usd !== undefined) {
      lines.push(`Price: $${this.formatCurrency(props.price_usd)}`);
    }
    if (props.payment_type) lines.push(`Payment Type: ${props.payment_type}`);
    if (props.disposition_of_acquired) lines.push(`Disposition: ${props.disposition_of_acquired}`);

    return {
      companyIdentifier: companyName,
      content: lines.join('\n'),
      summary: `Acquired ${props.acquired_company?.name || 'company'}${props.price_usd ? ` for $${this.formatCurrency(props.price_usd)}` : ''}${props.announced_on ? ` (${props.announced_on})` : ''}`,
      category: 'acquisition_event',
      capturedAt: props.announced_on ? new Date(props.announced_on) : new Date(),
      sourceUrl,
      metadata: {
        source: 'Crunchbase',
        provider: 'crunchbase',
        objectType: 'acquisition_event',
        confidence: 'high',
        uuid: acquisition.uuid,
        acquiredCompany: props.acquired_company?.name,
        acquiredCompanyUuid: props.acquired_company?.uuid,
        acquisitionType: props.acquisition_type,
        announcedOn: props.announced_on,
        priceUsd: props.price_usd,
        paymentType: props.payment_type,
        disposition: props.disposition_of_acquired,
        trust: {
          price: buildTrustMetadata('price_usd', props.price_usd, 'medium'),
          date: buildTrustMetadata('announced_on', props.announced_on),
          acquiredCompany: buildTrustMetadata('acquired_company', props.acquired_company?.name),
        },
      },
    };
  }

  private buildIPOObject(
    companyName: string,
    ipo: CrunchbaseIPO,
    sourceUrl: string,
  ): RawIntelligenceObject | null {
    const props = ipo.properties;
    if (!props) return null;

    const lines: string[] = [];

    if (props.went_public_on) lines.push(`IPO Date: ${props.went_public_on}`);
    if (props.valuation_usd !== undefined) {
      lines.push(`Valuation: $${this.formatCurrency(props.valuation_usd)}`);
    }
    if (props.share_price_usd !== undefined) {
      lines.push(`Share Price: $${props.share_price_usd.toFixed(2)}`);
    }
    if (props.stock_exchange_symbol) lines.push(`Exchange: ${props.stock_exchange_symbol}`);
    if (props.stock_symbol) lines.push(`Ticker: ${props.stock_symbol}`);
    if (props.money_raised_usd !== undefined) {
      lines.push(`Money Raised: $${this.formatCurrency(props.money_raised_usd)}`);
    }
    if (props.number_of_shares_offered) {
      lines.push(`Shares Offered: ${props.number_of_shares_offered.toLocaleString()}`);
    }

    return {
      companyIdentifier: companyName,
      content: lines.join('\n'),
      summary: `IPO${props.stock_symbol ? ` (${props.stock_symbol})` : ''}${props.valuation_usd ? ` — $${this.formatCurrency(props.valuation_usd)} valuation` : ''}${props.went_public_on ? ` on ${props.went_public_on}` : ''}`,
      category: 'ipo_event',
      capturedAt: props.went_public_on ? new Date(props.went_public_on) : new Date(),
      sourceUrl,
      metadata: {
        source: 'Crunchbase',
        provider: 'crunchbase',
        objectType: 'ipo_event',
        confidence: 'high',
        uuid: ipo.uuid,
        wentPublicOn: props.went_public_on,
        valuationUsd: props.valuation_usd,
        sharePriceUsd: props.share_price_usd,
        stockExchange: props.stock_exchange_symbol,
        stockSymbol: props.stock_symbol,
        moneyRaisedUsd: props.money_raised_usd,
        sharesOffered: props.number_of_shares_offered,
        trust: {
          valuation: buildTrustMetadata('valuation_usd', props.valuation_usd, 'medium'),
          sharePrice: buildTrustMetadata('share_price_usd', props.share_price_usd, 'medium'),
          date: buildTrustMetadata('went_public_on', props.went_public_on),
          moneyRaised: buildTrustMetadata('money_raised_usd', props.money_raised_usd, 'medium'),
        },
      },
    };
  }

  // ── Utility ──────────────────────────────────────────────────

  /**
   * Format a number as a human-readable currency string.
   * E.g. 1500000 → "1.5M", 2500000000 → "2.5B"
   */
  private formatCurrency(amount: number): string {
    if (amount >= 1_000_000_000_000) {
      return `${(amount / 1_000_000_000_000).toFixed(1)}T`;
    }
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const crunchbaseConnector = new CrunchbaseConnector();
