/**
 * DeepMindQ — Multi-Provider Search Resilience
 *
 * Provides a fallback chain for search operations:
 *   primary search provider → web-reader → in-memory cache
 *
 * When one provider fails, the module transparently falls back to the next
 * in the chain. All operations are non-throwing — they always return results,
 * even if those results are an empty array (degraded mode).
 *
 * Key features:
 *  - Provider chain pattern with automatic fallback
 *  - Circuit breaker per provider (configurable failure threshold + cooldown)
 *  - Latency tracking per provider
 *  - In-memory LRU cache integration (max 1000 entries, 1-hour TTL default)
 *  - Feature-flag gated via ENABLE_SEARCH_FALLBACK env var
 *  - Comprehensive metrics and observability
 *
 * Usage:
 *   import { searchWithFallback, getFallbackStatus } from '@/lib/search-provider-fallback';
 *
 *   const result = await searchWithFallback('Acme Corp funding round');
 *   console.log(result.results, result.providerUsed, result.isDegraded);
 */

import { logger } from '@/lib/logger';

// ──────────────────────────────────────────────
// Feature Flag
// ──────────────────────────────────────────────

const SEARCH_FALLBACK_ENABLED = process.env.ENABLE_SEARCH_FALLBACK !== 'false';

// ──────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────

/**
 * Options passed to individual search providers.
 */
export interface SearchOptions {
  /** Maximum number of results to return. Default: 10 */
  maxResults?: number;
  /** Per-provider timeout in milliseconds. Default: 5000 */
  timeoutMs?: number;
  /** Optional source type filter (e.g. "news", "web", "company") */
  sourceType?: string;
  /** Optional company context for scoped searches */
  companyId?: string;
}

/**
 * A single search result returned by any provider.
 */
export interface SearchResult {
  /** Title of the result */
  title: string;
  /** Text snippet / summary */
  snippet: string;
  /** URL of the source */
  url: string;
  /** Name of the provider that produced this result */
  source: string;
  /** Relevance score between 0 and 1 */
  relevanceScore: number;
  /** ISO 8601 timestamp when the result was fetched */
  fetchedAt: string;
  /** True if this result was served from the in-memory cache */
  isFromCache: boolean;
}

/**
 * Configuration for the fallback chain.
 */
export interface SearchFallbackConfig {
  /** Ordered provider names to attempt. Default: ['primary', 'web_reader', 'cache'] */
  providers?: string[];
  /** Hard ceiling for the entire fallback chain in ms. Default: 15000 */
  maxTotalTimeoutMs?: number;
  /** Time-to-live for cached search results in ms. Default: 3600000 (1 hour) */
  cacheTtlMs?: number;
  /** Consecutive failures before a provider's circuit opens. Default: 3 */
  circuitBreakerThreshold?: number;
  /** How long an open circuit stays open before entering half-open. Default: 300000 (5 min) */
  circuitBreakerResetMs?: number;
}

/**
 * Contract that every search provider must satisfy.
 */
export interface SearchProvider {
  /** Unique provider identifier (e.g. "primary", "web_reader", "cache") */
  name: string;
  /** Lower value = higher priority. Used to order providers when not explicitly configured. */
  priority: number;
  /** Execute a search. Must never throw. */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Whether the provider's circuit breaker currently allows attempts. */
  isHealthy(): boolean;
  /** Rolling average latency of recent calls in ms. */
  getLatencyMs(): number;
  /** Force-reset the provider's circuit breaker to closed state. */
  resetCircuit(): void;
}

/**
 * Enriched result returned by `searchWithFallback`.
 */
export interface SearchFallbackResult {
  /** The actual search results (may be empty in fully degraded mode). */
  results: SearchResult[];
  /** Name of the provider that ultimately returned results. */
  providerUsed: string;
  /** Ordered log of every provider that was attempted. */
  providersAttempted: Array<{
    name: string;
    success: boolean;
    latencyMs: number;
    error?: string;
  }>;
  /** Total wall-clock time for the entire fallback chain in ms. */
  totalLatencyMs: number;
  /** True if results came from cache (fast path). */
  isFromCache: boolean;
  /** True if any fallback was triggered (i.e. the primary did not return results). */
  isDegraded: boolean;
}

/**
 * Status snapshot of the fallback chain.
 */
export interface FallbackStatus {
  enabled: boolean;
  providers: Array<{
    name: string;
    healthy: boolean;
    circuitState: string;
    failureCount: number;
    avgLatencyMs: number;
  }>;
  cache: {
    size: number;
    hitRate: number;
  };
  metrics: SearchMetrics;
}

/**
 * Cumulative metrics for the search fallback system.
 */
export interface SearchMetrics {
  totalSearches: number;
  primaryHits: number;
  webReaderHits: number;
  cacheHits: number;
  fullyDegradedCount: number;
  avgTotalLatencyMs: number;
  p95TotalLatencyMs: number;
}

// ──────────────────────────────────────────────
// Circuit Breaker
// ──────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Per-provider circuit breaker.
 *
 * State machine:
 *   closed  → (failures >= threshold) → open
 *   open    → (resetMs elapsed)      → half_open
 *   half_open → (success)            → closed
 *   half_open → (failure)            → open
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureAt: number | null = null;
  private state: CircuitState = 'closed';
  private readonly threshold: number;
  private readonly resetMs: number;

  constructor(threshold = 3, resetMs = 300000) {
    this.threshold = threshold;
    this.resetMs = resetMs;
  }

  /** Record a successful call — resets failures if in half_open, promoting to closed. */
  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.state = 'closed';
    }
    this.failures = 0;
    this.lastFailureAt = null;
  }

  /** Record a failed call — may trip the circuit to open. */
  recordFailure(): void {
    this.failures++;
    this.lastFailureAt = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  /** Whether the circuit currently allows a call through. */
  canAttempt(): boolean {
    if (this.state === 'closed') {
      return true;
    }
    if (this.state === 'open') {
      // Check if cooldown has elapsed → transition to half_open
      if (
        this.lastFailureAt !== null &&
        Date.now() - this.lastFailureAt >= this.resetMs
      ) {
        this.state = 'half_open';
        return true;
      }
      return false;
    }
    // half_open allows one attempt
    return true;
  }

  /** Current circuit state. */
  getState(): CircuitState {
    // Transparently transition open → half_open if cooldown has elapsed
    if (
      this.state === 'open' &&
      this.lastFailureAt !== null &&
      Date.now() - this.lastFailureAt >= this.resetMs
    ) {
      this.state = 'half_open';
    }
    return this.state;
  }

  /** Number of consecutive failures recorded. */
  getFailureCount(): number {
    return this.failures;
  }

  /** Force-reset the circuit to closed (manual recovery). */
  reset(): void {
    this.failures = 0;
    this.lastFailureAt = null;
    this.state = 'closed';
  }
}

// ──────────────────────────────────────────────
// In-Memory LRU Search Cache
// ──────────────────────────────────────────────

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
}

/**
 * Thread-safe (single-process) in-memory LRU cache for search results.
 * Entries are evicted in least-recently-used order when capacity is reached,
 * and also when their TTL expires.
 */
export class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  // Simple hit/miss tracking for observability
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 1000, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Build a normalised cache key from a query and options.
   * Keys are case-insensitive and include sourceType/companyId for scoping.
   */
  static buildKey(query: string, options?: SearchOptions): string {
    const parts = [
      query.toLowerCase().trim(),
      options?.sourceType ?? '',
      options?.companyId ?? '',
    ];
    return parts.join('::');
  }

  /**
   * Retrieve cached results. Returns null on miss or TTL expiry.
   */
  get(key: string): SearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.results;
  }

  /**
   * Store results in the cache. Evicts LRU entry if at capacity.
   */
  set(key: string, results: SearchResult[]): void {
    // Evict LRU if at capacity and key is new
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove all cached entries and reset hit/miss counters.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Cache usage statistics.
   */
  stats(): { size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ──────────────────────────────────────────────
// Latency Tracker (per-provider)
// ──────────────────────────────────────────────

class LatencyTracker {
  private samples: number[] = [];
  private readonly maxSamples = 50;

  /** Record a latency sample (in ms). */
  record(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /** Rolling average latency in ms. Returns 0 if no samples. */
  average(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  /** Reset all samples. */
  reset(): void {
    this.samples = [];
  }
}

// ──────────────────────────────────────────────
// Built-In Providers
// ──────────────────────────────────────────────

/**
 * Primary search provider — calls an external search API.
 *
 * In production this could be Google Custom Search, Bing API, SerpAPI, etc.
 * The endpoint is read from the `SEARCH_API_URL` environment variable.
 * If not configured, the provider returns empty results (simulating failure → triggers fallback).
 */
export class PrimarySearchProvider implements SearchProvider {
  name = 'primary';
  priority = 1;

  private readonly apiUrl: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly circuit: CircuitBreaker;
  private readonly latency: LatencyTracker;

  constructor(config?: SearchFallbackConfig) {
    this.apiUrl = process.env.SEARCH_API_URL;
    this.apiKey = process.env.SEARCH_API_KEY;
    this.circuit = new CircuitBreaker(
      config?.circuitBreakerThreshold,
      config?.circuitBreakerResetMs,
    );
    this.latency = new LatencyTracker();
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const timeoutMs = options?.timeoutMs ?? 5000;
    const maxResults = options?.maxResults ?? 10;

    // If no API URL is configured, return empty (triggers fallback)
    if (!this.apiUrl) {
      logger.debug('search.primary', {
        message: 'No SEARCH_API_URL configured — returning empty results',
        query,
      });
      return [];
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const start = Date.now();
      const url = new URL(this.apiUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('num', String(maxResults));
      if (this.apiKey) {
        url.searchParams.set('key', this.apiKey);
      }
      if (options?.sourceType) {
        url.searchParams.set('source', options.sourceType);
      }

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      });
      clearTimeout(timer);

      const elapsed = Date.now() - start;
      this.latency.record(elapsed);

      if (!response.ok) {
        this.circuit.recordFailure();
        logger.warn('search.primary', {
          message: 'Search API returned non-OK status',
          status: response.status,
          query,
          elapsed,
        });
        return [];
      }

      // Attempt to parse response. Different APIs have different shapes.
      // We try a few common patterns: items[], results[], data[].
      const body = await response.json().catch(() => null);
      const rawItems =
        body?.items ?? body?.results ?? body?.data ?? body?.hits ?? [];

      const results: SearchResult[] = rawItems
        .slice(0, maxResults)
        .map((item: Record<string, unknown>, idx: number) => ({
          title: String(item.title ?? item.name ?? 'Untitled'),
          snippet: String(
            item.snippet ?? item.description ?? item.text ?? '',
          ),
          url: String(item.url ?? item.link ?? item.href ?? ''),
          source: this.name,
          relevanceScore:
            typeof item.relevanceScore === 'number'
              ? item.relevanceScore
              : Math.max(0, 1 - idx / maxResults),
          fetchedAt: new Date().toISOString(),
          isFromCache: false,
        }));

      this.circuit.recordSuccess();
      return results;
    } catch (err: unknown) {
      this.circuit.recordFailure();
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError';
      logger.warn('search.primary', {
        message: isTimeout
          ? 'Primary search timed out'
          : 'Primary search failed',
        error: message,
        query,
      });
      return [];
    }
  }

  isHealthy(): boolean {
    return this.circuit.canAttempt();
  }

  getLatencyMs(): number {
    return Math.round(this.latency.average());
  }

  resetCircuit(): void {
    this.circuit.reset();
    this.latency.reset();
  }

  /** Expose circuit breaker for status reporting. */
  getCircuitState(): string {
    return this.circuit.getState();
  }

  getFailureCount(): number {
    return this.circuit.getFailureCount();
  }
}

/**
 * Web-reader provider — fetches content directly from URLs without needing an API key.
 *
 * This is a slower, scraping-based approach. It constructs search-like URLs (e.g.
 * DuckDuckGo HTML pages) and attempts to extract meaningful content.
 *
 * In a real implementation this could use a headless browser or dedicated scraping
 * service. For now it returns cached results when available, otherwise empty.
 */
export class WebReaderProvider implements SearchProvider {
  name = 'web_reader';
  priority = 2;

  private readonly circuit: CircuitBreaker;
  private readonly latency: LatencyTracker;

  constructor(config?: SearchFallbackConfig) {
    this.circuit = new CircuitBreaker(
      config?.circuitBreakerThreshold,
      config?.circuitBreakerResetMs,
    );
    this.latency = new LatencyTracker();
  }

  async search(_query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const timeoutMs = options?.timeoutMs ?? 5000;

    // Web-reader is a heavier approach. In production this would:
    //   1. Construct a search URL (DuckDuckGo HTML, etc.)
    //   2. Fetch and parse the HTML
    //   3. Extract relevant snippets
    //
    // For safety, we check if the caller has opted-in via env var.
    const webReaderEnabled = process.env.ENABLE_WEB_READER === 'true';

    if (!webReaderEnabled) {
      logger.debug('search.web_reader', {
        message:
          'Web-reader not enabled (set ENABLE_WEB_READER=true to activate)',
      });
      return [];
    }

    try {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Attempt DuckDuckGo lite HTML search
      const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(_query)}`;
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'DeepMindQ-SearchBot/1.0 (Intelligence Enrichment; contact@deepmindq.ai)',
        },
      });
      clearTimeout(timer);

      const elapsed = Date.now() - start;
      this.latency.record(elapsed);

      if (!response.ok) {
        this.circuit.recordFailure();
        logger.warn('search.web_reader', {
          message: 'Web-reader HTTP request failed',
          status: response.status,
        });
        return [];
      }

      // Parse the DuckDuckGo lite HTML response
      const html = await response.text();
      const results = this.parseDuckDuckGoLite(html, _query, options?.maxResults ?? 10);

      this.circuit.recordSuccess();
      return results;
    } catch (err: unknown) {
      this.circuit.recordFailure();
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('search.web_reader', {
        message: 'Web-reader search failed',
        error: message,
        query: _query,
      });
      return [];
    }
  }

  /**
   * Basic HTML parser for DuckDuckGo lite results.
   * DuckDuckGo lite returns a simple table-based layout.
   * This extracts links and surrounding text as search results.
   */
  private parseDuckDuckGoLite(
    html: string,
    _query: string,
    maxResults: number,
  ): SearchResult[] {
    const results: SearchResult[] = [];
    // Match result links in DuckDuckGo lite HTML format
    // Pattern: <a class="result-link" href="...">title</a>
    const linkPattern =
      /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    // Pattern for snippets: typically in the next <td> with class "result-snippet"
    const snippetPattern =
      /<td[^>]+class="result-snippet"[^>]*>(.*?)<\/td>/gi;

    const links: Array<{ url: string; title: string }> = [];
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkPattern.exec(html)) !== null) {
      links.push({ url: linkMatch[1], title: linkMatch[2] });
    }

    const snippets: string[] = [];
    let snippetMatch: RegExpExecArray | null;
    while ((snippetMatch = snippetPattern.exec(html)) !== null) {
      snippets.push(
        snippetMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim(),
      );
    }

    const count = Math.min(links.length, maxResults);
    for (let i = 0; i < count; i++) {
      results.push({
        title: links[i].title,
        snippet: snippets[i] ?? '',
        url: links[i].url,
        source: this.name,
        relevanceScore: Math.max(0, 1 - i / count),
        fetchedAt: new Date().toISOString(),
        isFromCache: false,
      });
    }

    return results;
  }

  isHealthy(): boolean {
    return this.circuit.canAttempt();
  }

  getLatencyMs(): number {
    return Math.round(this.latency.average());
  }

  resetCircuit(): void {
    this.circuit.reset();
    this.latency.reset();
  }

  getCircuitState(): string {
    return this.circuit.getState();
  }

  getFailureCount(): number {
    return this.circuit.getFailureCount();
  }
}

/**
 * Cache provider — returns previously cached search results.
 *
 * This provider never "fails" in the traditional sense. It simply returns
 * empty results when no cache entry exists. It is always the last provider
 * in the fallback chain.
 */
export class CacheProvider implements SearchProvider {
  name = 'cache';
  priority = 3;

  private readonly cache: SearchCache;
  private readonly latency: LatencyTracker;

  /**
   * @param cache Shared SearchCache instance (populated by the fallback manager after successful primary/web_reader calls).
   */
  constructor(cache: SearchCache, config?: SearchFallbackConfig) {
    this.cache = cache;
    this.latency = new LatencyTracker();
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const start = Date.now();
    const key = SearchCache.buildKey(query, options);
    const results = this.cache.get(key);
    const elapsed = Date.now() - start;
    this.latency.record(elapsed);

    if (results) {
      logger.debug('search.cache', {
        message: 'Cache hit',
        query,
        resultCount: results.length,
        elapsed,
      });
      return results;
    }

    logger.debug('search.cache', {
      message: 'Cache miss',
      query,
    });
    return [];
  }

  /**
   * The cache provider never fails — it always returns results (possibly empty).
   */
  isHealthy(): boolean {
    return true;
  }

  getLatencyMs(): number {
    return Math.round(this.latency.average());
  }

  resetCircuit(): void {
    // Cache has no circuit breaker to reset
    this.latency.reset();
  }

  getCircuitState(): string {
    return 'closed';
  }

  getFailureCount(): number {
    return 0;
  }
}

// ──────────────────────────────────────────────
// Fallback Manager (internal)
// ──────────────────────────────────────────────

interface ProviderRecord {
  provider: SearchProvider;
  getCircuitState: () => string;
  getFailureCount: () => number;
}

/** Global latency samples for P95 computation. */
class TotalLatencyTracker {
  private samples: number[] = [];
  private readonly maxSamples = 200;

  record(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  average(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  p95(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }

  reset(): void {
    this.samples = [];
  }
}

/**
 * Internal singleton that manages the provider registry, metrics, and cache.
 * Instantiated once at module level — shared across all callers.
 */
class FallbackManager {
  private providers = new Map<string, ProviderRecord>();
  private cache: SearchCache;
  private config: SearchFallbackConfig;
  private totalLatency = new TotalLatencyTracker();

  // Cumulative metrics
  private totalSearches = 0;
  private primaryHits = 0;
  private webReaderHits = 0;
  private cacheHits = 0;
  private fullyDegradedCount = 0;

  constructor() {
    this.config = {};
    this.cache = new SearchCache(1000, 3600000);

    // Register built-in providers
    this.registerProvider(new PrimarySearchProvider(this.config));
    this.registerProvider(new WebReaderProvider(this.config));
    this.registerProvider(new CacheProvider(this.cache, this.config));
  }

  registerProvider(provider: SearchProvider): void {
    // Determine if the provider has extended methods
    const getCircuitState =
      (provider as unknown as Record<string, unknown>).getCircuitState as
        | (() => string)
        | undefined;
    const getFailureCount =
      (provider as unknown as Record<string, unknown>).getFailureCount as
        | (() => number)
        | undefined;

    this.providers.set(provider.name, {
      provider,
      getCircuitState: getCircuitState
        ? getCircuitState.bind(provider)
        : () => 'unknown',
      getFailureCount: getFailureCount
        ? getFailureCount.bind(provider)
        : () => 0,
    });

    logger.info('search.fallback', {
      message: 'Provider registered',
      provider: provider.name,
      priority: provider.priority,
    });
  }

  async search(
    query: string,
    options?: SearchOptions,
    config?: SearchFallbackConfig,
  ): Promise<SearchFallbackResult> {
    const start = Date.now();

    // Feature flag gate
    if (!SEARCH_FALLBACK_ENABLED) {
      logger.debug('search.fallback', {
        message: 'Search fallback disabled (ENABLE_SEARCH_FALLBACK=false)',
      });
      return {
        results: [],
        providerUsed: 'none',
        providersAttempted: [],
        totalLatencyMs: 0,
        isFromCache: false,
        isDegraded: false,
      };
    }

    const effectiveConfig: SearchFallbackConfig = {
      maxTotalTimeoutMs: 15000,
      cacheTtlMs: 3600000,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 300000,
      ...this.config,
      ...config,
    };

    const providerNames = effectiveConfig.providers ?? [
      'primary',
      'web_reader',
      'cache',
    ];

    // Check cache first as a fast path (before trying the full chain)
    const cacheKey = SearchCache.buildKey(query, options);
    const cachedResults = this.cache.get(cacheKey);
    if (cachedResults && cachedResults.length > 0) {
      const elapsed = Date.now() - start;
      this.totalLatency.record(elapsed);
      this.totalSearches++;
      this.cacheHits++;
      return {
        results: cachedResults,
        providerUsed: 'cache',
        providersAttempted: [
          {
            name: 'cache',
            success: true,
            latencyMs: elapsed,
          },
        ],
        totalLatencyMs: elapsed,
        isFromCache: true,
        isDegraded: false,
      };
    }

    // Walk the provider chain
    const providersAttempted: SearchFallbackResult['providersAttempted'] = [];
    let results: SearchResult[] = [];
    let providerUsed = 'none';
    let isDegraded = false;

    for (const providerName of providerNames) {
      const record = this.providers.get(providerName);
      if (!record) {
        providersAttempted.push({
          name: providerName,
          success: false,
          latencyMs: 0,
          error: 'Provider not registered',
        });
        continue;
      }

      const { provider } = record;

      // Skip unhealthy providers (circuit breaker open)
      if (!provider.isHealthy()) {
        providersAttempted.push({
          name: providerName,
          success: false,
          latencyMs: 0,
          error: `Circuit breaker open (${record.getCircuitState()})`,
        });
        isDegraded = true;
        continue;
      }

      // Check total timeout budget
      const elapsed = Date.now() - start;
      const remainingBudget = effectiveConfig.maxTotalTimeoutMs! - elapsed;
      if (remainingBudget <= 0) {
        providersAttempted.push({
          name: providerName,
          success: false,
          latencyMs: 0,
          error: 'Total timeout budget exceeded',
        });
        isDegraded = true;
        break;
      }

      // Execute search with remaining budget as timeout cap
      const providerStart = Date.now();
      let providerResults: SearchResult[];
      let providerError: string | undefined;

      try {
        const effectiveOptions: SearchOptions = {
          ...options,
          timeoutMs: Math.min(
            options?.timeoutMs ?? 5000,
            remainingBudget,
          ),
        };
        providerResults = await Promise.race([
          provider.search(query, effectiveOptions),
          new Promise<SearchResult[]>((resolve) =>
            setTimeout(() => resolve([]), remainingBudget),
          ),
        ]);
      } catch (err: unknown) {
        providerResults = [];
        providerError = err instanceof Error ? err.message : String(err);
        logger.warn('search.fallback', {
          message: `Provider ${providerName} threw unexpectedly`,
          error: providerError,
        });
      }

      const providerElapsed = Date.now() - providerStart;

      providersAttempted.push({
        name: providerName,
        success: providerResults.length > 0,
        latencyMs: providerElapsed,
        error: providerError,
      });

      if (providerResults.length > 0) {
        results = providerResults;
        providerUsed = providerName;
        isDegraded = providerName !== providerNames[0];

        // Populate cache for future fast-path lookups
        if (providerName !== 'cache') {
          const ttl = effectiveConfig.cacheTtlMs ?? 3600000;
          this.cache.set(cacheKey, results);
        }

        // Update metrics
        if (providerName === 'primary') this.primaryHits++;
        else if (providerName === 'web_reader') this.webReaderHits++;
        else if (providerName === 'cache') this.cacheHits++;

        break;
      }
    }

    // If nothing returned results, record as fully degraded
    if (results.length === 0) {
      this.fullyDegradedCount++;
      isDegraded = true;
      logger.warn('search.fallback', {
        message: 'All providers failed — returning empty results',
        query,
        providersAttempted: providersAttempted.map((p) => ({
          name: p.name,
          success: p.success,
          error: p.error,
        })),
      });
    }

    const totalLatencyMs = Date.now() - start;
    this.totalLatency.record(totalLatencyMs);
    this.totalSearches++;

    return {
      results,
      providerUsed,
      providersAttempted,
      totalLatencyMs,
      isFromCache: providerUsed === 'cache',
      isDegraded,
    };
  }

  getStatus(): FallbackStatus {
    const providerStatus = Array.from(this.providers.entries()).map(
      ([name, record]) => ({
        name,
        healthy: record.provider.isHealthy(),
        circuitState: record.getCircuitState(),
        failureCount: record.getFailureCount(),
        avgLatencyMs: record.provider.getLatencyMs(),
      }),
    );

    return {
      enabled: SEARCH_FALLBACK_ENABLED,
      providers: providerStatus,
      cache: this.cache.stats(),
      metrics: this.getMetrics(),
    };
  }

  getMetrics(): SearchMetrics {
    return {
      totalSearches: this.totalSearches,
      primaryHits: this.primaryHits,
      webReaderHits: this.webReaderHits,
      cacheHits: this.cacheHits,
      fullyDegradedCount: this.fullyDegradedCount,
      avgTotalLatencyMs: Math.round(this.totalLatency.average()),
      p95TotalLatencyMs: Math.round(this.totalLatency.p95()),
    };
  }

  resetCircuitBreakers(): void {
    Array.from(this.providers.entries()).forEach(([name, record]) => {
      record.provider.resetCircuit();
      logger.info('search.fallback', {
        message: 'Circuit breaker reset',
        provider: name,
      });
    });
  }

  getCache(): SearchCache {
    return this.cache;
  }

  getProviders(): Map<string, ProviderRecord> {
    return this.providers;
  }
}

// ──────────────────────────────────────────────
// Module Singleton
// ──────────────────────────────────────────────

const manager = new FallbackManager();

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Execute a search with automatic fallback across the provider chain.
 *
 * The module first checks the in-memory cache for a fast path. If no cache hit,
 * it walks through the configured provider chain (primary → web_reader → cache)
 * until one returns results. If all providers fail, an empty result set is
 * returned (degraded mode). This function **never throws**.
 *
 * @param query - The search query string.
 * @param options - Optional search parameters (maxResults, timeoutMs, sourceType, companyId).
 * @param config - Optional override for fallback chain configuration.
 * @returns A `SearchFallbackResult` with results, provider metadata, and latency info.
 *
 * @example
 * ```ts
 * const result = await searchWithFallback('Stripe pricing', {
 *   maxResults: 5,
 *   sourceType: 'company',
 * });
 * if (result.isDegraded) {
 *   console.warn('Search is running in degraded mode');
 * }
 * for (const item of result.results) {
 *   console.log(`[${item.source}] ${item.title}`);
 * }
 * ```
 */
export async function searchWithFallback(
  query: string,
  options?: SearchOptions,
  config?: SearchFallbackConfig,
): Promise<SearchFallbackResult> {
  if (!query || typeof query !== 'string') {
    logger.warn('search.fallback', {
      message: 'Invalid query — returning empty results',
      query,
    });
    return {
      results: [],
      providerUsed: 'none',
      providersAttempted: [],
      totalLatencyMs: 0,
      isFromCache: false,
      isDegraded: false,
    };
  }
  return manager.search(query, options, config);
}

/**
 * Get the current status of the fallback chain, including per-provider health,
 * circuit breaker states, cache stats, and cumulative metrics.
 *
 * @returns A `FallbackStatus` snapshot.
 */
export function getFallbackStatus(): FallbackStatus {
  return manager.getStatus();
}

/**
 * Register a custom search provider in the fallback chain.
 *
 * The provider will be available by its `name` property and can be included
 * in the `providers` array of `SearchFallbackConfig`.
 *
 * @param provider - A `SearchProvider` implementation.
 *
 * @example
 * ```ts
 * registerProvider({
 *   name: 'bing',
 *   priority: 2,
 *   search: async (query, opts) => { ... },
 *   isHealthy: () => true,
 *   getLatencyMs: () => 120,
 *   resetCircuit: () => {},
 * });
 * ```
 */
export function registerProvider(provider: SearchProvider): void {
  manager.registerProvider(provider);
}

/**
 * Force-reset all circuit breakers to the `closed` state.
 *
 * Useful for manual recovery after a temporary outage, or in tests.
 */
export function resetCircuitBreakers(): void {
  manager.resetCircuitBreakers();
}

/**
 * Get cumulative search metrics (total searches, per-provider hit counts,
 * degradation counts, and latency percentiles).
 *
 * @returns A `SearchMetrics` snapshot.
 */
export function getSearchMetrics(): SearchMetrics {
  return manager.getMetrics();
}

/**
 * Clear the in-memory search cache. Useful for testing or when stale data
 * is a concern.
 */
export function clearSearchCache(): void {
  manager.getCache().clear();
  logger.info('search.fallback', { message: 'Search cache cleared' });
}

/**
 * Manually populate the search cache. Useful for pre-warming or
 * storing externally fetched results for later use.
 *
 * @param query - The search query to cache under.
 * @param results - The results to store.
 * @param options - Optional search options used to scope the cache key.
 */
export function warmSearchCache(
  query: string,
  results: SearchResult[],
  options?: SearchOptions,
): void {
  const key = SearchCache.buildKey(query, options);
  manager.getCache().set(key, results);
  logger.debug('search.fallback', {
    message: 'Cache warmed',
    query,
    resultCount: results.length,
  });
}

// ──────────────────────────────────────────────
// Exports for testing / advanced usage
// ──────────────────────────────────────────────

// CircuitBreaker and SearchCache are already exported inline above.
