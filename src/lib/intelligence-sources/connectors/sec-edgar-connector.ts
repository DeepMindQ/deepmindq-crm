/**
 * SEC EDGAR Filing Connector
 *
 * Pulls 10-K, 10-Q, 8-K, and DEF14A filings for public companies from the
 * SEC EDGAR API (free, no API key required; rate-limited to 10 req/s).
 *
 * Implements the IConnector interface following the same pattern as
 * clearbit-connector, csv-connector, and excel-connector.
 *
 * Filing types supported:
 *   - 10-K   — Annual report (revenue, net income, total assets, EPS)
 *   - 10-Q   — Quarterly report (revenue, net income, EPS)
 *   - 8-K    — Current events (material disclosures, leadership changes, M&A)
 *   - DEF14A — Proxy statement (executive comp, board, shareholder proposals)
 *
 * Config shape:
 *   {
 *     cik?: string,             // SEC CIK number (e.g. '0000320193' for Apple)
 *     ticker?: string,          // Stock ticker (e.g. 'AAPL')
 *     companyName?: string,     // Company name for search fallback
 *     filingTypes?: string[],   // Default: ['10-K', '10-Q', '8-K', 'DEF14A']
 *     startDate?: string,       // ISO date, default: 1 year ago
 *     endDate?: string,         // ISO date, default: today
 *     maxFilings?: number,      // Default: 20
 *   }
 *
 * Feature flag: ENABLE_SEC_EDGAR_CONNECTOR (default: false for safety)
 *
 * SEC EDGAR API endpoints:
 *   - Ticker→CIK map:  https://www.sec.gov/files/company_tickers.json
 *   - Submissions:     https://data.sec.gov/submissions/CIK{cik}.json
 *   - Filing document: https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{filename}
 */

import { BaseConnector } from '../base-connector';
import { logger } from '@/lib/logger';
import type {
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorResult,
  RawIntelligenceObject,
} from '../types';
import { withRetry, buildConnectorErrorDetail, DEFAULT_RETRY_CONFIG } from '../retry-utilities';

// ─── Constants ─────────────────────────────────────────────────

const FEATURE_FLAG = 'ENABLE_SEC_EDGAR_CONNECTOR';

/** Required SEC User-Agent header — SEC mandates identifying your app. */
const SEC_USER_AGENT = 'DeepMindQ contact@example.com';

/** Delay between API calls to respect SEC's 10 req/s rate limit. */
const RATE_LIMIT_DELAY_MS = 110; // slightly above 100ms to stay safely under 10/s

/** Default filing types to fetch. */
const DEFAULT_FILING_TYPES = ['10-K', '10-Q', '8-K', 'DEF14A'];

/** Default max number of filings to return. */
const DEFAULT_MAX_FILINGS = 20;

/** Max characters of filing text to include in content field. */
const MAX_CONTENT_LENGTH = 5_000;

/** Confidence & reliability scores — SEC data is the gold standard. */
const SEC_CONFIDENCE = 0.95;
const SEC_SOURCE_RELIABILITY = 0.95;

/** HTTP timeout in milliseconds. */
const HTTP_TIMEOUT_MS = 30_000;

// ─── SEC API URL Builders ──────────────────────────────────────

/** Base URLs for SEC EDGAR APIs. */
const SEC_API = {
  /** Maps tickers → CIK numbers. */
  tickerMap: 'https://www.sec.gov/files/company_tickers.json',

  /** Company filing submissions (recent & historical filings). */
  submissions: (cik: string) => `https://data.sec.gov/submissions/CIK${cik}.json`,

  /** Individual filing document from the Archives. */
  filingDocument: (cik: string, accession: string, filename: string) =>
    `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${filename}`,
} as const;

// ─── Type Definitions ──────────────────────────────────────────

/** Parsed configuration for the connector. */
interface SecEdgarConfig {
  cik?: string;
  ticker?: string;
  companyName?: string;
  filingTypes: string[];
  startDate: string;
  endDate: string;
  maxFilings: number;
}

/** Shape of a single entry in SEC's company_tickers.json. */
interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/** Shape of SEC's company_tickers.json response. */
interface TickerMapResponse {
  [key: string]: TickerEntry;
}

/** Shape of a filing entry in the SEC submissions JSON. */
interface SecFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  acceptanceDateTime: string;
  act: string;
  form: string;
  fileNumber: string;
  filmNumber: string;
  items: string;
  size: number;
  isXBRL: boolean;
  isInlineXBRL: boolean;
  primaryDocument: string;
  primaryDocDescription: string;
}

/** Shape of the SEC submissions JSON response. */
interface SecSubmissionsResponse {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  ownerOrg: string;
  tickers: string[];
  exchanges: string[];
  name: string;
  edgarVersion: string;
  'last filing': unknown;
  filings: {
    recent: SecFiling[];
    previous?: {
      accessionNumber: string;
      filingDate: string;
      reportDate: string;
      acceptanceDateTime: string;
      act: string;
      form: string;
      fileNumber: string;
      filmNumber: string;
      items: string;
      size: number;
      isXBRL: boolean;
      isInlineXBRL: boolean;
      primaryDocument: string;
      primaryDocDescription: string;
    }[];
  };
}

// ─── HTTP Helper ───────────────────────────────────────────────

/**
 * Rate-limited fetch with SEC-required User-Agent header and retry.
 * Uses shared withRetry for exponential backoff. Returns null on failure.
 */
async function secFetch(url: string, description: string): Promise<Response | null> {
  try {
    const response = await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': SEC_USER_AGENT,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = new Error(`SEC EDGAR returned ${res.status}: ${res.statusText}`);
          (err as any).status = res.status;
          throw err;
        }
        return res;
      },
      `SEC EDGAR API fetch (${description})`,
      DEFAULT_RETRY_CONFIG,
    );

    return response;
  } catch (err) {
    logger.error(
      `[sec-edgar] Fetch failed for ${description}: ${buildConnectorErrorDetail(err, 'SEC EDGAR connector', DEFAULT_RETRY_CONFIG.maxRetries + 1)}`,
    );
    return null;
  }
}

/**
 * Rate-limit delay — ensures we stay under SEC's 10 requests/second limit.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pad a CIK number to 10 digits with leading zeros (SEC requirement).
 */
function padCik(cik: string): string {
  return cik.padStart(10, '0');
}

/**
 * Strip dashes from an accession number to build archive URLs.
 */
function stripAccessionDashes(accession: string): string {
  return accession.replace(/-/g, '');
}

// ─── Connector Implementation ──────────────────────────────────

export class SecEdgarConnector extends BaseConnector {
  readonly sourceType = 'sec_edgar' as const;
  readonly name = 'SEC EDGAR Filings';

  // ── Legacy run() adapter ───────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
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

    if (!config.cik && !config.ticker && !config.companyName) {
      errors.push('At least one of "cik", "ticker", or "companyName" is required');
    }

    if (config.cik && typeof config.cik !== 'string') {
      errors.push('cik must be a string (e.g. "0000320193")');
    }

    if (config.ticker && typeof config.ticker !== 'string') {
      errors.push('ticker must be a string (e.g. "AAPL")');
    }

    if (config.companyName && typeof config.companyName !== 'string') {
      errors.push('companyName must be a string');
    }

    if (config.filingTypes && !Array.isArray(config.filingTypes)) {
      errors.push('filingTypes must be an array of strings');
    }

    if (config.maxFilings !== undefined && typeof config.maxFilings !== 'number') {
      errors.push('maxFilings must be a number');
    }

    if (config.startDate && typeof config.startDate !== 'string') {
      errors.push('startDate must be an ISO date string');
    }

    if (config.endDate && typeof config.endDate !== 'string') {
      errors.push('endDate must be an ISO date string');
    }

    return { valid: errors.length === 0, errors };
  }

  // ── test ─────────────────────────────────────────────────────

  async test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    // Check feature flag
    if (!this.isFeatureEnabled()) {
      return {
        success: false,
        message: `Feature flag ${FEATURE_FLAG} is not enabled. Set it in environment variables.`,
      };
    }

    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.errors.join('; ') };
    }

    // Test connectivity by fetching the ticker map
    const response = await secFetch(SEC_API.tickerMap, 'SEC ticker map');
    if (!response) {
      return {
        success: false,
        message: 'Cannot reach SEC EDGAR API. Check network connectivity.',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `SEC EDGAR API returned status ${response.status}: ${response.statusText}`,
      };
    }

    // If a ticker was provided, try resolving it
    const ticker = config.ticker as string | undefined;
    if (ticker) {
      const data = await response.json() as TickerMapResponse;
      const found = Object.values(data).find(
        (e) => e.ticker.toUpperCase() === ticker.toUpperCase(),
      );
      if (found) {
        return {
          success: true,
          message: `SEC EDGAR connected. Ticker ${ticker} resolves to CIK ${padCik(String(found.cik_str))} (${found.title}).`,
        };
      }
      return {
        success: true,
        message: `SEC EDGAR connected, but ticker "${ticker}" not found in SEC database.`,
      };
    }

    return {
      success: true,
      message: 'SEC EDGAR API connection successful.',
    };
  }

  // ── acquire ──────────────────────────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    // ── Guard: feature flag ──
    if (!this.isFeatureEnabled()) {
      return this.createAcquisitionErrorResult(
        `SEC EDGAR connector is disabled. Set ${FEATURE_FLAG}=true in environment variables.`,
      );
    }

    // ── Validate config ──
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return this.createAcquisitionErrorResult(validation.errors.join('; '));
    }

    // ── Parse config with defaults ──
    const parsed = this.parseConfig(config);

    try {
      // ── Step 1: Resolve CIK ──
      const resolved = await this.resolveCik(parsed);
      if (!resolved) {
        return this.createAcquisitionErrorResult(
          `Could not resolve company identifier. Provide a valid CIK or ticker. Checked: cik=${parsed.cik ?? 'none'}, ticker=${parsed.ticker ?? 'none'}, companyName=${parsed.companyName ?? 'none'}.`,
        );
      }

      const { cik, ticker, companyName } = resolved;
      logger.info(`[sec-edgar] Resolved: ${companyName} (CIK: ${cik}, Ticker: ${ticker ?? 'N/A'})`);

      await delay(RATE_LIMIT_DELAY_MS);

      // ── Step 2: Fetch company submissions ──
      const filings = await this.fetchSubmissions(cik, parsed);
      if (!filings || filings.length === 0) {
        return this.createAcquisitionResult({
          success: true,
          intelligenceObjects: [],
          errors: [
            `No matching filings found for ${companyName} with types [${parsed.filingTypes.join(', ')}] between ${parsed.startDate} and ${parsed.endDate}.`,
          ],
          metadata: { cik, ticker, companyName, filingCount: 0 },
        });
      }

      logger.info(`[sec-edgar] Found ${filings.length} matching filings. Fetching documents...`);

      // ── Step 3: Fetch and parse each filing document ──
      const intelligenceObjects: RawIntelligenceObject[] = [];
      const errors: string[] = [];

      for (const filing of filings) {
        try {
          const obj = await this.fetchAndParseFiling(filing, cik, ticker, companyName);
          if (obj) {
            intelligenceObjects.push(obj);
          }
        } catch (err) {
          const msg = `Failed to fetch filing ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`;
          logger.warn(`[sec-edgar] ${msg}`);
          errors.push(msg);
        }

        // Rate limit between document fetches
        await delay(RATE_LIMIT_DELAY_MS);

        // Stop if we've reached the max
        if (intelligenceObjects.length >= parsed.maxFilings) {
          logger.info(`[sec-edgar] Reached maxFilings limit (${parsed.maxFilings}). Stopping.`);
          break;
        }
      }

      return this.createAcquisitionResult({
        success: intelligenceObjects.length > 0,
        intelligenceObjects,
        errors,
        metadata: {
          cik,
          ticker,
          companyName,
          filingTypes: parsed.filingTypes,
          dateRange: { start: parsed.startDate, end: parsed.endDate },
          totalFilingsFound: filings.length,
          filingsReturned: intelligenceObjects.length,
          provider: 'sec_edgar',
        },
      });
    } catch (err) {
      return this.createAcquisitionErrorResult(
        buildConnectorErrorDetail(err, 'SEC EDGAR connector acquire'),
      );
    }
  }

  // ── CIK Resolution ────────────────────────────────────────────

  /**
   * Resolve a CIK number, ticker, and company name from the provided config.
   * Strategy:
   *   1. If CIK provided directly → pad and look up ticker/name from submissions
   *   2. If ticker provided → look up CIK from SEC ticker map
   *   3. If only companyName → use submissions endpoint (CIK may not be known)
   */
  private async resolveCik(
    config: SecEdgarConfig,
  ): Promise<{ cik: string; ticker: string | null; companyName: string } | null> {
    // ── Path 1: Direct CIK provided ──
    if (config.cik) {
      const paddedCik = padCik(config.cik);
      await delay(RATE_LIMIT_DELAY_MS);
      const response = await secFetch(SEC_API.submissions(paddedCik), `submissions for CIK ${paddedCik}`);
      if (response && response.ok) {
        const data = await response.json() as SecSubmissionsResponse;
        return {
          cik: paddedCik,
          ticker: data.tickers?.[0] ?? null,
          companyName: config.companyName || data.name || `CIK-${paddedCik}`,
        };
      }
      // CIK was invalid — fall through to ticker lookup if available
      logger.warn(`[sec-edgar] Direct CIK ${paddedCik} failed. Falling back to ticker lookup.`);
    }

    // ── Path 2: Ticker lookup ──
    if (config.ticker) {
      await delay(RATE_LIMIT_DELAY_MS);
      const tickerResponse = await secFetch(SEC_API.tickerMap, 'SEC ticker map');
      if (tickerResponse && tickerResponse.ok) {
        const tickerData = await tickerResponse.json() as TickerMapResponse;
        const entry = Object.values(tickerData).find(
          (e) => e.ticker.toUpperCase() === config.ticker!.toUpperCase(),
        );

        if (entry) {
          const paddedCik = padCik(String(entry.cik_str));
          await delay(RATE_LIMIT_DELAY_MS);
          const subResponse = await secFetch(
            SEC_API.submissions(paddedCik),
            `submissions for CIK ${paddedCik}`,
          );
          const companyName = config.companyName || entry.title;
          if (subResponse && subResponse.ok) {
            const subData = await subResponse.json() as SecSubmissionsResponse;
            return {
              cik: paddedCik,
              ticker: subData.tickers?.[0] ?? config.ticker!,
              companyName: subData.name || companyName,
            };
          }
          // Even if submissions fail, we have enough to proceed
          return { cik: paddedCik, ticker: config.ticker!, companyName };
        }

        logger.warn(`[sec-edgar] Ticker "${config.ticker}" not found in SEC database.`);
      }
    }

    // ── Path 3: Company name only — cannot resolve without a CIK ──
    if (config.companyName && !config.cik && !config.ticker) {
      logger.warn(
        `[sec-edgar] Only companyName provided. SEC EDGAR requires a CIK or ticker for direct lookup. Try providing a ticker symbol.`,
      );
    }

    return null;
  }

  // ── Fetch Submissions ────────────────────────────────────────

  /**
   * Fetch the company's submissions from SEC EDGAR and filter by
   * filing type and date range.
   */
  private async fetchSubmissions(
    cik: string,
    config: SecEdgarConfig,
  ): Promise<SecFiling[] | null> {
    const response = await secFetch(SEC_API.submissions(cik), `submissions for CIK ${cik}`);
    if (!response || !response.ok) {
      logger.error(`[sec-edgar] Failed to fetch submissions for CIK ${cik}. Status: ${response?.status ?? 'no response'}`);
      return null;
    }

    const data = await response.json() as SecSubmissionsResponse;
    const allFilings = data.filings?.recent ?? [];

    const startDate = new Date(config.startDate);
    const endDate = new Date(config.endDate);
    const filingTypeSet = new Set(config.filingTypes.map((t) => t.toUpperCase()));

    const filtered = allFilings.filter((filing) => {
      // Filter by form type
      const normalizedForm = filing.form.toUpperCase();
      // DEF 14A is sometimes stored as "DEF 14A" with a space
      const normalizedForMatch = normalizedForm.replace(/\s+/g, '');
      if (!filingTypeSet.has(normalizedForm) && !filingTypeSet.has(normalizedForMatch)) {
        return false;
      }

      // Filter by date range
      const filingDate = new Date(filing.filingDate);
      if (filingDate < startDate || filingDate > endDate) {
        return false;
      }

      return true;
    });

    // Sort by filing date descending (most recent first)
    filtered.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());

    logger.info(
      `[sec-edgar] Filtered ${filtered.length} filings out of ${allFilings.length} total for CIK ${cik}.`,
    );

    return filtered;
  }

  // ── Fetch and Parse a Single Filing ──────────────────────────

  /**
   * Fetch the primary document for a filing and convert it into
   * a RawIntelligenceObject.
   */
  private async fetchAndParseFiling(
    filing: SecFiling,
    cik: string,
    ticker: string | null,
    companyName: string,
  ): Promise<RawIntelligenceObject | null> {
    const accessionStripped = stripAccessionDashes(filing.accessionNumber);
    const docUrl = SEC_API.filingDocument(cik, accessionStripped, filing.primaryDocument);

    const response = await secFetch(docUrl, `filing ${filing.accessionNumber} (${filing.form})`);
    if (!response || !response.ok) {
      logger.warn(`[sec-edgar] Could not fetch filing document: ${docUrl} (status: ${response?.status ?? 'no response'})`);
      return null;
    }

    const rawText = await response.text();

    // Convert filing URL to the HTML viewer URL for sourceUrl
    const accessionNoDashes = accessionStripped;
    const viewerUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${filing.primaryDocument}`;

    // Extract and parse content based on filing type
    const cleanedText = this.cleanFilingText(rawText);
    const content = cleanedText.slice(0, MAX_CONTENT_LENGTH);

    const formType = filing.form.toUpperCase().replace(/\s+/g, '');
    const extractedFields = this.extractFields(formType, cleanedText);

    // Build items array from the SEC "items" field (e.g. "1, 2, 3")
    const items = filing.items
      ? filing.items.split(',').map((i) => i.trim()).filter(Boolean)
      : [];

    // Determine knowledge category
    const category = this.mapFormToCategory(formType);

    const title = `${companyName} ${filing.form} (${filing.filingDate})`;

    return {
      companyIdentifier: companyName,
      content,
      summary: title,
      sourceUrl: viewerUrl,
      capturedAt: new Date(filing.filingDate),
      category,
      metadata: {
        id: `sec-${filing.accessionNumber}`,
        type: 'sec_filing',
        source: 'SEC EDGAR',
        formType: filing.form,
        filingDate: filing.filingDate,
        reportDate: filing.reportDate,
        cik,
        ticker,
        companyName,
        accessionNumber: filing.accessionNumber,
        items,
        extractedFields,
        confidence: SEC_CONFIDENCE,
        sourceReliability: SEC_SOURCE_RELIABILITY,
        provider: 'sec_edgar',
      },
    };
  }

  // ── Text Processing ───────────────────────────────────────────

  /**
   * Clean raw SEC filing text by removing excessive HTML/XML tags,
   * XBRL artifacts, and normalizing whitespace.
   */
  private cleanFilingText(rawText: string): string {
    let text = rawText;

    // Remove XML/HTML tags but keep their text content
    text = text.replace(/<[^>]+>/g, ' ');

    // Remove XBRL/inline XBRL context blocks (iix namespace)
    text = text.replace(/<ix:[\s\S]*?<\/ix:[^>]+>/g, ' ');

    // Remove HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#\d+;/g, ' ');
    text = text.replace(/&[a-zA-Z]+;/g, ' ');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Remove SEC header boilerplate (first ~20 lines of the submission header)
    // The SEC submission header ends with the <DOCUMENT> tag which we already stripped

    return text;
  }

  // ── Field Extraction ──────────────────────────────────────────

  /**
   * Extract key financial metrics and data points from filing text
   * based on the filing type.
   */
  private extractFields(
    formType: string,
    text: string,
  ): Record<string, unknown> {
    switch (formType) {
      case '10-K':
        return this.extract10KFields(text);
      case '10-Q':
        return this.extract10QFields(text);
      case '8-K':
        return this.extract8KFields(text);
      case 'DEF14A':
        return this.extractDEF14AFields(text);
      default:
        return {};
    }
  }

  /**
   * Extract key financial metrics from 10-K annual reports.
   * Targets: revenue, net income, total assets, total liabilities,
   * earnings per share (EPS), cash and equivalents.
   */
  private extract10KFields(text: string): Record<string, unknown> {
    const fields: Record<string, string | null> = {};

    fields.revenue = this.extractMonetaryValue(
      text,
      /(?:total\s+)?(?:net\s+)?(?:revenues?|sales|total\s+net\s+sales)\s*[:\s]+\$?([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand)?/i,
    );

    fields.netIncome = this.extractMonetaryValue(
      text,
      /(?:net\s+(?:income|loss|earnings)|net\s+income\s+(?:loss|available|attributable))/i,
    );

    fields.totalAssets = this.extractMonetaryValue(
      text,
      /(?:total\s+)?assets?(?::|\s+\$)/i,
    );

    fields.totalLiabilities = this.extractMonetaryValue(
      text,
      /(?:total\s+)?liabilities?(?::|\s+\$)/i,
    );

    fields.earningsPerShare = this.extractMonetaryValue(
      text,
      /(?:earnings|EPS|earning)\s+per\s+share.*?\$?([\d,.]+(?:\s*\(\s*[\d,.]+\s*\))?)/i,
    );

    fields.cashAndEquivalents = this.extractMonetaryValue(
      text,
      /(?:cash\s+and\s+cash\s+equivalents?|cash\s+&\s+equivalents?)/i,
    );

    fields.operatingIncome = this.extractMonetaryValue(
      text,
      /(?:operating\s+income|income\s+from\s+operations?)/i,
    );

    // Clean up nulls
    return Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null),
    );
  }

  /**
   * Extract key quarterly financial metrics from 10-Q reports.
   */
  private extract10QFields(text: string): Record<string, unknown> {
    const fields: Record<string, string | null> = {};

    fields.revenue = this.extractMonetaryValue(
      text,
      /(?:total\s+)?(?:net\s+)?(?:revenues?|sales|total\s+net\s+sales)\s*[:\s]+\$?([\d,]+(?:\.\d+)?)\s*(?:million|billion|thousand)?/i,
    );

    fields.netIncome = this.extractMonetaryValue(
      text,
      /(?:net\s+(?:income|loss|earnings))/i,
    );

    fields.earningsPerShare = this.extractMonetaryValue(
      text,
      /(?:earnings|EPS|earning)\s+per\s+share.*?\$?([\d,.]+)/i,
    );

    fields.grossProfit = this.extractMonetaryValue(
      text,
      /(?:gross\s+(?:profit|margin|loss))/i,
    );

    fields.operatingIncome = this.extractMonetaryValue(
      text,
      /(?:operating\s+income|income\s+from\s+operations?)/i,
    );

    return Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null),
    );
  }

  /**
   * Extract key events and disclosures from 8-K current reports.
   * 8-Ks cover: executive changes, M&A, bankruptcy, earnings results,
   * regulatory events, etc.
   */
  private extract8KFields(text: string): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    // Detect 8-K item sections (e.g. "Item 1.01", "Item 2.01")
    const itemRegex = /Item\s+(\d+\.\d{2})\s+[-–—]\s*(.{5,100}?)(?=Item\s+\d+\.\d{2}|$)/gi;
    const items: Record<string, string> = {};
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(text)) !== null) {
      const itemNumber = itemMatch[1]!;
      const itemTitle = itemMatch[2]!.trim().split(/[.\n]/)[0]!.trim();
      if (itemTitle.length > 3) {
        items[itemNumber] = itemTitle;
      }
    }

    if (Object.keys(items).length > 0) {
      fields.reportedItems = items;
    }

    // Detect common 8-K event types
    const eventPatterns: [string, RegExp][] = [
      ['entryIntoMaterialAgreement', /entry\s+into\s+a\s+material\s+(?:definitive\s+)?agreement/i],
      ['terminationOfMaterialAgreement', /termination\s+of\s+a\s+material\s+(?:definitive\s+)?agreement/i],
      ['bankruptcy', /bankruptcy|receivership/i],
      ['completionOfAcquisition', /completion\s+of\s+(?:acquisition|disposition)/i],
      ['departureOfDirectors', /departure\s+of\s+(?:directors|officers)/i],
      ['appointmentOfDirectors', /appointment\s+of\s+(?:directors|officers)/i],
      ['changeInControl', /change\s+in\s+control/i],
      ['nonRelianceOnFinancialStatements', /non-?reliance\s+on\s+financial\s+statements/i],
      ['resultsOfOperations', /results\s+of\s+operations/i],
      ['financialStatementsAndExhibits', /financial\s+statements\s+and\s+exhibits/i],
      ['regulationFD', /regulation\s+FD\s+disclosure/i],
    ];

    const detectedEvents: string[] = [];
    for (const [eventName, pattern] of eventPatterns) {
      if (pattern.test(text)) {
        detectedEvents.push(eventName);
      }
    }

    if (detectedEvents.length > 0) {
      fields.detectedEvents = detectedEvents;
    }

    return fields;
  }

  /**
   * Extract proxy voting details and executive compensation from DEF14A.
   */
  private extractDEF14AFields(text: string): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    // Detect executive compensation table — look for named executives
    const namedExecutiveMatch = text.match(
      /(?:named\s+executive\s+officers?|NEO)[^.]{0,500}?\$?([\d,]+(?:\.\d+)?)/i,
    );
    if (namedExecutiveMatch) {
      fields.executiveCompensationMentioned = true;
    }

    // Detect board of directors section
    if (/board\s+of\s+directors/i.test(text)) {
      fields.boardOfDirectorsSection = true;
    }

    // Detect shareholder proposals
    const proposalRegex = /(?:proposal|proposals?)\s+(?:no\.?|\d+)[^.]{0,200}/gi;
    const proposals: string[] = [];
    let proposalMatch: RegExpExecArray | null;

    while ((proposalMatch = proposalRegex.exec(text)) !== null) {
      const proposal = proposalMatch[0]!.trim();
      if (proposal.length > 10 && proposals.length < 10) {
        proposals.push(proposal);
      }
    }

    if (proposals.length > 0) {
      fields.shareholderProposals = proposals;
    }

    // Detect voting matters
    const votingMatters: string[] = [];
    if (/election\s+of\s+directors/i.test(text)) votingMatters.push('election_of_directors');
    if (/ratif(?:ication|y)\s+of\s+(?:independent\s+)?auditor/i.test(text)) votingMatters.push('ratification_of_auditor');
    if (/executive\s+compensation/i.test(text)) votingMatters.push('executive_compensation');
    if (/say[\s-]?on[\s-]?pay/i.test(text)) votingMatters.push('say_on_pay');

    if (votingMatters.length > 0) {
      fields.votingMatters = votingMatters;
    }

    return fields;
  }

  /**
   * Extract a monetary value near a matching regex pattern.
   * Scans forward from the match to find the first dollar-amount-like value.
   * Returns the matched string or null.
   */
  private extractMonetaryValue(text: string, pattern: RegExp): string | null {
    // First, try the direct pattern if it has a capture group
    const directMatch = text.match(pattern);
    if (directMatch) {
      // Look for a dollar amount in the ~200 chars after the match
      const matchEnd = directMatch.index! + directMatch[0]!.length;
      const afterText = text.slice(matchEnd, matchEnd + 200);

      // Find dollar amounts in the vicinity
      const dollarMatch = afterText.match(/\$\s*([\d,]+(?:\.\d+)?)/);
      if (dollarMatch) {
        const raw = dollarMatch[1]!;
        // Check for multipliers (million, billion, thousand)
        const multiplierMatch = afterText.match(/(million|billion|thousand)/i);
        let value = raw.replace(/,/g, '');
        if (multiplierMatch) {
          const mult = multiplierMatch[1]!.toLowerCase();
          if (mult === 'billion') value = `${parseFloat(value)}B`;
          else if (mult === 'million') value = `${parseFloat(value)}M`;
          else if (mult === 'thousand') value = `${parseFloat(value)}K`;
        }
        return `$${value}`;
      }
    }

    return null;
  }

  // ── Category Mapping ──────────────────────────────────────────

  /**
   * Map SEC filing form types to DeepMindQ knowledge categories.
   */
  private mapFormToCategory(formType: string): string {
    switch (formType) {
      case '10-K':
        return 'Market'; // Annual comprehensive data → market intelligence
      case '10-Q':
        return 'Market'; // Quarterly financial data
      case '8-K':
        return 'Strategy'; // Material events → strategic intelligence
      case 'DEF14A':
        return 'Leadership'; // Proxy → leadership & governance
      default:
        return 'Market';
    }
  }

  // ── Config Parsing ────────────────────────────────────────────

  /**
   * Parse and validate the raw config into a typed SecEdgarConfig
   * with sensible defaults applied.
   */
  private parseConfig(config: Record<string, unknown>): SecEdgarConfig {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return {
      cik: typeof config.cik === 'string' ? config.cik : undefined,
      ticker: typeof config.ticker === 'string' ? config.ticker : undefined,
      companyName: typeof config.companyName === 'string' ? config.companyName : undefined,
      filingTypes: Array.isArray(config.filingTypes)
        ? (config.filingTypes as string[])
        : [...DEFAULT_FILING_TYPES],
      startDate: typeof config.startDate === 'string' ? config.startDate : oneYearAgo.toISOString().split('T')[0]!,
      endDate: typeof config.endDate === 'string' ? config.endDate : now.toISOString().split('T')[0]!,
      maxFilings: typeof config.maxFilings === 'number' ? config.maxFilings : DEFAULT_MAX_FILINGS,
    };
  }

  // ── Feature Flag ──────────────────────────────────────────────

  /**
   * Check if the SEC EDGAR connector is enabled via the feature flag.
   * Defaults to false for safety — SEC API calls should be opt-in.
   */
  private isFeatureEnabled(): boolean {
    return process.env[FEATURE_FLAG] === 'true';
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const secEdgarConnector = new SecEdgarConnector();
