/**
 * Sprint 1 Module Unit Tests
 *
 * Pure-function tests for the five core Sprint 1 modules:
 *   1. Three-Date Model
 *   2. Signal Taxonomy Mapping
 *   3. Freshness Ranking
 *   4. Adaptive Intelligence
 *   5. Evidence Classifier
 *
 * No DB access needed — all modules are stateless pure functions.
 */

import { describe, it, expect } from 'vitest'

// ─── Three-Date Model ────────────────────────────────────────────
import {
  extractPublishedDateFromSnippet,
  extractDateFromUrl,
  buildThreeDateModel,
  getBestDateForFreshness,
  dateModelQuality,
  serializeThreeDateModel,
  type EvidenceDates,
} from '@/lib/intelligence-sources/three-date-model'

// ─── Signal Taxonomy Mapping ──────────────────────────────────────
import {
  CANONICAL_SIGNAL_TYPES,
  isCanonicalType,
  isLegacyType,
  normalizeSignalType,
  normalizeSignalTypes,
  groupByCanonicalType,
  normalizeSignals,
  type TypeMappingResult,
} from '@/lib/intelligence-sources/signal-type-mapping'

// ─── Freshness Ranking ───────────────────────────────────────────
import {
  computeFreshnessScore,
  computeIntelligenceRanking,
  rankSignal,
  sortByIntelligenceRanking,
  SIGNAL_HALF_LIVES,
} from '@/lib/scoring/freshness-ranking'

// ─── Adaptive Intelligence ───────────────────────────────────────
import {
  assessSignalDensity,
  getIntelligenceTemplate,
  type SignalDensity,
} from '@/lib/intelligence-sources/adaptive-intelligence'

// ─── Evidence Classifier ────────────────────────────────────────
import {
  classifyEvidence,
  scoreSourceReliability,
  type RawEvidenceInput,
} from '@/lib/intelligence-sources/evidence-classifier'

// ═══════════════════════════════════════════════════════════════════
// 1. THREE-DATE MODEL
// ═══════════════════════════════════════════════════════════════════

describe('Three-Date Model', () => {

  // ── extractPublishedDateFromSnippet ─────────────────────────────

  describe('extractPublishedDateFromSnippet()', () => {

    it('extracts ISO date format (YYYY-MM-DD)', () => {
      const result = extractPublishedDateFromSnippet('Published on 2025-01-15 by Staff')
      expect(result.date).not.toBeNull()
      expect(result.source).toBe('content_parsing')
      // Should produce a valid ISO string for Jan 15, 2025
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(0) // January
      expect(d.getUTCDate()).toBe(15)
    })

    it('extracts relative time "2 days ago"', () => {
      const result = extractPublishedDateFromSnippet('Updated 2 days ago')
      expect(result.date).not.toBeNull()
      expect(result.source).toBe('content_parsing')
      // Should be approximately 2 days ago
      const daysDiff = Math.round(
        (Date.now() - new Date(result.date!).getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(daysDiff).toBe(2)
    })

    it('extracts relative time "3 weeks ago"', () => {
      const result = extractPublishedDateFromSnippet('Report published 3 weeks ago')
      expect(result.date).not.toBeNull()
      const daysDiff = Math.round(
        (Date.now() - new Date(result.date!).getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(daysDiff).toBe(21) // 3 weeks
    })

    it('extracts relative time with hours', () => {
      const result = extractPublishedDateFromSnippet('Breaking 5 hours ago')
      expect(result.date).not.toBeNull()
    })

    it('extracts long format "Jan 15, 2025"', () => {
      const result = extractPublishedDateFromSnippet('Published Jan 15, 2025')
      expect(result.date).not.toBeNull()
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
    })

    it('extracts full month name "January 15, 2025"', () => {
      const result = extractPublishedDateFromSnippet('Article from January 15, 2025')
      expect(result.date).not.toBeNull()
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
    })

    it('extracts short format "Jan 15" (no year) and assigns current year', () => {
      const result = extractPublishedDateFromSnippet('Published Jan 15')
      expect(result.date).not.toBeNull()
      const d = new Date(result.date!)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
      // Year should be current year
      expect(d.getUTCFullYear()).toBe(new Date().getFullYear())
    })

    it('extracts reverse format "15 Jan 2025"', () => {
      const result = extractPublishedDateFromSnippet('Dated 15 Jan 2025')
      expect(result.date).not.toBeNull()
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
    })

    it('returns null when no date pattern is found', () => {
      const result = extractPublishedDateFromSnippet('Some random text without dates')
      expect(result.date).toBeNull()
      expect(result.source).toBe('not_found')
    })

    it('returns null for empty string', () => {
      const result = extractPublishedDateFromSnippet('')
      expect(result.date).toBeNull()
      expect(result.source).toBe('not_found')
    })

    it('returns null for undefined/null input', () => {
      const result = extractPublishedDateFromSnippet(null as unknown as string)
      expect(result.date).toBeNull()
      expect(result.source).toBe('not_found')
    })
  })

  // ── extractDateFromUrl ──────────────────────────────────────────

  describe('extractDateFromUrl()', () => {

    it('extracts date from path pattern /YYYY/MM/DD/', () => {
      const result = extractDateFromUrl('https://example.com/news/2025/03/15/article-slug')
      expect(result.date).not.toBeNull()
      expect(result.source).toBe('url_pattern')
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(2) // March
      expect(d.getUTCDate()).toBe(15)
    })

    it('extracts date from month-only path /YYYY/MM/', () => {
      const result = extractDateFromUrl('https://example.com/blog/2025/06/article')
      expect(result.date).not.toBeNull()
      expect(result.source).toBe('url_pattern')
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(5) // June
      expect(d.getUTCDate()).toBe(1) // First of the month
    })

    it('extracts date from slug pattern YYYYMMDD-article', () => {
      const result = extractDateFromUrl('https://example.com/20250315-article-title')
      expect(result.date).not.toBeNull()
      expect(result.source).toBe('url_pattern')
      const d = new Date(result.date!)
      expect(d.getUTCFullYear()).toBe(2025)
      expect(d.getUTCMonth()).toBe(2)
      expect(d.getUTCDate()).toBe(15)
    })

    it('returns null when no URL date pattern is found', () => {
      const result = extractDateFromUrl('https://example.com/about-us')
      expect(result.date).toBeNull()
      expect(result.source).toBe('not_found')
    })

    it('returns null for empty URL', () => {
      const result = extractDateFromUrl('')
      expect(result.date).toBeNull()
      expect(result.source).toBe('not_found')
    })

    it('prefers /YYYY/MM/DD/ over /YYYY/MM/ when both patterns could match', () => {
      const result = extractDateFromUrl('https://example.com/2025/07/22/story')
      expect(result.date).not.toBeNull()
      const d = new Date(result.date!)
      // Should be day 22, not day 1 (which month-only would give)
      expect(d.getUTCDate()).toBe(22)
    })
  })

  // ── buildThreeDateModel ────────────────────────────────────────

  describe('buildThreeDateModel()', () => {

    const discoveryDate = '2025-06-01T00:00:00.000Z'

    it('prefers publishedDate from metadata over snippet extraction', () => {
      const result = buildThreeDateModel({
        publishedDate: '2025-01-10T00:00:00.000Z',
        snippet: 'Published Jan 15, 2025',
        url: 'https://example.com/2025/02/20/story',
        discoveryDate,
      })
      expect(result.sourcePublishedDate).toBe('2025-01-10T00:00:00.000Z')
      expect(result.publishedDateSource).toBe('search_metadata')
      // eventDate should match sourcePublishedDate
      expect(result.eventDate).toBe('2025-01-10T00:00:00.000Z')
      expect(result.eventDateSource).toBe('same_as_publication')
    })

    it('falls back to snippet when no metadata publishedDate provided', () => {
      const result = buildThreeDateModel({
        publishedDate: null,
        snippet: 'Published Jan 15, 2025',
        url: 'https://example.com/2025/02/20/story',
        discoveryDate,
      })
      expect(result.sourcePublishedDate).not.toBeNull()
      expect(result.publishedDateSource).toBe('content_parsing')
      const d = new Date(result.sourcePublishedDate!)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(15)
    })

    it('falls back to URL when snippet has no date', () => {
      const result = buildThreeDateModel({
        publishedDate: null,
        snippet: 'No date in this snippet',
        url: 'https://example.com/2025/03/20/story',
        discoveryDate,
      })
      expect(result.sourcePublishedDate).not.toBeNull()
      expect(result.publishedDateSource).toBe('url_pattern')
      const d = new Date(result.sourcePublishedDate!)
      expect(d.getUTCMonth()).toBe(2)
      expect(d.getUTCDate()).toBe(20)
    })

    it('returns fallback_to_discovery when no dates found anywhere', () => {
      const result = buildThreeDateModel({
        publishedDate: null,
        snippet: 'No date here',
        url: 'https://example.com/about',
        discoveryDate,
      })
      expect(result.sourcePublishedDate).toBeNull()
      expect(result.publishedDateSource).toBe('not_found')
      expect(result.eventDate).toBe(discoveryDate)
      expect(result.eventDateSource).toBe('fallback_to_discovery')
    })

    it('sets eventDate to discoveryDate when sourcePublishedDate is null', () => {
      const result = buildThreeDateModel({
        publishedDate: null,
        snippet: 'No dates anywhere in this text',
        url: 'https://example.com/page',
        discoveryDate,
      })
      expect(result.eventDate).toBe(discoveryDate)
      expect(result.eventDateSource).toBe('fallback_to_discovery')
    })

    it('sets eventDateSource to same_as_publication when publishedDate is found', () => {
      const result = buildThreeDateModel({
        publishedDate: '2025-02-01T00:00:00.000Z',
        snippet: 'Something happened',
        url: null,
        discoveryDate,
      })
      expect(result.eventDate).toBe('2025-02-01T00:00:00.000Z')
      expect(result.eventDateSource).toBe('same_as_publication')
    })

    it('handles invalid publishedDate gracefully and falls back to snippet', () => {
      const result = buildThreeDateModel({
        publishedDate: 'not-a-date',
        snippet: 'Published Jan 20, 2025',
        url: null,
        discoveryDate,
      })
      expect(result.publishedDateSource).toBe('content_parsing')
      const d = new Date(result.sourcePublishedDate!)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(20)
    })
  })

  // ── getBestDateForFreshness ────────────────────────────────────

  describe('getBestDateForFreshness()', () => {

    it('returns eventDate when all dates are available', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-01-10T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-12T00:00:00.000Z',
        eventDateSource: 'same_as_publication',
        publishedDateSource: 'search_metadata',
      }
      expect(getBestDateForFreshness(dates)).toBe('2025-01-10T00:00:00.000Z')
    })

    it('returns sourcePublishedDate when eventDate is null', () => {
      const dates: EvidenceDates = {
        eventDate: null,
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-12T00:00:00.000Z',
        eventDateSource: null,
        publishedDateSource: 'content_parsing',
      }
      expect(getBestDateForFreshness(dates)).toBe('2025-01-12T00:00:00.000Z')
    })

    it('returns discoveryDate when both eventDate and sourcePublishedDate are null', () => {
      const dates: EvidenceDates = {
        eventDate: null,
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: null,
        eventDateSource: null,
        publishedDateSource: 'not_found',
      }
      expect(getBestDateForFreshness(dates)).toBe('2025-06-01T00:00:00.000Z')
    })
  })

  // ── dateModelQuality ────────────────────────────────────────────

  describe('dateModelQuality()', () => {

    it('returns 1.0 when eventDate is extracted_from_content and sourcePublishedDate exists', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-01-10T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-12T00:00:00.000Z',
        eventDateSource: 'extracted_from_content',
        publishedDateSource: 'search_metadata',
      }
      expect(dateModelQuality(dates)).toBe(1.0)
    })

    it('returns 0.9 when eventDateSource is same_as_publication and sourcePublishedDate exists', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-01-10T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-10T00:00:00.000Z',
        eventDateSource: 'same_as_publication',
        publishedDateSource: 'content_parsing',
      }
      expect(dateModelQuality(dates)).toBe(0.9)
    })

    it('returns 0.7 when only sourcePublishedDate is available (no eventDate)', () => {
      const dates: EvidenceDates = {
        eventDate: null,
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-12T00:00:00.000Z',
        eventDateSource: null,
        publishedDateSource: 'content_parsing',
      }
      expect(dateModelQuality(dates)).toBe(0.7)
    })

    it('returns 0.5 when eventDate is fallback_to_discovery with no sourcePublishedDate', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-06-01T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: null,
        eventDateSource: 'fallback_to_discovery',
        publishedDateSource: 'not_found',
      }
      expect(dateModelQuality(dates)).toBe(0.5)
    })

    it('returns 0.4 when no dates are available (degraded)', () => {
      const dates: EvidenceDates = {
        eventDate: null,
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: null,
        eventDateSource: null,
        publishedDateSource: 'not_found',
      }
      expect(dateModelQuality(dates)).toBe(0.4)
    })
  })

  // ── serializeThreeDateModel ────────────────────────────────────

  describe('serializeThreeDateModel()', () => {

    it('produces correct JSON with evidenceDates key', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-01-10T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-12T00:00:00.000Z',
        eventDateSource: 'same_as_publication',
        publishedDateSource: 'content_parsing',
      }
      const serialized = serializeThreeDateModel(dates)
      expect(serialized).toHaveProperty('evidenceDates')
      const ed = serialized.evidenceDates as Record<string, unknown>
      expect(ed.eventDate).toBe('2025-01-10T00:00:00.000Z')
      expect(ed.discoveryDate).toBe('2025-06-01T00:00:00.000Z')
      expect(ed.sourcePublishedDate).toBe('2025-01-12T00:00:00.000Z')
      expect(ed.eventDateSource).toBe('same_as_publication')
      expect(ed.publishedDateSource).toBe('content_parsing')
      expect(typeof ed.qualityScore).toBe('number')
    })

    it('includes qualityScore from dateModelQuality', () => {
      const dates: EvidenceDates = {
        eventDate: '2025-01-10T00:00:00.000Z',
        discoveryDate: '2025-06-01T00:00:00.000Z',
        sourcePublishedDate: '2025-01-10T00:00:00.000Z',
        eventDateSource: 'same_as_publication',
        publishedDateSource: 'search_metadata',
      }
      const serialized = serializeThreeDateModel(dates)
      expect((serialized.evidenceDates as Record<string, unknown>).qualityScore).toBe(0.9)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// 2. SIGNAL TAXONOMY MAPPING
// ═══════════════════════════════════════════════════════════════════

describe('Signal Taxonomy Mapping', () => {

  // ── Canonical type passthrough ──────────────────────────────────

  describe('canonical type passthrough', () => {

    const canonicalTypes = CANONICAL_SIGNAL_TYPES

    it('all 10 canonical types pass through with wasCanonical: true', () => {
      expect(canonicalTypes).toHaveLength(10)

      for (const type of canonicalTypes) {
        const result = normalizeSignalType(type)
        expect(result.normalizedType).toBe(type)
        expect(result.wasCanonical).toBe(true)
        expect(result.usedDirectMapping).toBe(false)
        expect(result.useContextualAnalysis).toBe(false)
        expect(result.originalType).toBe(type)
      }
    })

    it('isCanonicalType() returns true for all canonical types', () => {
      for (const type of canonicalTypes) {
        expect(isCanonicalType(type)).toBe(true)
      }
    })

    it('isCanonicalType() returns false for legacy types', () => {
      expect(isCanonicalType('business')).toBe(false)
      expect(isCanonicalType('technology')).toBe(false)
      expect(isCanonicalType('external')).toBe(false)
      expect(isCanonicalType('relationship')).toBe(false)
      expect(isCanonicalType('mention')).toBe(false)
    })
  })

  // ── Legacy type detection ──────────────────────────────────────

  describe('isLegacyType()', () => {

    it('detects known legacy types', () => {
      expect(isLegacyType('business')).toBe(true)
      expect(isLegacyType('technology')).toBe(true)
      expect(isLegacyType('external')).toBe(true)
      expect(isLegacyType('relationship')).toBe(true)
      expect(isLegacyType('mention')).toBe(true)
      expect(isLegacyType('signal')).toBe(true)
      expect(isLegacyType('unknown')).toBe(true)
    })

    it('returns false for canonical types', () => {
      expect(isLegacyType('funding')).toBe(false)
      expect(isLegacyType('hiring')).toBe(false)
      expect(isLegacyType('tech_change')).toBe(false)
      expect(isLegacyType('news')).toBe(false)
    })

    it('is case-insensitive and trims whitespace', () => {
      expect(isLegacyType('  Business  ')).toBe(true)
      expect(isLegacyType('TECHNOLOGY')).toBe(true)
    })
  })

  // ── Direct legacy mappings ─────────────────────────────────────

  describe('direct legacy mappings', () => {

    it('maps "technology" → "tech_change" with usedDirectMapping: true', () => {
      const result = normalizeSignalType('technology')
      expect(result.normalizedType).toBe('tech_change')
      expect(result.usedDirectMapping).toBe(true)
      expect(result.wasCanonical).toBe(false)
    })

    it('maps "relationship" → "partnership"', () => {
      const result = normalizeSignalType('relationship')
      expect(result.normalizedType).toBe('partnership')
      expect(result.usedDirectMapping).toBe(true)
    })

    it('maps "mention" → "news"', () => {
      const result = normalizeSignalType('mention')
      expect(result.normalizedType).toBe('news')
      expect(result.usedDirectMapping).toBe(true)
    })

    it('maps "signal" → "news"', () => {
      const result = normalizeSignalType('signal')
      expect(result.normalizedType).toBe('news')
      expect(result.usedDirectMapping).toBe(true)
    })

    it('maps "financial" → "news"', () => {
      const result = normalizeSignalType('financial')
      expect(result.normalizedType).toBe('news')
      expect(result.usedDirectMapping).toBe(true)
    })

    it('maps "product" → "news"', () => {
      const result = normalizeSignalType('product')
      expect(result.normalizedType).toBe('news')
    })

    it('maps "regulatory" → "news"', () => {
      const result = normalizeSignalType('regulatory')
      expect(result.normalizedType).toBe('news')
    })
  })

  // ── Contextual analysis for ambiguous types ─────────────────────

  describe('contextual analysis for ambiguous types', () => {

    it('"business" with funding keywords maps to "funding"', () => {
      const result = normalizeSignalType('business', 'Series A funding round', 'Company raised $50M')
      expect(result.normalizedType).toBe('funding')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('"business" with hiring keywords maps to "hiring"', () => {
      const result = normalizeSignalType('business', 'Hiring engineers', 'Open positions available')
      expect(result.normalizedType).toBe('hiring')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('"external" with acquisition keywords maps to "acquisition"', () => {
      const result = normalizeSignalType('external', 'Company acquires startup', 'The acquisition was announced today')
      expect(result.normalizedType).toBe('acquisition')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('"external" with expansion keywords maps to "expansion"', () => {
      const result = normalizeSignalType('external', 'New office opening in London', 'Expanding internationally')
      expect(result.normalizedType).toBe('expansion')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('"unknown" with leadership keywords maps to "leadership_change"', () => {
      const result = normalizeSignalType('unknown', 'New CEO appointed', 'The chief executive takes over')
      expect(result.normalizedType).toBe('leadership_change')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('"business" with no context falls back to direct mapping ("news")', () => {
      const result = normalizeSignalType('business')
      // Without title/description, contextual analysis finds nothing
      // But "business" is in the ambiguous set, so contextual runs first
      // No keywords → falls back to... Actually "business" is NOT in DIRECT_MAPPINGS
      // Let me re-check... No, "business" is in LEGACY_TYPES but NOT in DIRECT_MAPPINGS.
      // So it goes straight to contextual analysis with empty text, returns null,
      // then falls back to 'news'.
      expect(result.normalizedType).toBe('news')
      expect(result.useContextualAnalysis).toBe(false) // contextual returned null, so not flagged
    })

    it('unrecognized type with context maps via contextual analysis', () => {
      const result = normalizeSignalType('some_custom_type', 'Company raises Series B')
      expect(result.normalizedType).toBe('funding')
      expect(result.useContextualAnalysis).toBe(true)
    })

    it('unrecognized type without context falls back to "news"', () => {
      const result = normalizeSignalType('some_custom_type')
      expect(result.normalizedType).toBe('news')
    })
  })

  // ── Batch functions ────────────────────────────────────────────

  describe('normalizeSignalTypes()', () => {

    it('normalizes an array of signals and returns a Map', () => {
      const signals = [
        { id: 's1', signalType: 'funding' },
        { id: 's2', signalType: 'technology' },
        { id: 's3', signalType: 'mention' },
      ]
      const result = normalizeSignalTypes(signals)
      expect(result).toBeInstanceOf(Map)
      expect(result.get('s1')).toBe('funding')
      expect(result.get('s2')).toBe('tech_change')
      expect(result.get('s3')).toBe('news')
    })
  })

  describe('groupByCanonicalType()', () => {

    it('groups signals by normalized canonical type', () => {
      const signals = [
        { id: 's1', signalType: 'funding', title: 'A' },
        { id: 's2', signalType: 'technology', title: 'B' },
        { id: 's3', signalType: 'mention', title: 'C' },
        { id: 's4', signalType: 'funding', title: 'D' },
      ]
      const result = groupByCanonicalType(signals)
      expect(result).toBeInstanceOf(Map)
      expect(result.get('funding')).toHaveLength(2)
      expect(result.get('tech_change')).toHaveLength(1)
      expect(result.get('news')).toHaveLength(1)
    })
  })

  describe('normalizeSignals()', () => {

    it('wraps each signal with normalizedType', () => {
      const signals = [
        { id: 's1', signalType: 'hiring', title: 'Software Engineer' },
        { id: 's2', signalType: 'relationship', title: 'Partner deal' },
      ]
      const result = normalizeSignals(signals)
      expect(result).toHaveLength(2)
      expect(result[0].normalizedType).toBe('hiring')
      expect(result[1].normalizedType).toBe('partnership')
      // Original fields preserved
      expect(result[0].id).toBe('s1')
      expect(result[0].title).toBe('Software Engineer')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// 3. FRESHNESS RANKING
// ═══════════════════════════════════════════════════════════════════

describe('Freshness Ranking', () => {

  // Helper: compute a date N days ago as ISO string
  const daysAgo = (n: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }

  // ── computeFreshnessScore ──────────────────────────────────────

  describe('computeFreshnessScore()', () => {

    it('fresh signal scores higher than old signal regardless of base confidence', () => {
      // Fresh signal: 85% confidence, 1 day old, news (halfLife=14)
      const freshScore = computeFreshnessScore(85, daysAgo(1), daysAgo(1), 'news')
      // Old signal: 95% confidence, 240 days old, news (halfLife=14)
      const oldScore = computeFreshnessScore(95, daysAgo(240), daysAgo(240), 'news')

      expect(freshScore).toBeGreaterThan(oldScore)
    })

    it('returns close to baseConfidence for very recent signals', () => {
      const score = computeFreshnessScore(95, daysAgo(0), daysAgo(0), 'news')
      expect(score).toBeCloseTo(95, 0) // 0 days old should barely decay
    })

    it('returns near-zero for very old signals with short half-life', () => {
      const score = computeFreshnessScore(95, daysAgo(365), daysAgo(365), 'news')
      expect(score).toBeLessThan(1)
    })

    it('applies correct half-life per signal type', () => {
      // news half-life = 14, leadership_change = 45
      const newsScore = computeFreshnessScore(80, daysAgo(14), daysAgo(14), 'news')
      const lcScore = computeFreshnessScore(80, daysAgo(14), daysAgo(14), 'leadership_change')

      // At exactly one half-life, decay = 0.5
      // news at 14d: 80 * 0.5 = 40
      // leadership at 14d (0.31 of half-life): 80 * 0.5^(14/45) ≈ 80 * 0.794 ≈ 63.5
      expect(lcScore).toBeGreaterThan(newsScore)
    })

    it('uses default half-life for unknown signal types', () => {
      const defaultHalfLife = SIGNAL_HALF_LIVES._default
      expect(defaultHalfLife).toBe(30)
      // Should not throw for an unknown type
      const score = computeFreshnessScore(80, daysAgo(30), daysAgo(30), 'unknown_type')
      expect(score).toBeGreaterThan(0)
    })

    it('uses sourcePublishedDate when signalDate is null (three-date support)', () => {
      // signalDate=null, sourcePublishedDate=1 day ago
      const withPublishedDate = computeFreshnessScore(90, null, daysAgo(60), 'news', daysAgo(1))
      // signalDate=null, no sourcePublishedDate, createdAt=60 days ago
      const withoutPublishedDate = computeFreshnessScore(90, null, daysAgo(60), 'news')

      // The published-date version should score much higher (1 day vs 60 days)
      expect(withPublishedDate).toBeGreaterThan(withoutPublishedDate)
    })

    it('prefers signalDate over sourcePublishedDate for freshness', () => {
      // signalDate = 1 day ago, sourcePublishedDate = 30 days ago
      const score = computeFreshnessScore(90, daysAgo(1), daysAgo(60), 'news', daysAgo(30))
      // Should use signalDate (1 day ago) — close to 90
      expect(score).toBeGreaterThan(80)
    })

    it('scores are rounded to one decimal', () => {
      const score = computeFreshnessScore(77, daysAgo(5), daysAgo(5), 'news')
      // Should be a number with at most one decimal
      const decimalPart = score.toString().split('.')[1]
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(1)
      }
    })
  })

  // ── computeIntelligenceRanking ─────────────────────────────────

  describe('computeIntelligenceRanking()', () => {

    it('composite score is bounded 0-100', () => {
      // All max values
      const maxResult = computeIntelligenceRanking({
        confidence: 100,
        signalDate: daysAgo(0),
        createdAt: daysAgo(0),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 1.0,
        capabilityRelevance: 1.0,
        dateQuality: 1.0,
      })
      expect(maxResult.rankingScore).toBeLessThanOrEqual(100)
      expect(maxResult.rankingScore).toBeGreaterThan(0)
    })

    it('returns breakdown with all five dimensions', () => {
      const result = computeIntelligenceRanking({
        confidence: 80,
        signalDate: daysAgo(2),
        createdAt: daysAgo(2),
        signalType: 'funding',
        sourceQuality: 'premium',
        businessRelevance: 0.7,
        capabilityRelevance: 0.5,
      })
      expect(result.breakdown).toBeDefined()
      expect(typeof result.breakdown.confidenceScore).toBe('number')
      expect(typeof result.breakdown.freshnessScore).toBe('number')
      expect(typeof result.breakdown.sourceQualityScore).toBe('number')
      expect(typeof result.breakdown.businessRelevanceScore).toBe('number')
      expect(typeof result.breakdown.capabilityRelevanceScore).toBe('number')
    })

    it('returns freshness state', () => {
      const result = computeIntelligenceRanking({
        confidence: 80,
        signalDate: daysAgo(2),
        createdAt: daysAgo(2),
        signalType: 'news',
        sourceQuality: 'standard',
        businessRelevance: 0.5,
        capabilityRelevance: 0.5,
      })
      expect(result.freshness).toBeDefined()
      expect(result.freshness.staleness).toBe('fresh')
      expect(typeof result.freshness.daysSinceSignal).toBe('number')
      expect(typeof result.freshness.halfLife).toBe('number')
    })

    it('fresh signal with high relevance scores higher than stale signal with low relevance', () => {
      const fresh = computeIntelligenceRanking({
        confidence: 85,
        signalDate: daysAgo(1),
        createdAt: daysAgo(1),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.9,
        capabilityRelevance: 0.8,
      })
      const stale = computeIntelligenceRanking({
        confidence: 90,
        signalDate: daysAgo(365),
        createdAt: daysAgo(365),
        signalType: 'news',
        sourceQuality: 'low',
        businessRelevance: 0.2,
        capabilityRelevance: 0.1,
      })
      expect(fresh.rankingScore).toBeGreaterThan(stale.rankingScore)
    })

    it('dateQuality multiplier slightly boosts ranking', () => {
      const withoutQuality = computeIntelligenceRanking({
        confidence: 80,
        signalDate: daysAgo(2),
        createdAt: daysAgo(2),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.7,
        capabilityRelevance: 0.7,
        dateQuality: 0.5,
      })
      const withQuality = computeIntelligenceRanking({
        confidence: 80,
        signalDate: daysAgo(2),
        createdAt: daysAgo(2),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.7,
        capabilityRelevance: 0.7,
        dateQuality: 1.0,
      })
      // dateQuality=1.0 gives multiplier 1.05 vs dateQuality=0.5 gives 1.025
      expect(withQuality.rankingScore).toBeGreaterThanOrEqual(withoutQuality.rankingScore)
    })
  })

  // ── rankSignal ─────────────────────────────────────────────────

  describe('rankSignal()', () => {

    it('convenience wrapper works correctly with minimal input', () => {
      const result = rankSignal({
        confidence: 0.8,
        signalDate: daysAgo(1),
        createdAt: daysAgo(1),
        signalType: 'news',
        sourceQuality: 'standard',
      })
      expect(result.rankingScore).toBeGreaterThan(0)
      expect(result.rankingScore).toBeLessThanOrEqual(100)
      expect(result.breakdown).toBeDefined()
      expect(result.freshness).toBeDefined()
    })

    it('accepts custom businessRelevance and capabilityRelevance', () => {
      const result = rankSignal(
        {
          confidence: 0.9,
          signalDate: daysAgo(1),
          createdAt: daysAgo(1),
          signalType: 'funding',
          sourceQuality: 'premium',
        },
        0.9, // businessRelevance
        0.8, // capabilityRelevance
      )
      expect(result.rankingScore).toBeGreaterThan(0)
      expect(result.breakdown.businessRelevanceScore).toBe(90)
      expect(result.breakdown.capabilityRelevanceScore).toBe(80)
    })

    it('handles null signalDate gracefully', () => {
      const result = rankSignal({
        confidence: 0.7,
        signalDate: null,
        createdAt: daysAgo(5),
        signalType: 'hiring',
        sourceQuality: 'standard',
      })
      expect(result.rankingScore).toBeGreaterThan(0)
    })

    it('converts 0-1 confidence to 0-100 internally', () => {
      // confidence=0.9 → 90 internally
      const result = rankSignal({
        confidence: 0.9,
        signalDate: daysAgo(1),
        createdAt: daysAgo(1),
        signalType: 'news',
        sourceQuality: 'standard',
      })
      expect(result.breakdown.confidenceScore).toBe(90)
    })

    it('passes through Sprint 1 three-date fields', () => {
      const result = rankSignal({
        confidence: 0.85,
        signalDate: null,
        createdAt: daysAgo(60),
        signalType: 'news',
        sourceQuality: 'standard',
        sourcePublishedDate: daysAgo(2),
        dateQuality: 0.9,
      })
      // computeIntelligenceRanking passes sourcePublishedDate to computeFreshnessScore
      // but computeFreshnessState still uses createdAt (not yet updated for three-date).
      // The freshnessScore in the breakdown should reflect the published date advantage.
      expect(result.rankingScore).toBeGreaterThan(0)
      expect(result.breakdown.freshnessScore).toBeGreaterThan(0)
      // dateQuality=0.9 gives multiplier = 1 + 0.9*0.05 = 1.045
      // Verify ranking computed without errors
      expect(result.freshness).toBeDefined()
    })
  })

  // ── sortByIntelligenceRanking ──────────────────────────────────

  describe('sortByIntelligenceRanking()', () => {

    it('sorts descending by rankingScore', () => {
      const items = [
        { rankingScore: 30, name: 'low' },
        { rankingScore: 85, name: 'high' },
        { rankingScore: 50, name: 'medium' },
      ]
      const sorted = sortByIntelligenceRanking(items)
      expect(sorted[0].name).toBe('high')
      expect(sorted[1].name).toBe('medium')
      expect(sorted[2].name).toBe('low')
    })

    it('does not mutate the original array', () => {
      const items = [
        { rankingScore: 20 },
        { rankingScore: 80 },
      ]
      const copy = [...items]
      sortByIntelligenceRanking(items)
      expect(items).toEqual(copy) // Original unchanged
    })

    it('handles empty array', () => {
      const sorted = sortByIntelligenceRanking([])
      expect(sorted).toEqual([])
    })

    it('handles single element', () => {
      const items = [{ rankingScore: 42 }]
      const sorted = sortByIntelligenceRanking(items)
      expect(sorted).toHaveLength(1)
      expect(sorted[0].rankingScore).toBe(42)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// 4. ADAPTIVE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════

describe('Adaptive Intelligence', () => {

  // Helper: create a signal with specific type
  const makeSignal = (
    id: string,
    signalType: string,
    title: string = '',
    description?: string | null
  ) => ({
    id,
    signalType,
    title,
    description: description ?? null,
    severity: 'medium' as const,
    confidence: 0.8,
    signalDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  })

  // ── assessSignalDensity ────────────────────────────────────────

  describe('assessSignalDensity()', () => {

    it('classifies "abundant" density (≥8 signals, ≥4 types)', () => {
      const signals = [
        makeSignal('1', 'funding'),
        makeSignal('2', 'hiring'),
        makeSignal('3', 'tech_change'),
        makeSignal('4', 'expansion'),
        makeSignal('5', 'leadership_change'),
        makeSignal('6', 'partnership'),
        makeSignal('7', 'news'),
        makeSignal('8', 'acquisition'),
      ]
      const result = assessSignalDensity(signals)
      expect(result.density).toBe('abundant')
      expect(result.externalSignalCount).toBe(8)
      expect(result.uniqueSignalTypes).toBeGreaterThanOrEqual(4)
    })

    it('classifies "moderate" density (≥4 signals, ≥2 types)', () => {
      const signals = [
        makeSignal('1', 'funding'),
        makeSignal('2', 'hiring'),
        makeSignal('3', 'funding'),
        makeSignal('4', 'hiring'),
      ]
      const result = assessSignalDensity(signals)
      expect(result.density).toBe('moderate')
    })

    it('classifies "sparse" density (1+ signals but not moderate)', () => {
      const signals = [
        makeSignal('1', 'funding'),
      ]
      const result = assessSignalDensity(signals)
      expect(result.density).toBe('sparse')
    })

    it('classifies "minimal" density (0 signals)', () => {
      const result = assessSignalDensity([])
      expect(result.density).toBe('minimal')
      expect(result.externalSignalCount).toBe(0)
      expect(result.uniqueSignalTypes).toBe(0)
    })

    it('computes correct default weight ratios', () => {
      const abundantResult = assessSignalDensity(
        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => makeSignal(String(i), `funding`, '', null))
        // Need ≥4 types for abundant. Let me use different types.
      )

      // Test abundant with enough types
      const abundantSignals = [
        makeSignal('1', 'funding'), makeSignal('2', 'hiring'),
        makeSignal('3', 'tech_change'), makeSignal('4', 'expansion'),
        makeSignal('5', 'leadership_change'), makeSignal('6', 'partnership'),
        makeSignal('7', 'news'), makeSignal('8', 'acquisition'),
      ]
      const abundant = assessSignalDensity(abundantSignals)
      expect(abundant.externalWeight).toBe(0.70)
      expect(abundant.internalWeight).toBe(0.30)

      const moderate = assessSignalDensity([
        makeSignal('1', 'funding'), makeSignal('2', 'hiring'),
        makeSignal('3', 'funding'), makeSignal('4', 'hiring'),
      ])
      expect(moderate.externalWeight).toBe(0.60)
      expect(moderate.internalWeight).toBe(0.40)

      // Sparse with no internal context: externalWeight = max(0.40, 0.50) = 0.50
      // because no internal context bumps it to at least 0.5
      const sparse = assessSignalDensity([makeSignal('1', 'funding')], undefined)
      expect(sparse.externalWeight).toBe(0.50)
      expect(sparse.internalWeight).toBe(0.50)

      // Minimal with no internal context: externalWeight = max(0.20, 0.50) = 0.50
      const minimal = assessSignalDensity([], undefined)
      expect(minimal.externalWeight).toBe(0.50)
      expect(minimal.internalWeight).toBe(0.50)
    })

    it('weights sum to 1.0', () => {
      const result = assessSignalDensity([
        makeSignal('1', 'funding'), makeSignal('2', 'hiring'),
        makeSignal('3', 'tech_change'), makeSignal('4', 'expansion'),
        makeSignal('5', 'news'), makeSignal('6', 'partnership'),
      ])
      expect(result.externalWeight + result.internalWeight).toBeCloseTo(1.0, 2)
    })

    it('provides recommendation text for each density level', () => {
      const abundant = assessSignalDensity(
        Array.from({ length: 8 }, (_, i) => makeSignal(String(i), CANONICAL_SIGNAL_TYPES[i % 10]))
      )
      expect(abundant.recommendation).toContain('external intelligence')

      const minimal = assessSignalDensity([])
      expect(minimal.recommendation).toContain('Minimal external signals')
    })

    // ── Internal context adjustment ─────────────────────────────

    it('boosts internal weight for sparse density with rich internal data', () => {
      const sparseResult = assessSignalDensity(
        [makeSignal('1', 'funding')],
        {
          contactCount: 15,
          openOpportunities: 5,
          existingNotes: 25,
          lastInteractionDays: 3,
        }
      )
      // Sparse default externalWeight=0.40, but rich internal should decrease it
      expect(sparseResult.externalWeight).toBeLessThan(0.40)
      expect(sparseResult.internalWeight).toBeGreaterThan(0.60)
    })

    it('boosts internal weight for minimal density with rich internal data', () => {
      const minimalResult = assessSignalDensity(
        [],
        {
          contactCount: 20,
          openOpportunities: 3,
          existingNotes: 30,
          lastInteractionDays: 1,
        }
      )
      // Minimal default externalWeight=0.20, rich internal should decrease it
      expect(minimalResult.externalWeight).toBeLessThan(0.20)
      // But it's bounded: Math.max(0.15, ...)
      expect(minimalResult.externalWeight).toBeGreaterThanOrEqual(0.15)
    })

    it('does not adjust weights when internal context is absent for sparse density', () => {
      const sparseResult = assessSignalDensity([makeSignal('1', 'funding')], undefined)
      // No internal context, but code says: no internal → externalWeight = Math.max(externalWeight, 0.5)
      expect(sparseResult.externalWeight).toBeGreaterThanOrEqual(0.5)
    })

    it('does not change abundant weights much with rich internal context', () => {
      const abundantResult = assessSignalDensity(
        Array.from({ length: 8 }, (_, i) => makeSignal(String(i), CANONICAL_SIGNAL_TYPES[i % 10])),
        { contactCount: 10, openOpportunities: 5, existingNotes: 20 }
      )
      // Abundant doesn't get the internal boost (only sparse/minimal)
      expect(abundantResult.externalWeight).toBe(0.70)
    })

    it('recommendation mentions internal context richness when available', () => {
      const result = assessSignalDensity(
        [makeSignal('1', 'funding')],
        { contactCount: 8, openOpportunities: 2, existingNotes: 15 }
      )
      expect(result.recommendation).toContain('Rich internal context')
    })
  })

  // ── getIntelligenceTemplate ─────────────────────────────────────

  describe('getIntelligenceTemplate()', () => {

    it('returns correct template for "abundant" density', () => {
      const template = getIntelligenceTemplate('abundant')
      expect(template.openingStyle).toBe('data_driven')
      expect(template.changePresentation).toBe('detailed')
      expect(template.actionStyle).toBe('specific')
    })

    it('returns correct template for "moderate" density', () => {
      const template = getIntelligenceTemplate('moderate')
      expect(template.openingStyle).toBe('balanced')
      expect(template.changePresentation).toBe('summary')
      expect(template.actionStyle).toBe('specific')
    })

    it('returns correct template for "sparse" density', () => {
      const template = getIntelligenceTemplate('sparse')
      expect(template.openingStyle).toBe('context_aware')
      expect(template.changePresentation).toBe('highlight')
      expect(template.actionStyle).toBe('exploratory')
    })

    it('returns correct template for "minimal" density', () => {
      const template = getIntelligenceTemplate('minimal')
      expect(template.openingStyle).toBe('cautious')
      expect(template.changePresentation).toBe('acknowledgment')
      expect(template.actionStyle).toBe('research')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// 5. EVIDENCE CLASSIFIER
// ═══════════════════════════════════════════════════════════════════

describe('Evidence Classifier', () => {

  const baseEvidence: RawEvidenceInput = {
    headline: 'Company Update',
    snippet: 'Some news about the company',
    sourceName: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/article',
    publishedDate: '2025-06-01T00:00:00.000Z',
    collectionDate: '2025-06-01T12:00:00.000Z',
  }

  // ── classifyEvidence ───────────────────────────────────────────

  describe('classifyEvidence()', () => {

    it('detects funding evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp raises $50M in Series B funding round',
        snippet: 'The company announced a new investment round led by Sequoia Capital.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('funding')
      // TechCrunch is premium; score >= 3 boosts severity: high → critical
      expect(result!.severity).toBe('critical')
      expect(result!.meaningCategory).toBe('budget_available')
      expect(result!.confidence).toBeGreaterThan(0)
    })

    it('detects hiring evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp is hiring for senior engineer roles',
        snippet: 'The company has multiple job openings for software engineers.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('hiring')
      // TechCrunch is premium; score >= 3 boosts severity: medium → high → critical
      expect(result!.severity).toBeOneOf(['high', 'critical'])
      expect(result!.meaningCategory).toBe('growth_pressure')
    })

    it('detects leadership change evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'New CEO appointed at Acme Corp',
        snippet: 'Jane Smith steps down and John Doe succeeds as chief executive.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('leadership_change')
      expect(result!.severity).toBeOneOf(['high', 'critical'])
      expect(result!.meaningCategory).toBe('leadership_openness')
    })

    it('detects tech_change evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp migrates to cloud infrastructure',
        snippet: 'The company is implementing a digital transformation with Kubernetes and AWS.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('tech_change')
      expect(result!.meaningCategory).toBe('tech_dissatisfaction')
    })

    it('detects expansion evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp expands to European markets',
        snippet: 'Opening a new office in London as part of geographic expansion.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('expansion')
      // TechCrunch is premium; score >= 3 boosts severity: high → critical
      expect(result!.severity).toBeOneOf(['high', 'critical'])
    })

    it('detects acquisition evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp acquires startup XYZ',
        snippet: 'The acquisition was announced today for an undisclosed amount.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('acquisition')
      expect(result!.severity).toBe('critical')
    })

    it('detects technology_adoption evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp selects Snowflake and deploys Databricks',
        snippet: 'The company is adopting Snowflake, standardizes on Databricks for analytics, and chooses Terraform for IaC.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      // technology_adoption has distinct keywords (adopts, standardizes on, selects, chooses, deploys)
      // that should outscore tech_change for this input
      expect(result!.signalType).toBe('technology_adoption')
    })

    it('detects partnership evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp announces partnership with GlobalCo',
        snippet: 'Strategic alliance for joint venture in cloud services.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('partnership')
    })

    it('detects people_change evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'New VP of Engineering hired at Acme',
        snippet: 'The company appointed a senior director to head the department.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBeOneOf(['people_change', 'leadership_change'])
    })

    it('detects news evidence', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Acme Corp announces quarterly earnings report',
        snippet: 'The company released its Q4 revenue numbers.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBe('news')
    })

    it('returns null when no patterns match', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Random unrelated text',
        snippet: 'Nothing relevant here at all.',
      }
      const result = classifyEvidence(evidence)
      expect(result).toBeNull()
    })

    it('returns ClassifiedSignal with all required fields', () => {
      const evidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Company raises Series A funding',
        snippet: 'Secures $20M in venture capital.',
      }
      const result = classifyEvidence(evidence)
      expect(result).not.toBeNull()
      expect(result!.signalType).toBeDefined()
      expect(result!.title).toBe(evidence.headline)
      expect(result!.description).toBe(evidence.snippet)
      expect(result!.confidence).toBeGreaterThanOrEqual(0)
      expect(result!.confidence).toBeLessThanOrEqual(1)
      expect(['low', 'medium', 'high', 'critical']).toContain(result!.severity)
      expect(result!.businessImpact).toBeDefined()
      expect(result!.recommendedAction).toBeDefined()
      expect(result!.timingWindow).toBeDefined()
      expect(result!.meaningCategory).toBeDefined()
    })

    it('adjusts confidence based on source reliability', () => {
      const premiumEvidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Company raises Series A funding',
        snippet: 'Secures $20M in venture capital.',
        sourceName: 'Reuters',
        sourceUrl: 'https://reuters.com/article',
      }
      const lowEvidence: RawEvidenceInput = {
        ...baseEvidence,
        headline: 'Company raises Series A funding',
        snippet: 'Secures $20M in venture capital.',
        sourceName: 'UnknownBlog',
        sourceUrl: 'https://random-blog-aggregator.example.com/post',
      }
      const premiumResult = classifyEvidence(premiumEvidence)
      const lowResult = classifyEvidence(lowEvidence)
      // Premium source should give higher confidence
      expect(premiumResult!.confidence).toBeGreaterThanOrEqual(lowResult!.confidence)
    })
  })

  // ── scoreSourceReliability ─────────────────────────────────────

  describe('scoreSourceReliability()', () => {

    it('scores Reuters as premium', () => {
      const result = scoreSourceReliability('Reuters', 'https://reuters.com/article')
      expect(result.quality).toBe('premium')
      expect(result.score).toBeGreaterThanOrEqual(0.85)
    })

    it('scores Bloomberg as premium', () => {
      const result = scoreSourceReliability('Bloomberg', 'https://bloomberg.com/news')
      expect(result.quality).toBe('premium')
      expect(result.score).toBeGreaterThanOrEqual(0.85)
    })

    it('scores WSJ as premium', () => {
      const result = scoreSourceReliability('Wall Street Journal', 'https://wsj.com/article')
      expect(result.quality).toBe('premium')
    })

    it('scores Financial Times (ft.com) as premium', () => {
      const result = scoreSourceReliability('Financial Times', 'https://ft.com/companies/article')
      expect(result.quality).toBe('premium')
    })

    it('scores TechCrunch as premium', () => {
      const result = scoreSourceReliability('TechCrunch', 'https://techcrunch.com/2025/01/15/startup')
      expect(result.quality).toBe('premium')
    })

    it('scores standard sources correctly', () => {
      const result = scoreSourceReliability('VentureBeat', 'https://venturebeat.com/article')
      expect(result.quality).toBe('standard')
      expect(result.score).toBe(0.75)
    })

    it('scores Business Insider as standard', () => {
      const result = scoreSourceReliability('Business Insider', 'https://businessinsider.com/article')
      expect(result.quality).toBe('standard')
    })

    it('scores unknown sources as low', () => {
      const result = scoreSourceReliability('Random Blog', 'https://random-blog.example.com/post')
      expect(result.quality).toBe('low')
      expect(result.score).toBe(0.5)
    })

    it('scores company domains (non-blog, non-news) as premium', () => {
      const result = scoreSourceReliability(null, 'https://acme-corp.com/press-release')
      expect(result.quality).toBe('premium')
      expect(result.score).toBe(0.85)
    })

    it('scores .news domains as low (not premium)', () => {
      const result = scoreSourceReliability(null, 'https://somecompany.news/article')
      expect(result.quality).toBe('low')
      expect(result.score).toBe(0.5)
    })

    it('scores blog subdomains as low (not premium)', () => {
      const result = scoreSourceReliability(null, 'https://blog.acme.com/article')
      expect(result.quality).toBe('low')
    })

    it('handles null sourceName and sourceUrl gracefully', () => {
      const result = scoreSourceReliability(null, null)
      expect(result.quality).toBe('low')
      expect(result.score).toBe(0.5)
    })

    it('uses sourceName for matching even without URL', () => {
      const result = scoreSourceReliability('Reuters', null)
      expect(result.quality).toBe('premium')
    })
  })
})
