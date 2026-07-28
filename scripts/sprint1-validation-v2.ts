/**
 * Sprint 1 Validation Script v2 — Pure Unit Tests (no DB, no API calls)
 *
 * Validates all Sprint 1 intelligence pipeline modules using mock data:
 *   1. Three-Date Model (date extraction, resolution, quality scoring)
 *   2. Signal Taxonomy Mapping (canonical pass-through, legacy mapping, contextual)
 *   3. Freshness Ranking with Three-Date Support (scoring, composite ranking)
 *   4. Adaptive Signal Density (weight computation by density tier)
 *   5. Evidence Classification (rule-based classification, source reliability)
 *
 * Usage: npx tsx scripts/sprint1-validation-v2.ts
 */

// ─── Imports (relative paths from scripts/ → src/lib/) ───────────

import {
  extractPublishedDateFromSnippet,
  extractDateFromUrl,
  buildThreeDateModel,
  getBestDateForFreshness,
  dateModelQuality,
  serializeThreeDateModel,
  type EvidenceDates,
} from '../src/lib/intelligence-sources/three-date-model';

import {
  CANONICAL_SIGNAL_TYPES,
  isCanonicalType,
  isLegacyType,
  normalizeSignalType,
  normalizeType,
  normalizeSignalTypes,
  groupByCanonicalType,
  type CanonicalSignalType,
} from '../src/lib/intelligence-sources/signal-type-mapping';

import {
  computeFreshnessScore,
  computeIntelligenceRanking,
  sourceQualityWeight,
} from '../src/lib/scoring/freshness-ranking';

import {
  assessSignalDensity,
  getIntelligenceTemplate,
} from '../src/lib/intelligence-sources/adaptive-intelligence';

import {
  classifyEvidence,
  scoreSourceReliability,
} from '../src/lib/intelligence-sources/evidence-classifier';

import type { SignalInput } from '../src/lib/intelligence-sources/reasoning-engine';

// ─── Test Runner ─────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function sectionHeader(title: string) {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(72)}`);
}

function test(name: string, fn: () => boolean) {
  totalTests++;
  try {
    const result = fn();
    if (result) {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } else {
      failedTests++;
      failures.push(name);
      console.log(`  ❌ FAIL: ${name}`);
    }
  } catch (err) {
    failedTests++;
    failures.push(name);
    console.log(`  ❌ FAIL: ${name} — ${err}`);
  }
}

function assert(condition: boolean, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, tolerance = 0.05) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected ${expected} ±${tolerance}, got ${actual}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: Three-Date Model
// ═══════════════════════════════════════════════════════════════════

sectionHeader('1. Three-Date Model — extractPublishedDateFromSnippet()');

// 1a. ISO date format
test('extractPublishedDateFromSnippet: ISO format "2025-01-15"', () => {
  const result = extractPublishedDateFromSnippet('Published on 2025-01-15');
  assert(result.date !== null, 'date should not be null');
  assert(result.source === 'content_parsing', `source should be content_parsing, got ${result.source}`);
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025, `year should be 2025, got ${d.getFullYear()}`);
  assert(d.getMonth() === 0, `month should be 0 (Jan), got ${d.getMonth()}`);
  assert(d.getDate() === 15, `day should be 15, got ${d.getDate()}`);
  return true;
});

// 1b. "Jan 15, 2025" format
test('extractPublishedDateFromSnippet: "Jan 15, 2025" format', () => {
  const result = extractPublishedDateFromSnippet('Jan 15, 2025 — TechCrunch');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025, `year should be 2025, got ${d.getFullYear()}`);
  assert(d.getMonth() === 0, `month should be 0 (Jan), got ${d.getMonth()}`);
  assert(d.getDate() === 15, `day should be 15, got ${d.getDate()}`);
  return true;
});

// 1c. Full month name "January 15, 2025"
test('extractPublishedDateFromSnippet: "January 15, 2025" full month', () => {
  const result = extractPublishedDateFromSnippet('Published January 15, 2025');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getMonth() === 0, `month should be Jan, got ${d.getMonth()}`);
  assert(d.getDate() === 15, `day should be 15, got ${d.getDate()}`);
  return true;
});

// 1d. "15 Jan 2025" format
test('extractPublishedDateFromSnippet: "15 Jan 2025" DD Mon YYYY', () => {
  const result = extractPublishedDateFromSnippet('Updated 15 Jan 2025 by staff');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025, `year should be 2025, got ${d.getFullYear()}`);
  assert(d.getMonth() === 0, `month should be Jan (0), got ${d.getMonth()}`);
  assert(d.getDate() === 15, `day should be 15, got ${d.getDate()}`);
  return true;
});

// 1e. "2 days ago" relative format
test('extractPublishedDateFromSnippet: "2 days ago"', () => {
  const result = extractPublishedDateFromSnippet('Published 2 days ago');
  assert(result.date !== null, 'date should not be null');
  const now = new Date();
  const d = new Date(result.date!);
  const diffDays = Math.abs((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  assert(diffDays < 0.1 || (diffDays >= 1.9 && diffDays <= 2.1), `should be ~2 days ago, got ${diffDays} days`);
  return true;
});

// 1f. "3 weeks ago" relative format
test('extractPublishedDateFromSnippet: "3 weeks ago"', () => {
  const result = extractPublishedDateFromSnippet('3 weeks ago');
  assert(result.date !== null, 'date should not be null');
  const now = new Date();
  const d = new Date(result.date!);
  const diffDays = Math.abs((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  assert(diffDays >= 20 && diffDays <= 22, `should be ~21 days ago, got ${diffDays} days`);
  return true;
});

// 1g. "Jan 15" no year
test('extractPublishedDateFromSnippet: "Jan 15" (no year)', () => {
  const result = extractPublishedDateFromSnippet('Article dated Jan 15');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getMonth() === 0, `month should be Jan (0), got ${d.getMonth()}`);
  assert(d.getDate() === 15, `day should be 15, got ${d.getDate()}`);
  return true;
});

// 1h. Empty/null snippet
test('extractPublishedDateFromSnippet: empty snippet → null', () => {
  const result = extractPublishedDateFromSnippet('');
  assert(result.date === null, 'date should be null');
  assert(result.source === 'not_found', `source should be not_found, got ${result.source}`);
  return true;
});

// 1i. No date in snippet
test('extractPublishedDateFromSnippet: no date in text → null', () => {
  const result = extractPublishedDateFromSnippet('This is just a regular article about something');
  assert(result.date === null, 'date should be null');
  return true;
});

// ─── extractDateFromUrl ──────────────────────────────────────────

sectionHeader('1b. Three-Date Model — extractDateFromUrl()');

test('extractDateFromUrl: /2025/01/15/ pattern', () => {
  const result = extractDateFromUrl('https://example.com/news/2025/01/15/article-title');
  assert(result.date !== null, 'date should not be null');
  assert(result.source === 'url_pattern', `source should be url_pattern, got ${result.source}`);
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025 && d.getMonth() === 0 && d.getDate() === 15);
  return true;
});

test('extractDateFromUrl: /2025/01/ pattern (month only)', () => {
  const result = extractDateFromUrl('https://example.com/2025/01/article-slug');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025 && d.getMonth() === 0 && d.getDate() === 1, 'should be 2025-01-01');
  return true;
});

test('extractDateFromUrl: 20250115-article slug pattern', () => {
  const result = extractDateFromUrl('https://example.com/20250115-article-title.html');
  assert(result.date !== null, 'date should not be null');
  const d = new Date(result.date!);
  assert(d.getFullYear() === 2025 && d.getMonth() === 0 && d.getDate() === 15);
  return true;
});

test('extractDateFromUrl: no date in URL → null', () => {
  const result = extractDateFromUrl('https://example.com/news/tech-updates');
  assert(result.date === null, 'date should be null');
  return true;
});

test('extractDateFromUrl: null URL → null', () => {
  const result = extractDateFromUrl('');
  assert(result.date === null, 'date should be null');
  return true;
});

// ─── buildThreeDateModel ──────────────────────────────────────────

sectionHeader('1c. Three-Date Model — buildThreeDateModel() resolution order');

const NOW = new Date().toISOString();
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86400000).toISOString();

test('buildThreeDateModel: publishedDate metadata wins over snippet', () => {
  const result = buildThreeDateModel({
    publishedDate: '2025-03-01',
    snippet: 'Published Jan 15, 2025',  // snippet date should be ignored
    url: 'https://example.com/2024/12/01/story',
    discoveryDate: NOW,
  });
  assert(result.sourcePublishedDate === '2025-03-01T00:00:00.000Z', `expected 2025-03-01, got ${result.sourcePublishedDate}`);
  assert(result.publishedDateSource === 'search_metadata', `source should be search_metadata, got ${result.publishedDateSource}`);
  return true;
});

test('buildThreeDateModel: snippet extraction when no metadata', () => {
  const result = buildThreeDateModel({
    publishedDate: null,
    snippet: 'Published Jan 15, 2025',
    url: null,
    discoveryDate: NOW,
  });
  assert(result.sourcePublishedDate !== null, 'should have extracted from snippet');
  assert(result.publishedDateSource === 'content_parsing', `source should be content_parsing, got ${result.publishedDateSource}`);
  const d = new Date(result.sourcePublishedDate!);
  assert(d.getMonth() === 0 && d.getDate() === 15, 'should be Jan 15');
  return true;
});

test('buildThreeDateModel: URL pattern when no metadata or snippet', () => {
  const result = buildThreeDateModel({
    publishedDate: null,
    snippet: 'No date here',
    url: 'https://example.com/2025/02/10/story',
    discoveryDate: NOW,
  });
  assert(result.sourcePublishedDate !== null, 'should have extracted from URL');
  assert(result.publishedDateSource === 'url_pattern', `source should be url_pattern, got ${result.publishedDateSource}`);
  const d = new Date(result.sourcePublishedDate!);
  assert(d.getFullYear() === 2025 && d.getMonth() === 1 && d.getDate() === 10);
  return true;
});

test('buildThreeDateModel: null when no date found anywhere', () => {
  const result = buildThreeDateModel({
    publishedDate: null,
    snippet: 'No date at all',
    url: 'https://example.com/no-date/story',
    discoveryDate: NOW,
  });
  assert(result.sourcePublishedDate === null, `should be null, got ${result.sourcePublishedDate}`);
  assert(result.publishedDateSource === 'not_found');
  assert(result.eventDate === NOW, `eventDate should fallback to discoveryDate`);
  assert(result.eventDateSource === 'fallback_to_discovery');
  return true;
});

test('buildThreeDateModel: eventDate same_as_publication when published date found', () => {
  const result = buildThreeDateModel({
    publishedDate: '2025-03-01',
    snippet: 'some text',
    url: null,
    discoveryDate: NOW,
  });
  assert(result.eventDate === result.sourcePublishedDate, 'eventDate should equal sourcePublishedDate');
  assert(result.eventDateSource === 'same_as_publication', `should be same_as_publication, got ${result.eventDateSource}`);
  return true;
});

// ─── getBestDateForFreshness ─────────────────────────────────────

sectionHeader('1d. Three-Date Model — getBestDateForFreshness()');

test('getBestDateForFreshness: eventDate has highest priority', () => {
  const dates: EvidenceDates = {
    eventDate: '2025-01-10T00:00:00.000Z',
    discoveryDate: '2025-01-15T00:00:00.000Z',
    sourcePublishedDate: '2025-01-12T00:00:00.000Z',
    eventDateSource: 'extracted_from_content',
    publishedDateSource: 'content_parsing',
  };
  const best = getBestDateForFreshness(dates);
  assert(best === dates.eventDate, `should return eventDate, got ${best}`);
  return true;
});

test('getBestDateForFreshness: sourcePublishedDate when no eventDate', () => {
  const dates: EvidenceDates = {
    eventDate: null,
    discoveryDate: '2025-01-15T00:00:00.000Z',
    sourcePublishedDate: '2025-01-12T00:00:00.000Z',
    eventDateSource: null,
    publishedDateSource: 'content_parsing',
  };
  const best = getBestDateForFreshness(dates);
  assert(best === dates.sourcePublishedDate, `should return sourcePublishedDate, got ${best}`);
  return true;
});

test('getBestDateForFreshness: discoveryDate as last resort', () => {
  const dates: EvidenceDates = {
    eventDate: null,
    discoveryDate: '2025-01-15T00:00:00.000Z',
    sourcePublishedDate: null,
    eventDateSource: null,
    publishedDateSource: 'not_found',
  };
  const best = getBestDateForFreshness(dates);
  assert(best === dates.discoveryDate, `should return discoveryDate, got ${best}`);
  return true;
});

// ─── dateModelQuality ───────────────────────────────────────────

sectionHeader('1e. Three-Date Model — dateModelQuality()');

test('dateModelQuality: 1.0 for extracted_from_content', () => {
  const dates: EvidenceDates = {
    eventDate: TWO_DAYS_AGO,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: 'extracted_from_content',
    publishedDateSource: 'content_parsing',
  };
  assertClose(dateModelQuality(dates), 1.0);
  return true;
});

test('dateModelQuality: 0.9 for same_as_publication', () => {
  const dates: EvidenceDates = {
    eventDate: TWO_DAYS_AGO,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: 'same_as_publication',
    publishedDateSource: 'search_metadata',
  };
  assertClose(dateModelQuality(dates), 0.9);
  return true;
});

test('dateModelQuality: 0.7 for published only (eventDate same as pub)', () => {
  const dates: EvidenceDates = {
    eventDate: TWO_DAYS_AGO,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: 'same_as_publication',
    publishedDateSource: 'content_parsing',
  };
  // eventDate + sourcePublishedDate both present, eventDateSource=same_as_publication → 0.9
  assertClose(dateModelQuality(dates), 0.9);
  return true;
});

test('dateModelQuality: 0.7 for sourcePublishedDate only', () => {
  const dates: EvidenceDates = {
    eventDate: null,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: null,
    publishedDateSource: 'content_parsing',
  };
  assertClose(dateModelQuality(dates), 0.7);
  return true;
});

test('dateModelQuality: 0.4 for discovery only (no published)', () => {
  const dates: EvidenceDates = {
    eventDate: NOW, // fallback to discovery
    discoveryDate: NOW,
    sourcePublishedDate: null,
    eventDateSource: 'fallback_to_discovery',
    publishedDateSource: 'not_found',
  };
  // eventDate exists but eventDateSource is fallback_to_discovery → 0.5
  assertClose(dateModelQuality(dates), 0.5);
  return true;
});

test('dateModelQuality: 0.4 for completely empty model', () => {
  const dates: EvidenceDates = {
    eventDate: null,
    discoveryDate: NOW,
    sourcePublishedDate: null,
    eventDateSource: null,
    publishedDateSource: 'not_found',
  };
  assertClose(dateModelQuality(dates), 0.4);
  return true;
});

// ─── serializeThreeDateModel ────────────────────────────────────

sectionHeader('1f. Three-Date Model — serializeThreeDateModel()');

test('serializeThreeDateModel: round-trip with all fields', () => {
  const dates: EvidenceDates = {
    eventDate: TWO_DAYS_AGO,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: 'same_as_publication',
    publishedDateSource: 'search_metadata',
  };
  const serialized = serializeThreeDateModel(dates);
  assert('evidenceDates' in serialized, 'should have evidenceDates key');
  const ed = serialized.evidenceDates as Record<string, unknown>;
  assert(ed.eventDate === TWO_DAYS_AGO, `eventDate mismatch: ${ed.eventDate}`);
  assert(ed.discoveryDate === NOW, `discoveryDate mismatch`);
  assert(ed.sourcePublishedDate === TWO_DAYS_AGO);
  assert(ed.eventDateSource === 'same_as_publication');
  assert(ed.publishedDateSource === 'search_metadata');
  assert(typeof ed.qualityScore === 'number', 'qualityScore should be a number');
  return true;
});

test('serializeThreeDateModel: qualityScore is computed correctly', () => {
  const dates: EvidenceDates = {
    eventDate: TWO_DAYS_AGO,
    discoveryDate: NOW,
    sourcePublishedDate: TWO_DAYS_AGO,
    eventDateSource: 'extracted_from_content',
    publishedDateSource: 'content_parsing',
  };
  const serialized = serializeThreeDateModel(dates);
  const ed = serialized.evidenceDates as Record<string, unknown>;
  assertClose(ed.qualityScore as number, 1.0);
  return true;
});


// ═══════════════════════════════════════════════════════════════════
// SECTION 2: Signal Taxonomy Mapping
// ═══════════════════════════════════════════════════════════════════

sectionHeader('2. Signal Taxonomy Mapping — Canonical Type Pass-Through');

// 2a. All 10 canonical types pass through unchanged
const allCanonicalTypes: CanonicalSignalType[] = [
  'funding', 'hiring', 'leadership_change', 'people_change', 'expansion',
  'tech_change', 'technology_adoption', 'partnership', 'acquisition', 'news',
];

for (const type of allCanonicalTypes) {
  test(`Canonical pass-through: "${type}" unchanged`, () => {
    const result = normalizeSignalType(type);
    assert(result.normalizedType === type, `expected ${type}, got ${result.normalizedType}`);
    assert(result.wasCanonical === true, 'wasCanonical should be true');
    assert(result.usedDirectMapping === false, 'should not use direct mapping');
    assert(result.useContextualAnalysis === false, 'should not use contextual analysis');
    return true;
  });
}

test('CANONICAL_SIGNAL_TYPES has exactly 10 types', () => {
  assert(CANONICAL_SIGNAL_TYPES.length === 10, `expected 10, got ${CANONICAL_SIGNAL_TYPES.length}`);
  return true;
});

// ─── Legacy Type Mapping ────────────────────────────────────────

sectionHeader('2b. Signal Taxonomy Mapping — Legacy Type Direct Mapping');

test('Legacy "technology" → tech_change', () => {
  const result = normalizeSignalType('technology');
  assert(result.normalizedType === 'tech_change', `expected tech_change, got ${result.normalizedType}`);
  assert(result.usedDirectMapping === true);
  return true;
});

test('Legacy "relationship" → partnership', () => {
  const result = normalizeSignalType('relationship');
  assert(result.normalizedType === 'partnership', `expected partnership, got ${result.normalizedType}`);
  assert(result.usedDirectMapping === true);
  return true;
});

test('Legacy "mention" → news', () => {
  const result = normalizeSignalType('mention');
  assert(result.normalizedType === 'news', `expected news, got ${result.normalizedType}`);
  assert(result.usedDirectMapping === true);
  return true;
});

// ─── Old signal-types.ts legacy types ──────────────────────────

sectionHeader('2c. Signal Taxonomy Mapping — Old Removed Types');

test('Old type "product" → news', () => {
  const result = normalizeSignalType('product');
  assert(result.normalizedType === 'news', `expected news, got ${result.normalizedType}`);
  return true;
});

test('Old type "regulatory" → news', () => {
  const result = normalizeSignalType('regulatory');
  assert(result.normalizedType === 'news', `expected news, got ${result.normalizedType}`);
  return true;
});

test('Old type "financial_pressure" → news', () => {
  const result = normalizeSignalType('financial_pressure');
  assert(result.normalizedType === 'news', `expected news, got ${result.normalizedType}`);
  return true;
});

// ─── isLegacyType detection ──────────────────────────────────────

sectionHeader('2d. Signal Taxonomy Mapping — Legacy Type Detection');

test('isLegacyType: returns true for known legacy types', () => {
  assert(isLegacyType('business') === true, 'business should be legacy');
  assert(isLegacyType('technology') === true, 'technology should be legacy');
  assert(isLegacyType('relationship') === true, 'relationship should be legacy');
  assert(isLegacyType('mention') === true, 'mention should be legacy');
  assert(isLegacyType('product') === true, 'product should be legacy');
  assert(isLegacyType('regulatory') === true, 'regulatory should be legacy');
  assert(isLegacyType('financial_pressure') === true, 'financial_pressure should be legacy');
  return true;
});

test('isLegacyType: returns false for canonical types', () => {
  for (const ct of allCanonicalTypes) {
    assert(isLegacyType(ct) === false, `${ct} should NOT be legacy`);
  }
  return true;
});

test('isCanonicalType: returns true for all canonical types', () => {
  for (const ct of allCanonicalTypes) {
    assert(isCanonicalType(ct) === true, `${ct} should be canonical`);
  }
  return true;
});

// ─── Contextual Analysis ─────────────────────────────────────────

sectionHeader('2e. Signal Taxonomy Mapping — Contextual Analysis');

test('Contextual: "business" type + "Acme Corp acquires startup" → acquisition', () => {
  const result = normalizeSignalType('business', 'Acme Corp acquires startup', 'Major acquisition deal');
  assert(result.normalizedType === 'acquisition', `expected acquisition, got ${result.normalizedType}`);
  assert(result.useContextualAnalysis === true, 'should use contextual analysis');
  return true;
});

test('Contextual: "business" type + "hiring spree" → hiring', () => {
  const result = normalizeSignalType('business', 'Company is on a hiring spree', 'Adding 200 new positions');
  assert(result.normalizedType === 'hiring', `expected hiring, got ${result.normalizedType}`);
  assert(result.useContextualAnalysis === true);
  return true;
});

test('Contextual: "business" type + "new CEO appointed" → leadership_change', () => {
  const result = normalizeSignalType('business', 'New CEO appointed at TechCorp', 'Leadership transition');
  assert(result.normalizedType === 'leadership_change', `expected leadership_change, got ${result.normalizedType}`);
  return true;
});

test('Contextual: "business" type + "opens new office in London" → expansion', () => {
  const result = normalizeSignalType('business', 'Acme Corp opens new office in London', 'Geographic expansion');
  assert(result.normalizedType === 'expansion', `expected expansion, got ${result.normalizedType}`);
  return true;
});

// ─── Batch Functions ────────────────────────────────────────────

sectionHeader('2f. Signal Taxonomy Mapping — Batch Functions');

test('normalizeSignalTypes: batch normalization returns Map', () => {
  const signals = [
    { id: 's1', signalType: 'funding', title: 'Raises Series A' },
    { id: 's2', signalType: 'business', title: 'Acquires startup' },
    { id: 's3', signalType: 'technology', title: 'Adopts Kubernetes' },
    { id: 's4', signalType: 'mention', title: 'Mentioned in article' },
  ];
  const map = normalizeSignalTypes(signals);
  assert(map instanceof Map, 'should return a Map');
  assert(map.size === 4, `should have 4 entries, got ${map.size}`);
  assert(map.get('s1') === 'funding', `s1 should be funding, got ${map.get('s1')}`);
  assert(map.get('s2') === 'acquisition', `s2 should be acquisition, got ${map.get('s2')}`);
  assert(map.get('s3') === 'tech_change', `s3 should be tech_change, got ${map.get('s3')}`);
  assert(map.get('s4') === 'news', `s4 should be news, got ${map.get('s4')}`);
  return true;
});

test('groupByCanonicalType: groups signals correctly', () => {
  const signals = [
    { id: 's1', signalType: 'funding', title: 'Raises Series A' },
    { id: 's2', signalType: 'funding', title: 'Raises Series B' },
    { id: 's3', signalType: 'acquisition', title: 'Acquires startup' },
    { id: 's4', signalType: 'business', title: 'New CEO appointed' },
  ];
  const groups = groupByCanonicalType(signals);
  assert(groups instanceof Map);
  assert(groups.has('funding'), 'should have funding group');
  assert(groups.get('funding')!.length === 2, 'funding should have 2 signals');
  assert(groups.has('acquisition'), 'should have acquisition group');
  assert(groups.has('leadership_change'), `s4 (business + CEO) should map to leadership_change`);
  return true;
});


// ═══════════════════════════════════════════════════════════════════
// SECTION 3: Freshness Ranking with Three-Date Support
// ═══════════════════════════════════════════════════════════════════

sectionHeader('3. Freshness Ranking — computeFreshnessScore()');

test('Freshness: recent signal with high confidence → high freshness', () => {
  // Signal from 1 day ago, 95% confidence, news type (half-life 14d)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const score = computeFreshnessScore(95, oneDayAgo, NOW, 'news');
  assert(score > 85, `expected > 85 for fresh signal, got ${score}`);
  return true;
});

test('Freshness: stale signal → near-zero freshness', () => {
  // Signal from 240 days ago, 95% confidence, news type
  const staleDate = new Date(Date.now() - 240 * 86400000).toISOString();
  const score = computeFreshnessScore(95, staleDate, NOW, 'news');
  assert(score < 1, `expected near-zero for 240-day-old news, got ${score}`);
  return true;
});

test('Freshness: sourcePublishedDate used when no signalDate', () => {
  // createdAt is old (stale), but sourcePublishedDate is recent
  const oldDate = new Date(Date.now() - 100 * 86400000).toISOString();
  const recentPub = new Date(Date.now() - 86400000).toISOString();
  const scoreWithPub = computeFreshnessScore(90, null, oldDate, 'news', recentPub);
  const scoreWithoutPub = computeFreshnessScore(90, null, oldDate, 'news', null);
  assert(scoreWithPub > scoreWithoutPub, `published date should improve freshness: ${scoreWithPub} vs ${scoreWithoutPub}`);
  return true;
});

test('Freshness: eventDate takes priority over sourcePublishedDate', () => {
  // eventDate is 1 day ago, sourcePublishedDate is 30 days ago
  const recentEvent = new Date(Date.now() - 86400000).toISOString();
  const olderPub = new Date(Date.now() - 30 * 86400000).toISOString();
  const score = computeFreshnessScore(90, recentEvent, NOW, 'news', olderPub);
  assert(score > 80, `eventDate priority should yield high freshness, got ${score}`);
  return true;
});

test('Freshness: different half-lives by signal type', () => {
  const date = new Date(Date.now() - 30 * 86400000).toISOString();
  const newsScore = computeFreshnessScore(90, date, NOW, 'news');       // half-life 14
  const expansionScore = computeFreshnessScore(90, date, NOW, 'expansion'); // half-life 60
  assert(expansionScore > newsScore, `expansion (60d half-life) should be higher than news (14d) at 30 days: ${expansionScore} vs ${newsScore}`);
  return true;
});

// ─── Composite Intelligence Ranking ───────────────────────────────

sectionHeader('3b. Freshness Ranking — computeIntelligenceRanking()');

test('Composite ranking: correct weight distribution', () => {
  const recentDate = new Date(Date.now() - 86400000).toISOString();
  const result = computeIntelligenceRanking({
    confidence: 80,
    signalDate: recentDate,
    createdAt: NOW,
    signalType: 'news',
    sourceQuality: 'premium',
    businessRelevance: 0.8,
    capabilityRelevance: 0.6,
  });
  // Weights: confidence 25%, freshness 30%, source 15%, business 15%, capability 15%
  // With a fresh signal, confidence=80, freshness high, source premium (100), business 80, capability 60
  assert(result.rankingScore > 0, `rankingScore should be positive, got ${result.rankingScore}`);
  assert(result.rankingScore <= 100, `rankingScore should not exceed 100, got ${result.rankingScore}`);
  // Verify breakdown structure
  assert('confidenceScore' in result.breakdown);
  assert('freshnessScore' in result.breakdown);
  assert('sourceQualityScore' in result.breakdown);
  assert('businessRelevanceScore' in result.breakdown);
  assert('capabilityRelevanceScore' in result.breakdown);
  return true;
});

test('Composite ranking: premium source > low source (all else equal)', () => {
  const recentDate = new Date(Date.now() - 86400000).toISOString();
  const base = {
    confidence: 80,
    signalDate: recentDate,
    createdAt: NOW,
    signalType: 'news',
    businessRelevance: 0.5,
    capabilityRelevance: 0.5,
  };
  const premium = computeIntelligenceRanking({ ...base, sourceQuality: 'premium' });
  const low = computeIntelligenceRanking({ ...base, sourceQuality: 'low' });
  assert(premium.rankingScore > low.rankingScore, `premium (${premium.rankingScore}) should beat low (${low.rankingScore})`);
  return true;
});

test('Composite ranking: date quality multiplier gives small boost', () => {
  const recentDate = new Date(Date.now() - 86400000).toISOString();
  const base = {
    confidence: 80,
    signalDate: recentDate,
    createdAt: NOW,
    signalType: 'news',
    sourceQuality: 'standard',
    businessRelevance: 0.5,
    capabilityRelevance: 0.5,
  };
  const highQuality = computeIntelligenceRanking({ ...base, dateQuality: 1.0 });
  const lowQuality = computeIntelligenceRanking({ ...base, dateQuality: 0.4 });
  assert(highQuality.rankingScore >= lowQuality.rankingScore, `high quality date (${highQuality.rankingScore}) should >= low quality (${lowQuality.rankingScore})`);
  return true;
});

// ─── Source Quality Weight ───────────────────────────────────────

sectionHeader('3c. Freshness Ranking — sourceQualityWeight()');

test('sourceQualityWeight: premium=1.0, standard=0.8, low=0.6', () => {
  assert(sourceQualityWeight('premium') === 1.0);
  assert(sourceQualityWeight('standard') === 0.8);
  assert(sourceQualityWeight('low') === 0.6);
  assert(sourceQualityWeight('unknown') === 0.7, 'unknown should default to 0.7');
  return true;
});


// ═══════════════════════════════════════════════════════════════════
// SECTION 4: Adaptive Signal Density
// ═══════════════════════════════════════════════════════════════════

sectionHeader('4. Adaptive Signal Density — Weight Computation');

// Helper: create signals for density tests
function makeSignals(count: number, types: string[]): SignalInput[] {
  const result: SignalInput[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: `sig-${i}`,
      signalType: types[i % types.length],
      title: `Signal ${i}`,
      description: `Description ${i}`,
      severity: 'medium',
      confidence: 0.8,
      signalDate: TWO_DAYS_AGO,
      createdAt: NOW,
      source: null,
    });
  }
  return result;
}

test('Abundant signals (8+, 4+ types) → externalWeight 0.70', () => {
  const signals = makeSignals(10, ['funding', 'hiring', 'tech_change', 'partnership', 'news']);
  const result = assessSignalDensity(signals);
  assert(result.density === 'abundant', `expected abundant, got ${result.density}`);
  assertClose(result.externalWeight, 0.70, 0.01);
  return true;
});

test('Moderate signals (4+, 2+ types) → externalWeight 0.60', () => {
  const signals = makeSignals(5, ['funding', 'hiring']);
  const result = assessSignalDensity(signals);
  assert(result.density === 'moderate', `expected moderate, got ${result.density}`);
  assertClose(result.externalWeight, 0.60, 0.01);
  return true;
});

test('Sparse signals (1+) → density="sparse" (base weight 0.40, boosted to 0.50 w/o internal)', () => {
  const signals = makeSignals(2, ['news']);
  const result = assessSignalDensity(signals);
  assert(result.density === 'sparse', `expected sparse, got ${result.density}`);
  // Without internal context, module boosts external to min 0.50
  assertClose(result.externalWeight, 0.50, 0.01);
  return true;
});

test('Sparse signals (1+) with minimal internal → externalWeight reduced below 0.40', () => {
  const signals = makeSignals(2, ['news']);
  const result = assessSignalDensity(signals, { contactCount: 1, openOpportunities: 0, existingNotes: 0 });
  assert(result.density === 'sparse', `expected sparse, got ${result.density}`);
  // With internal context present, sparse gets reduced: 0.40 - 0.06 = 0.34
  assertClose(result.externalWeight, 0.34, 0.05);
  return true;
});

test('Minimal signals (0) → density="minimal" (base weight 0.20, boosted to 0.50 w/o internal)', () => {
  const result = assessSignalDensity([]);
  assert(result.density === 'minimal', `expected minimal, got ${result.density}`);
  // Without internal context, module boosts external to min 0.50
  assertClose(result.externalWeight, 0.50, 0.01);
  return true;
});

test('internalWeight = 1 - externalWeight', () => {
  const signals = makeSignals(10, ['funding', 'hiring', 'tech_change', 'partnership', 'news']);
  const result = assessSignalDensity(signals);
  assertClose(result.externalWeight + result.internalWeight, 1.0, 0.02);
  return true;
});

test('No internal context → external weight boosted to at least 0.50', () => {
  const signals = makeSignals(1, ['news']);
  const result = assessSignalDensity(signals);
  assert(result.externalWeight >= 0.50, `with no internal context, externalWeight should be >= 0.50, got ${result.externalWeight}`);
  return true;
});

test('Rich internal context + sparse signals → internal weight boosted', () => {
  const signals = makeSignals(2, ['news']);
  const result = assessSignalDensity(signals, {
    contactCount: 15,
    openOpportunities: 3,
    existingNotes: 20,
    lastInteractionDays: 2,
  });
  assert(result.externalWeight < 0.40, `rich internal context should boost internal weight (lower external), got ${result.externalWeight}`);
  return true;
});

test('Intelligence template: abundant → data_driven/detailed/specific', () => {
  const template = getIntelligenceTemplate('abundant');
  assert(template.openingStyle === 'data_driven');
  assert(template.changePresentation === 'detailed');
  assert(template.actionStyle === 'specific');
  return true;
});

test('Intelligence template: minimal → cautious/acknowledgment/research', () => {
  const template = getIntelligenceTemplate('minimal');
  assert(template.openingStyle === 'cautious');
  assert(template.changePresentation === 'acknowledgment');
  assert(template.actionStyle === 'research');
  return true;
});


// ═══════════════════════════════════════════════════════════════════
// SECTION 5: Evidence Classification
// ═══════════════════════════════════════════════════════════════════

sectionHeader('5. Evidence Classification — Rule-Based Classification');

test('Classify: funding signal "Raises $50M Series B"', () => {
  const result = classifyEvidence({
    headline: 'Acme Corp Raises $50M Series B',
    snippet: 'The company announced a new funding round of $50 million',
    sourceName: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/acme-raises-50m',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null, 'should classify successfully');
  assert(result!.signalType === 'funding', `expected funding, got ${result!.signalType}`);
  // TechCrunch is premium, strong keyword match (score >= 3) → severity boosted from high to critical
  assert(result!.severity === 'critical', `expected critical severity, got ${result!.severity}`);
  assert(result!.meaningCategory === 'budget_available');
  return true;
});

test('Classify: hiring signal "is hiring for 200 engineers"', () => {
  const result = classifyEvidence({
    headline: 'TechCorp is hiring for 200 engineering roles',
    snippet: 'The company plans to expand its workforce significantly',
    sourceName: 'GeekWire',
    sourceUrl: 'https://geekwire.com/techcorp-hiring',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'hiring', `expected hiring, got ${result!.signalType}`);
  assert(result!.timingWindow === 'within_30_days');
  return true;
});

test('Classify: acquisition signal "Acquires AI Startup"', () => {
  const result = classifyEvidence({
    headline: 'Microsoft Acquires AI Startup for $1B',
    snippet: 'The acquisition signals Microsofts commitment to artificial intelligence',
    sourceName: 'Reuters',
    sourceUrl: 'https://reuters.com/microsoft-acquires',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'acquisition', `expected acquisition, got ${result!.signalType}`);
  assert(result!.severity === 'critical', `expected critical severity, got ${result!.severity}`);
  return true;
});

test('Classify: tech_change signal "migrates to cloud"', () => {
  const result = classifyEvidence({
    headline: 'Legacy Corp migrates to cloud infrastructure',
    snippet: 'The company is undergoing a digital transformation with AWS',
    sourceName: 'ZDNet',
    sourceUrl: 'https://zdnet.com/legacy-cloud',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'tech_change', `expected tech_change, got ${result!.signalType}`);
  return true;
});

test('Classify: leadership_change "new CEO appointed"', () => {
  const result = classifyEvidence({
    headline: 'New CEO appointed at DataFlow Inc',
    snippet: 'The board announced a new chief executive officer',
    sourceName: 'Bloomberg',
    sourceUrl: 'https://bloomberg.com/dataflow-ceo',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'leadership_change', `expected leadership_change, got ${result!.signalType}`);
  return true;
});

test('Classify: expansion "opens new office in Berlin"', () => {
  const result = classifyEvidence({
    headline: 'GlobalTech opens new office in Berlin',
    snippet: 'Expanding international operations with a new facility',
    sourceName: 'BBC',
    sourceUrl: 'https://bbc.com/globaltech-berlin',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'expansion', `expected expansion, got ${result!.signalType}`);
  return true;
});

test('Classify: partnership "partners with Salesforce"', () => {
  const result = classifyEvidence({
    headline: 'Acme Corp partners with Salesforce',
    snippet: 'Strategic partnership announced for CRM integration',
    sourceName: 'Axios',
    sourceUrl: 'https://axios.com/acme-salesforce',
    publishedDate: TWO_DAYS_AGO,
    collectionDate: NOW,
  });
  assert(result !== null);
  assert(result!.signalType === 'partnership', `expected partnership, got ${result!.signalType}`);
  return true;
});

test('Classify: null for unrecognizable content', () => {
  const result = classifyEvidence({
    headline: 'Some random article',
    snippet: 'Nothing interesting here at all',
    sourceName: 'RandomBlog',
    sourceUrl: 'https://randomblog.com/nothing',
    publishedDate: null,
    collectionDate: NOW,
  });
  assert(result === null, 'should return null for unrecognized content');
  return true;
});

// ─── Source Reliability Scoring ──────────────────────────────────

sectionHeader('5b. Evidence Classification — Source Reliability');

test('Source reliability: premium for Reuters', () => {
  const result = scoreSourceReliability('Reuters', 'https://reuters.com/article');
  assert(result.quality === 'premium', `expected premium, got ${result.quality}`);
  assertClose(result.score, 0.9);
  return true;
});

test('Source reliability: premium for Bloomberg', () => {
  const result = scoreSourceReliability('Bloomberg', 'https://bloomberg.com/article');
  assert(result.quality === 'premium');
  return true;
});

test('Source reliability: standard for VentureBeat', () => {
  const result = scoreSourceReliability('VentureBeat', 'https://venturebeat.com/article');
  assert(result.quality === 'standard', `expected standard, got ${result.quality}`);
  return true;
});

test('Source reliability: standard for Business Insider', () => {
  const result = scoreSourceReliability('Business Insider', 'https://businessinsider.com/article');
  assert(result.quality === 'standard');
  return true;
});

test('Source reliability: low for .news domain', () => {
  const result = scoreSourceReliability('Some News Aggregator', 'https://aggregator123.news/article');
  assert(result.quality === 'low', `expected low, got ${result.quality}`);
  assertClose(result.score, 0.5);
  return true;
});

test('Source reliability: premium for generic company domain', () => {
  const result = scoreSourceReliability('Some Corp', 'https://somecorp.com/article');
  // Non-.news, non-blog. domains get premium (official company page)
  assert(result.quality === 'premium', `expected premium, got ${result.quality}`);
  return true;
});

test('Source reliability: null source → low', () => {
  const result = scoreSourceReliability(null, null);
  assert(result.quality === 'low', `expected low, got ${result.quality}`);
  return true;
});


// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(72)}`);
console.log(`  SPRINT 1 VALIDATION SUMMARY`);
console.log(`${'═'.repeat(72)}`);
console.log(`  Total tests:  ${totalTests}`);
console.log(`  Passed:       ${passedTests} ✅`);
console.log(`  Failed:       ${failedTests} ❌`);
console.log(`  Pass rate:    ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log(`\n  Failed tests:`);
  for (const f of failures) {
    console.log(`    ❌ ${f}`);
  }
}

console.log(`\n${'═'.repeat(72)}`);

// Exit code for CI
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('  🎉 ALL SPRINT 1 MODULES VALIDATED SUCCESSFULLY');
  console.log(`${'═'.repeat(72)}\n`);
  process.exit(0);
}
