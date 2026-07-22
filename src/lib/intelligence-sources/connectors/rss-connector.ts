/**
 * Phase 7.5 — RSS Connector
 *
 * Fetches and parses RSS 2.0 / Atom feeds, with optional auto-discovery.
 *
 * Config shape:
 *   {
 *     feedUrl?: string,            // direct feed URL
 *     discoverFromUrl?: string,    // page URL to auto-discover feed from
 *     companyIdentifier?: string,
 *     category?: string,
 *   }
 *
 * Features:
 *   - RSS 2.0 and Atom format support
 *   - Auto-discovery via <link rel="alternate"> tags
 *   - Filters items older than 90 days
 *   - Max 100 items per feed
 *   - 15-second fetch timeout
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

const MAX_ITEMS = 100;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const FETCH_TIMEOUT_MS = 15_000;

/** A parsed feed item (format-agnostic). */
interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
}

// ─── Connector Implementation ──────────────────────────────────

export class RssConnector extends BaseConnector {
  readonly sourceType = 'rss' as const;
  readonly name = 'RSS Feed Reader';

  // ── validateConfig ───────────────────────────────────────────

  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.feedUrl && !config.discoverFromUrl) {
      errors.push('Either feedUrl or discoverFromUrl is required');
    }

    if (config.feedUrl && typeof config.feedUrl !== 'string') {
      errors.push('feedUrl must be a string');
    }

    if (config.discoverFromUrl && typeof config.discoverFromUrl !== 'string') {
      errors.push('discoverFromUrl must be a string');
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

    const feedUrl = config.feedUrl as string | undefined;
    const discoverFromUrl = config.discoverFromUrl as string | undefined;

    try {
      let urlToTest = feedUrl;

      if (!urlToTest && discoverFromUrl) {
        // Attempt auto-discovery
        urlToTest = (await this.discoverFeedUrl(discoverFromUrl)) ?? undefined;
        if (!urlToTest) {
          return {
            success: false,
            message: 'Auto-discovery found no RSS/Atom feed link on the page',
          };
        }
      }

      const xml = await this.fetchXml(urlToTest!);

      // Quick sanity check: does it look like a feed?
      if (xml.includes('<item') || xml.includes('<entry') || xml.includes('<channel') || xml.includes('<feed')) {
        return { success: true, message: `Feed is reachable and appears valid (XML: ${xml.length} bytes)` };
      }

      return {
        success: false,
        message: 'Fetched content does not appear to be a valid RSS or Atom feed',
      };
    } catch (err) {
      return {
        success: false,
        message: `Feed test failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── acquire (delegates to run) ──────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    const result = await this.run(config as ConnectorConfig);

    return {
      success: result.status !== 'error',
      intelligenceObjects: result.intelligenceObjects,
      errors: result.messages
        .filter((m) => m.level === 'error' || m.level === 'warn')
        .map((m) => m.message),
      metadata: {
        source: 'rss_feed',
        status: result.status,
        messageCount: result.messages.length,
      },
    };
  }

  // ── run (core logic) ────────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
    const messages: ConnectorMessage[] = [];
    const objects: RawIntelligenceObject[] = [];

    const companyIdentifier: string =
      (config.companyIdentifier as string) ?? 'unknown';
    const defaultCategory: string | undefined = config.category as
      | string
      | undefined;

    // ── Resolve feed URL ──────────────────────────────────────────
    let feedUrl: string | null = (config.feedUrl as string) ?? null;

    if (!feedUrl && config.discoverFromUrl) {
      messages.push(
        this.msg('info', 'Attempting feed auto-discovery…'),
      );
      const discovered = await this.discoverFeedUrl(
        config.discoverFromUrl as string,
      );
      if (discovered) {
        feedUrl = discovered;
        messages.push(this.msg('info', `Discovered feed: ${feedUrl}`));
      } else {
        return this.createErrorResult(
          'RSS auto-discovery failed: no feed link found on page',
          config.discoverFromUrl as string,
        );
      }
    }

    if (!feedUrl) {
      return this.createErrorResult(
        'RssConnector: no feedUrl or discoverFromUrl provided in config',
      );
    }

    // ── Fetch the feed ────────────────────────────────────────────
    let xml: string;
    try {
      xml = await this.fetchXml(feedUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(`Failed to fetch feed: ${message}`, feedUrl);
    }

    // ── Detect feed format and parse ──────────────────────────────
    const isAtom = /<feed[\s>]/i.test(xml) || xml.includes('<entry');
    const items = isAtom
      ? this.parseAtom(xml)
      : this.parseRss(xml);

    messages.push(
      this.msg('info', `Parsed ${items.length} item(s) from feed`),
    );

    // ── Filter and convert to RawIntelligenceObject ───────────────
    const cutoff = new Date(Date.now() - MAX_AGE_MS);

    for (const item of items.slice(0, MAX_ITEMS)) {
      // Skip items older than 90 days
      if (item.pubDate && item.pubDate < cutoff) {
        continue;
      }

      if (!item.link) continue;

      objects.push({
        companyIdentifier,
        content: item.description,
        summary: item.title || 'Untitled feed item',
        sourceUrl: item.link,
        capturedAt: item.pubDate ?? new Date(),
        category: defaultCategory,
        metadata: {
          feedUrl,
          feedFormat: isAtom ? 'atom' : 'rss',
        },
      });
    }

    if (objects.length === 0) {
      return this.createResult(
        'error',
        [],
        [
          ...messages,
          this.msg(
            'warn',
            'No items found within the 90-day window',
            feedUrl,
          ),
        ],
      );
    }

    if (objects.length < items.length) {
      messages.push(
        this.msg(
          'info',
          `Filtered to ${objects.length} item(s) within 90-day window (of ${items.length} total)`,
        ),
      );
    }

    return this.createResult('success', objects, messages);
  }

  // ─── XML fetching ──────────────────────────────────────────────

  private async fetchXml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'DeepMindQ-Bot/1.0 (Intelligence Acquisition; +https://deepmindq.example.com/bot)',
          Accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });

      if (res.status >= 400) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Feed auto-discovery ────────────────────────────────────────

  private async discoverFeedUrl(pageUrl: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(pageUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'DeepMindQ-Bot/1.0 (Intelligence Acquisition; +https://deepmindq.example.com/bot)',
          Accept: 'text/html',
        },
      });
      clearTimeout(timer);

      if (!res.ok) return null;

      const html = await res.text();

      // Look for <link rel="alternate" type="application/rss+xml" href="…">
      // or <link rel="alternate" type="application/atom+xml" href="…">
      // Supports any attribute ordering: rel+type+href, type+rel+href, href+rel+type
      const patterns: RegExp[] = [
        // RSS — rel before type before href
        /<link[^>]+rel\s*=\s*["']alternate["'][^>]+type\s*=\s*["']application\/rss\+xml["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
        // RSS — type before rel before href
        /<link[^>]+type\s*=\s*["']application\/rss\+xml["'][^>]+rel\s*=\s*["']alternate["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
        // RSS — href before rel before type
        /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']alternate["'][^>]+type\s*=\s*["']application\/rss\+xml["'][^>]*\/?>/i,
        // Atom — rel before type before href
        /<link[^>]+rel\s*=\s*["']alternate["'][^>]+type\s*=\s*["']application\/atom\+xml["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
        // Atom — type before rel before href
        /<link[^>]+type\s*=\s*["']application\/atom\+xml["'][^>]+rel\s*=\s*["']alternate["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
        // Atom — href before rel before type
        /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']alternate["'][^>]+type\s*=\s*["']application\/atom\+xml["'][^>]*\/?>/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          return this.resolveUrl(pageUrl, match[1]);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Resolve a potentially relative URL against a base URL. */
  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }

  // ─── RSS 2.0 parser ────────────────────────────────────────────

  private parseRss(xml: string): FeedItem[] {
    const items: FeedItem[] = [];

    // Extract each <item>…</item> block
    const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const block = itemMatch[0];

      const title = this.extractTagText(block, 'title');
      const link = this.extractTagText(block, 'link');
      const description =
        this.extractTagText(block, 'content:encoded') ||
        this.extractTagText(block, 'description');
      const pubDateStr = this.extractTagText(block, 'pubDate');

      items.push({
        title: this.stripHtml(title),
        link: this.cleanLink(link),
        description: this.stripHtml(description),
        pubDate: this.parseDate(pubDateStr),
      });
    }

    return items;
  }

  // ─── Atom parser ───────────────────────────────────────────────

  private parseAtom(xml: string): FeedItem[] {
    const items: FeedItem[] = [];

    // Extract each <entry>…</entry> block
    const entryRegex = /<entry[\s>][\s\S]*?<\/entry>/gi;
    let entryMatch: RegExpExecArray | null;

    while ((entryMatch = entryRegex.exec(xml)) !== null) {
      const block = entryMatch[0];

      const title = this.extractTagText(block, 'title');
      const link = this.extractAtomLink(block);
      const description =
        this.extractTagText(block, 'content') ||
        this.extractTagText(block, 'summary');
      const pubDateStr =
        this.extractTagText(block, 'published') ||
        this.extractTagText(block, 'updated');

      items.push({
        title: this.stripHtml(title),
        link,
        description: this.stripHtml(description),
        pubDate: this.parseDate(pubDateStr),
      });
    }

    return items;
  }

  // ─── Tag extraction helpers ─────────────────────────────────────

  /**
   * Extract the text content of the first occurrence of `<tagName>…</tagName>`.
   * Handles namespaced tags like `content:encoded`.
   * Handles optional CDATA wrappers: `<title><![CDATA[…]]></title>`.
   */
  private extractTagText(xml: string, tagName: string): string {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<${escaped}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${escaped}>`,
      'i',
    );
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? '';
  }

  /** Extract href from Atom `<link>` element (prefer rel="alternate"). */
  private extractAtomLink(block: string): string {
    // Prefer rel="alternate"
    const altPatterns: RegExp[] = [
      /<link[^>]+rel\s*=\s*["']alternate["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
      /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']alternate["'][^>]*\/?>/i,
    ];

    for (const pattern of altPatterns) {
      const m = block.match(pattern);
      if (m?.[1]) return this.cleanLink(m[1]);
    }

    // Fallback: first <link> with href
    const fallbackPattern = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i;
    const fallbackMatch = block.match(fallbackPattern);
    return fallbackMatch?.[1]
      ? this.cleanLink(fallbackMatch[1])
      : '';
  }

  /** Clean a link string — strip whitespace, CDATA wrappers, and common XML entities. */
  private cleanLink(raw: string): string {
    return raw
      .replace(/^<!\[CDATA\[/, '')
      .replace(/\]\]>$/, '')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /** Strip HTML tags from a string and normalize whitespace. */
  private stripHtml(text: string): string {
    return text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[^;\s]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Parse a date string (RFC 2822 or ISO 8601) into a Date, or null. */
  private parseDate(str: string): Date | null {
    if (!str) return null;
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) return date;
    } catch {
      // fall through
    }
    return null;
  }
}
