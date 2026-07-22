/**
 * Phase 7.5 — Website Connector
 *
 * Fetches up to 5 user-configured pages per company and extracts text content.
 *
 * Config shape:
 *   {
 *     urls: string[] | { url: string; category?: string }[],
 *     companyIdentifier?: string,
 *     category?: string,
 *   }
 *
 * Per-page extraction:
 *   - <title> tag → page title
 *   - <meta name="description"> → meta description
 *   - Full HTML → stripped text (max 5 000 chars)
 *
 * Error handling:
 *   - 4xx → skip + log warning
 *   - 5xx → retry once, then skip + log warning
 *   - Network / timeout (10 s) → log error
 *   - Never throws; always returns a ConnectorResult.
 */

import { BaseConnector } from '../base-connector';
import type {
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorMessage,
  ConnectorResult,
  RawIntelligenceObject,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 5000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_URLS = 5;

/** Per-URL config entry (string or object). */
type UrlEntry = { url: string; category?: string };

// ─── Connector Implementation ──────────────────────────────────

export class WebsiteConnector extends BaseConnector {
  readonly sourceType = 'website' as const;
  readonly name = 'Website Scraper';

  // ── validateConfig ───────────────────────────────────────────

  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const urls = config.urls;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      errors.push('urls is required and must be a non-empty array');
    } else if (urls.length > MAX_URLS) {
      errors.push(`urls array exceeds maximum of ${MAX_URLS} entries`);
    } else {
      for (const u of urls) {
        if (typeof u === 'string') {
          if (!u.trim()) errors.push('URL string must not be empty');
        } else if (u && typeof u === 'object') {
          if (typeof (u as UrlEntry).url !== 'string' || !(u as UrlEntry).url.trim()) {
            errors.push('Each url entry must have a non-empty "url" string');
          }
        } else {
          errors.push('Each url entry must be a string or { url, category? } object');
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ── test ─────────────────────────────────────────────────────

  async test(config: Record<string, unknown>): Promise<{
    success: boolean;
    message: string;
  }> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.errors.join('; ') };
    }

    const urls = (config.urls as UrlEntry[]).slice(0, MAX_URLS);
    const firstUrl = typeof urls[0] === 'string' ? urls[0] : (urls[0] as UrlEntry).url;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(firstUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'DeepMindQ-Bot/1.0 (Intelligence Acquisition; +https://deepmindq.example.com/bot)',
          Accept: 'text/html',
        },
      });
      clearTimeout(timer);

      if (res.status >= 400) {
        return {
          success: false,
          message: `First URL returned HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        message: `First URL reachable (HTTP ${res.status}). ${urls.length} page(s) will be fetched.`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to reach first URL: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── acquire (delegates to run) ──────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    const result = await this.run(config as ConnectorConfig);

    // Adapt ConnectorResult → ConnectorAcquisitionResult
    return {
      success: result.status !== 'error',
      intelligenceObjects: result.intelligenceObjects,
      errors: result.messages
        .filter((m) => m.level === 'error' || m.level === 'warn')
        .map((m) => m.message),
      metadata: {
        source: 'website_scrape',
        status: result.status,
        messageCount: result.messages.length,
      },
    };
  }

  // ── run (core logic) ────────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
    const messages: ConnectorMessage[] = [];
    const objects: RawIntelligenceObject[] = [];

    const companyIdentifier: string = config.companyIdentifier ?? 'unknown';
    const defaultCategory: string | undefined = config.category as
      | string
      | undefined;

    // ── Parse URLs from config ─────────────────────────────────────
    const rawUrls = (config.urls ?? []) as string[] | UrlEntry[];
    const urlEntries: UrlEntry[] = rawUrls.slice(0, MAX_URLS).map((u) => {
      if (typeof u === 'string') return { url: u };
      return { url: u.url, category: u.category };
    });

    if (urlEntries.length === 0) {
      return this.createErrorResult(
        'WebsiteConnector: no URLs provided in config.urls',
      );
    }

    messages.push(
      this.msg('info', `Processing ${urlEntries.length} URL(s)`),
    );

    // ── Fetch each URL ─────────────────────────────────────────────
    for (const entry of urlEntries) {
      const { url, category } = entry;

      try {
        const result = await this.fetchPage(url);

        if ('error' in result) {
          messages.push(this.msg('warn', result.error, url));
          continue;
        }

        const content = result.text.slice(0, MAX_CONTENT_LENGTH);
        const summary =
          result.metaDescription || content.slice(0, 200);

        objects.push({
          companyIdentifier,
          content,
          summary: result.title
            ? `${result.title} — ${summary}`
            : summary,
          sourceUrl: url,
          capturedAt: new Date(),
          category: category ?? defaultCategory,
          metadata: {
            allUrls: urlEntries.map((e) => e.url),
            pageTitle: result.title,
            metaDescription: result.metaDescription,
          },
        });

        messages.push(this.msg('info', `Fetched ${url} (${content.length} chars)`));
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        messages.push(
          this.msg('error', `Network error for ${url}: ${message}`, url),
        );
      }
    }

    if (objects.length === urlEntries.length) return this.createResult('success', objects, messages);
    if (objects.length > 0) return this.createResult('partial', objects, messages);
    return this.createResult('error', objects, messages);
  }

  // ─── Private helpers ────────────────────────────────────────────

  private async fetchPage(
    url: string,
    retryCount = 0,
  ): Promise<
    | { text: string; title: string; metaDescription: string }
    | { error: string }
  > {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'DeepMindQ-Bot/1.0 (Intelligence Acquisition; +https://deepmindq.example.com/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      // ── Handle 4xx — skip ──────────────────────────────────────────
      if (res.status >= 400 && res.status < 500) {
        return { error: `HTTP ${res.status} — skipping` };
      }

      // ── Handle 5xx — retry once ────────────────────────────────────
      if (res.status >= 500) {
        if (retryCount < 1) {
          return this.fetchPage(url, retryCount + 1);
        }
        return { error: `HTTP ${res.status} after retry — skipping` };
      }

      // ── Non-HTML content — skip ────────────────────────────────────
      const contentType = res.headers.get('content-type') ?? '';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml')
      ) {
        return { error: `Non-HTML content type: ${contentType}` };
      }

      const html = await res.text();

      const title = this.extractTitle(html);
      const metaDescription = this.extractMetaDescription(html);
      const text = this.stripHtml(html);

      return { text, title, metaDescription };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { error: `Timeout after ${FETCH_TIMEOUT_MS / 1000}s` };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Fetch failed: ${message}` };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Extract text from `<title>` tag. */
  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return '';
    return this.decodeEntities(match[1]).trim();
  }

  /** Extract content from the first `<meta name="description">` tag. */
  private extractMetaDescription(html: string): string {
    const match = html.match(
      /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["'][^>]*>/i,
    ) ??
      html.match(
        /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["'][^>]*>/i,
      );
    if (!match) return '';
    return this.decodeEntities(match[1]).trim();
  }

  /** Strip all HTML tags, scripts, styles, decode entities, normalize whitespace. */
  private stripHtml(html: string): string {
    return html
      // Remove <script> blocks
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove <style> blocks
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove <noscript> blocks
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Replace block-level closing tags with newlines to preserve paragraph breaks
      .replace(/<\/(?:p|div|h[1-6]|li|tr|br|blockquote|pre)[^>]*>/gi, '\n')
      .replace(/<br[^>]*\/?>/gi, '\n')
      // Strip all remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&[^;\s]+;/g, (entity) => this.decodeEntities(entity))
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Decode common HTML entities including named, decimal, and hex. */
  private decodeEntities(str: string): string {
    const entityMap: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&#39;': "'",
      '&nbsp;': ' ',
      '&#x20;': ' ',
      '&mdash;': '\u2014',
      '&ndash;': '\u2013',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201C',
      '&rdquo;': '\u201D',
      '&bull;': '\u2022',
      '&hellip;': '\u2026',
      '&copy;': '\u00A9',
      '&reg;': '\u00AE',
      '&trade;': '\u2122',
    };

    if (entityMap[str]) return entityMap[str];

    // Numeric decimal entities: &#1234;
    const decimalMatch = str.match(/^&#(\d+);$/);
    if (decimalMatch) {
      const code = parseInt(decimalMatch[1], 10);
      if (code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
    }

    // Numeric hex entities: &#x1F600;
    const hexMatch = str.match(/^&#x([0-9a-fA-F]+);$/);
    if (hexMatch) {
      const code = parseInt(hexMatch[1], 16);
      if (code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
    }

    return str;
  }
}
