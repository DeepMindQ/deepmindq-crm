/**
 * Sprint 1 — Three-Date Evidence Model
 *
 * The three-date model is mandatory for trustworthy intelligence.
 * Every piece of evidence must understand:
 *
 *   1. eventDate          — When the event actually happened (extracted from content)
 *   2. discoveryDate      — When our system found it (timestamp of collection)
 *   3. sourcePublishedDate — When the source published it (from metadata or page content)
 *
 * Without this, freshness, confidence, and recommendations are unreliable.
 *
 * This module provides:
 *   - Extraction of published dates from search result snippets and content
 *   - Three-date storage in the Evidence table's extractedValue JSON
 *   - Updated freshness scoring that uses the best available date
 *   - Traceability: every date has a source, so users can ask "Why does DeepMindQ believe this?"
 */

// ─── Three-Date Model ───────────────────────────────────────────

export interface EvidenceDates {
  /** When the event actually happened (extracted from content analysis) */
  eventDate: string | null;      // ISO date or null
  /** When our system discovered this evidence */
  discoveryDate: string;        // ISO date (always present — collection timestamp)
  /** When the source published this (from metadata or content parsing) */
  sourcePublishedDate: string | null; // ISO date or null
  /** How we determined the event date */
  eventDateSource: 'extracted_from_content' | 'inferred_from_publication' | 'same_as_publication' | 'fallback_to_discovery' | null;
  /** How we determined the published date */
  publishedDateSource: 'search_metadata' | 'content_parsing' | 'url_pattern' | 'not_found' | null;
}

// ─── Published Date Extraction ─────────────────────────────────

/**
 * Extract a publication date from a search result snippet.
 *
 * Search result snippets often contain dates in various formats:
 *   - "Jan 15, 2025"
 *   - "January 15, 2025"
 *   - "15 Jan 2025"
 *   - "2025-01-15"
 *   - "1 day ago", "2 hours ago", "3 weeks ago"
 *   - "Jan 15" (no year — assume current or previous year)
 *   - "15 hours ago"
 */
export function extractPublishedDateFromSnippet(snippet: string): { date: string | null; source: string } {
  if (!snippet) return { date: null, source: 'not_found' };

  // 1. ISO date format: 2025-01-15
  const isoMatch = snippet.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'content_parsing' };
    }
  }

  // 2. Relative time patterns: "X days ago", "X hours ago", "X weeks ago", "X months ago"
  const relativeMatch = snippet.match(/(\d+)\s*(hour|hours|day|days|week|weeks|month|months|year|years)\s*ago/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const d = new Date();
    switch (unit) {
      case 'hour': case 'hours': d.setHours(d.getHours() - amount); break;
      case 'day': case 'days': d.setDate(d.getDate() - amount); break;
      case 'week': case 'weeks': d.setDate(d.getDate() - amount * 7); break;
      case 'month': case 'months': d.setMonth(d.getMonth() - amount); break;
      case 'year': case 'years': d.setFullYear(d.getFullYear() - amount); break;
    }
    return { date: d.toISOString(), source: 'content_parsing' };
  }

  // 3. "Month DD, YYYY" format: Jan 15, 2025
  const longMatch = snippet.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (longMatch) {
    const d = new Date(`${longMatch[1]} ${longMatch[2]}, ${longMatch[3]}`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'content_parsing' };
    }
  }

  // 4. "DD Month YYYY" format: 15 Jan 2025
  const reverseMatch = snippet.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})/i);
  if (reverseMatch) {
    const d = new Date(`${reverseMatch[2]} ${reverseMatch[1]}, ${reverseMatch[3]}`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'content_parsing' };
    }
  }

  // 5. "Month DD" format (no year): Jan 15 — assume current year
  const shortMatch = snippet.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i);
  if (shortMatch) {
    const d = new Date(`${shortMatch[1]} ${shortMatch[2]}, ${new Date().getFullYear()}`);
    if (!isNaN(d.getTime()) && d <= new Date()) {
      return { date: d.toISOString(), source: 'content_parsing' };
    }
    // Try previous year if the date is in the future
    d.setFullYear(d.getFullYear() - 1);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'content_parsing' };
    }
  }

  return { date: null, source: 'not_found' };
}

/**
 * Try to extract a date from a URL pattern.
 * Some news sites embed dates in URLs like:
 *   - /2025/01/15/article-title
 *   - /2025/01/article-title
 *   - /20250115-article-title
 */
export function extractDateFromUrl(url: string): { date: string | null; source: string } {
  if (!url) return { date: null, source: 'not_found' };

  // Pattern: /YYYY/MM/DD/
  const pathMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (pathMatch) {
    const d = new Date(`${pathMatch[1]}-${pathMatch[2]}-${pathMatch[3]}`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'url_pattern' };
    }
  }

  // Pattern: /YYYY/MM/
  const monthMatch = url.match(/\/(\d{4})\/(\d{2})\//);
  if (monthMatch) {
    const d = new Date(`${monthMatch[1]}-${monthMatch[2]}-01`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'url_pattern' };
    }
  }

  // Pattern: YYYYMMDD in filename/article slug
  const slugMatch = url.match(/(\d{4})(\d{2})(\d{2})[^\d]/);
  if (slugMatch) {
    const d = new Date(`${slugMatch[1]}-${slugMatch[2]}-${slugMatch[3]}`);
    if (!isNaN(d.getTime())) {
      return { date: d.toISOString(), source: 'url_pattern' };
    }
  }

  return { date: null, source: 'not_found' };
}

// ─── Three-Date Computation ────────────────────────────────────

/**
 * Build the complete three-date model for a piece of evidence.
 *
 * Resolution order for sourcePublishedDate:
 *   1. Explicit publishedDate from search metadata (if available)
 *   2. Extracted from snippet text
 *   3. Extracted from URL pattern
 *   4. null (not found)
 *
 * Resolution order for eventDate:
 *   1. Same as sourcePublishedDate (most common case)
 *   2. Inferred from content context
 *   3. Fallback to discoveryDate
 */
export function buildThreeDateModel(params: {
  publishedDate?: string | null;   // From search metadata
  snippet: string;
  url: string | null;
  discoveryDate: string;         // Always available — collection timestamp
}): EvidenceDates {
  const { publishedDate, snippet, url, discoveryDate } = params;

  // 1. Try explicit publishedDate first
  let sourcePublishedDate: string | null = null;
  let publishedDateSource: EvidenceDates['publishedDateSource'] = 'not_found';

  if (publishedDate) {
    const parsed = new Date(publishedDate);
    if (!isNaN(parsed.getTime())) {
      sourcePublishedDate = parsed.toISOString();
      publishedDateSource = 'search_metadata';
    }
  }

  // 2. Try snippet extraction
  if (!sourcePublishedDate) {
    const fromSnippet = extractPublishedDateFromSnippet(snippet);
    if (fromSnippet.date) {
      sourcePublishedDate = fromSnippet.date;
      publishedDateSource = fromSnippet.source as EvidenceDates['publishedDateSource'];
    }
  }

  // 3. Try URL pattern
  if (!sourcePublishedDate && url) {
    const fromUrl = extractDateFromUrl(url);
    if (fromUrl.date) {
      sourcePublishedDate = fromUrl.date;
      publishedDateSource = fromUrl.source as EvidenceDates['publishedDateSource'];
    }
  }

  // 4. Event date derivation
  let eventDate: string | null = null;
  let eventDateSource: EvidenceDates['eventDateSource'] = 'fallback_to_discovery';

  if (sourcePublishedDate) {
    eventDate = sourcePublishedDate;
    eventDateSource = 'same_as_publication';
  } else {
    // No published date found — event date falls back to discovery date
    eventDate = discoveryDate;
    eventDateSource = 'fallback_to_discovery';
  }

  return {
    eventDate,
    discoveryDate,
    sourcePublishedDate,
    eventDateSource,
    publishedDateSource,
  };
}

// ─── Best Available Date for Freshness ──────────────────────────

/**
 * Get the best available date for freshness scoring.
 *
 * Priority: eventDate > sourcePublishedDate > discoveryDate
 */
export function getBestDateForFreshness(dates: EvidenceDates): string {
  return dates.eventDate || dates.sourcePublishedDate || dates.discoveryDate;
}

/**
 * Compute a freshness quality score for the three-date model.
 *
 * 1.0 = All three dates available (highest confidence)
 * 0.7 = Published date available (good)
 * 0.4 = Only discovery date (degraded — same as before Sprint 1)
 */
export function dateModelQuality(dates: EvidenceDates): number {
  if (dates.eventDate && dates.sourcePublishedDate) {
    if (dates.eventDateSource === 'extracted_from_content') return 1.0;
    if (dates.eventDateSource === 'same_as_publication') return 0.9;
  }
  if (dates.sourcePublishedDate) return 0.7;
  if (dates.eventDate && dates.eventDateSource === 'fallback_to_discovery') return 0.5;
  return 0.4;
}

// ─── Serialization ──────────────────────────────────────────────

/**
 * Serialize the three-date model for storage in extractedValue JSON.
 */
export function serializeThreeDateModel(dates: EvidenceDates): Record<string, unknown> {
  return {
    evidenceDates: {
      eventDate: dates.eventDate,
      discoveryDate: dates.discoveryDate,
      sourcePublishedDate: dates.sourcePublishedDate,
      eventDateSource: dates.eventDateSource,
      publishedDateSource: dates.publishedDateSource,
      qualityScore: dateModelQuality(dates),
    },
  };
}
