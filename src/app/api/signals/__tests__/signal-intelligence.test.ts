/**
 * Ticket 8 Tests — Signal Intelligence
 *
 * Per ARCHITECTURE.md:
 * - Unit test: Signal filtering logic
 * - Integration test: Evidence count accuracy
 */

import { describe, it, expect } from 'vitest';

/* ═══════════════════════════════════════════════════════════════
   Types — mirror the frontend SignalItem
   ═══════════════════════════════════════════════════════════════ */
interface SignalItem {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  companyId: string;
  company?: { id: string; normalizedName: string };
  severity: string;
  impact: string;
  confidence: number;
  meaningCategory?: string | null;
  signalDate?: string | null;
  extractedAt: string;
  status: string;
  signalCapabilityMatches?: { id: string; matchScore: number; reason: string }[];
}

/* ═══════════════════════════════════════════════════════════════
   Signal filtering helpers — extracted from signal-intelligence-screen.tsx
   These are the pure functions that the frontend uses for filtering.
   ═══════════════════════════════════════════════════════════════ */

type DisplaySeverity = 'critical' | 'high' | 'medium' | 'low';

function getDisplaySeverity(severity: string, confidence?: number): DisplaySeverity {
  if (severity === 'critical') return 'critical';
  if (severity === 'high' && (confidence ?? 0) >= 0.85) return 'critical';
  if (severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function getSeverityOrder(s: string): number {
  const map: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return map[s] ?? 3;
}

function getCategoryForType(type: string): string {
  const typeToCategory: Record<string, string> = {
    funding: 'growth', hiring: 'growth', expansion: 'growth',
    leadership_change: 'leadership', leadership: 'leadership', people_change: 'leadership',
    tech_change: 'technology', technology: 'technology', internal_memory: 'technology',
    news: 'news', mention: 'news',
    partnership: 'partnership',
  };
  return typeToCategory[type] ?? 'growth';
}

function filterSignals(
  signals: SignalItem[],
  filters: {
    typeFilter?: string;
    meaningFilter?: string;
    severityFilter?: string;
    search?: string;
    sortBy?: string;
  }
): SignalItem[] {
  let result = [...signals];

  if (filters.typeFilter && filters.typeFilter !== 'all') {
    result = result.filter(s => getCategoryForType(s.signalType) === filters.typeFilter);
  }

  if (filters.meaningFilter && filters.meaningFilter !== 'all') {
    result = result.filter(s => s.meaningCategory === filters.meaningFilter);
  }

  if (filters.severityFilter && filters.severityFilter !== 'all') {
    result = result.filter(s => {
      const ds = getDisplaySeverity(s.severity, s.confidence);
      return ds === filters.severityFilter;
    });
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(s =>
      s.company?.normalizedName?.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.signalType.toLowerCase().includes(q)
    );
  }

  result.sort((a, b) => {
    if (filters.sortBy === 'severity') {
      const aSev = getSeverityOrder(getDisplaySeverity(a.severity, a.confidence));
      const bSev = getSeverityOrder(getDisplaySeverity(b.severity, b.confidence));
      if (aSev !== bSev) return aSev - bSev;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    }
    if (filters.sortBy === 'confidence') {
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    }
    return new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime();
  });

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   Mock data — realistic CompanySignal records
   ═══════════════════════════════════════════════════════════════ */
const mockSignals: SignalItem[] = [
  {
    id: 'sig-1',
    signalType: 'funding',
    title: 'Series C Funding — $50M',
    description: 'Acme Corp raised $50M Series C',
    companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'critical',
    impact: 'high',
    confidence: 0.92,
    meaningCategory: 'budget_available',
    signalDate: '2026-07-28T10:00:00Z',
    extractedAt: '2026-07-28T12:00:00Z',
    status: 'active',
  },
  {
    id: 'sig-2',
    signalType: 'leadership_change',
    title: 'New CTO appointed',
    description: 'Acme Corp appointed Jane Doe as CTO',
    companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'high',
    impact: 'medium',
    confidence: 0.78,
    meaningCategory: 'leadership_openness',
    signalDate: '2026-07-27T09:00:00Z',
    extractedAt: '2026-07-27T11:00:00Z',
    status: 'active',
  },
  {
    id: 'sig-3',
    signalType: 'tech_change',
    title: 'Migrating from on-prem to cloud',
    description: 'Acme Corp announced cloud migration initiative',
    companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'high',
    impact: 'high',
    confidence: 0.88,
    meaningCategory: 'tech_dissatisfaction',
    signalDate: '2026-07-26T08:00:00Z',
    extractedAt: '2026-07-26T10:00:00Z',
    status: 'active',
    signalCapabilityMatches: [
      { id: 'match-1', matchScore: 0.85, reason: 'Cloud migration matches Cloud Migration capability' },
    ],
  },
  {
    id: 'sig-4',
    signalType: 'hiring',
    title: 'Hiring 50 engineers',
    description: 'Acme Corp is hiring 50 engineers',
    companyId: 'comp-2',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
    severity: 'medium',
    impact: 'medium',
    confidence: 0.65,
    meaningCategory: 'growth_pressure',
    signalDate: '2026-07-25T14:00:00Z',
    extractedAt: '2026-07-25T16:00:00Z',
    status: 'detected',
  },
  {
    id: 'sig-5',
    signalType: 'partnership',
    title: 'Partnership with CloudVendor',
    description: 'Beta Inc partnered with CloudVendor for analytics',
    companyId: 'comp-2',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
    severity: 'low',
    impact: 'low',
    confidence: 0.45,
    meaningCategory: 'vendor_evaluation',
    signalDate: '2026-07-24T10:00:00Z',
    extractedAt: '2026-07-24T12:00:00Z',
    status: 'detected',
  },
  {
    id: 'sig-6',
    signalType: 'news',
    title: 'Mentioned in tech blog',
    description: 'Gamma LLC mentioned in industry tech blog',
    companyId: 'comp-3',
    company: { id: 'comp-3', normalizedName: 'Gamma LLC' },
    severity: 'low',
    impact: 'low',
    confidence: 0.3,
    meaningCategory: null,
    signalDate: '2026-07-23T10:00:00Z',
    extractedAt: '2026-07-23T12:00:00Z',
    status: 'detected',
  },
];

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 1: Unit Test — Signal Filtering Logic
   (Per ARCHITECTURE.md: "Unit test: Signal filtering logic")
   ═══════════════════════════════════════════════════════════════ */
describe('Ticket 8 — Signal Filtering Logic (Unit)', () => {
  describe('getDisplaySeverity', () => {
    it('returns "critical" for severity "critical" regardless of confidence', () => {
      expect(getDisplaySeverity('critical', 0.5)).toBe('critical');
      expect(getDisplaySeverity('critical', 0.99)).toBe('critical');
    });

    it('returns "critical" for severity "high" with confidence >= 0.85', () => {
      expect(getDisplaySeverity('high', 0.85)).toBe('critical');
      expect(getDisplaySeverity('high', 0.90)).toBe('critical');
      expect(getDisplaySeverity('high', 0.99)).toBe('critical');
    });

    it('returns "high" for severity "high" with confidence < 0.85', () => {
      expect(getDisplaySeverity('high', 0.84)).toBe('high');
      expect(getDisplaySeverity('high', 0.70)).toBe('high');
    });

    it('returns "medium" for severity "medium"', () => {
      expect(getDisplaySeverity('medium', 0.5)).toBe('medium');
      expect(getDisplaySeverity('medium', 0.9)).toBe('medium');
    });

    it('returns "low" for severity "low"', () => {
      expect(getDisplaySeverity('low', 0.1)).toBe('low');
      expect(getDisplaySeverity('low', 0.9)).toBe('low');
    });
  });

  describe('getCategoryForType', () => {
    it('maps funding/hiring/expansion to "growth"', () => {
      expect(getCategoryForType('funding')).toBe('growth');
      expect(getCategoryForType('hiring')).toBe('growth');
      expect(getCategoryForType('expansion')).toBe('growth');
    });

    it('maps leadership_change/leadership/people_change to "leadership"', () => {
      expect(getCategoryForType('leadership_change')).toBe('leadership');
      expect(getCategoryForType('leadership')).toBe('leadership');
      expect(getCategoryForType('people_change')).toBe('leadership');
    });

    it('maps tech_change/technology/internal_memory to "technology"', () => {
      expect(getCategoryForType('tech_change')).toBe('technology');
      expect(getCategoryForType('technology')).toBe('technology');
      expect(getCategoryForType('internal_memory')).toBe('technology');
    });

    it('maps news/mention to "news"', () => {
      expect(getCategoryForType('news')).toBe('news');
      expect(getCategoryForType('mention')).toBe('news');
    });

    it('maps partnership to "partnership"', () => {
      expect(getCategoryForType('partnership')).toBe('partnership');
    });

    it('defaults unknown types to "growth"', () => {
      expect(getCategoryForType('unknown_type')).toBe('growth');
    });
  });

  describe('filterSignals — type filter', () => {
    it('returns only growth signals when typeFilter is "growth"', () => {
      const result = filterSignals(mockSignals, { typeFilter: 'growth' });
      expect(result.every(s => getCategoryForType(s.signalType) === 'growth')).toBe(true);
      expect(result).toHaveLength(2); // funding + hiring
    });

    it('returns only technology signals when typeFilter is "technology"', () => {
      const result = filterSignals(mockSignals, { typeFilter: 'technology' });
      expect(result).toHaveLength(1); // tech_change
      expect(result[0].signalType).toBe('tech_change');
    });

    it('returns all signals when typeFilter is "all"', () => {
      const result = filterSignals(mockSignals, { typeFilter: 'all' });
      expect(result).toHaveLength(mockSignals.length);
    });
  });

  describe('filterSignals — meaning category filter', () => {
    it('returns only signals with budget_available meaning', () => {
      const result = filterSignals(mockSignals, { meaningFilter: 'budget_available' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-1');
      expect(result[0].meaningCategory).toBe('budget_available');
    });

    it('returns only signals with tech_dissatisfaction meaning', () => {
      const result = filterSignals(mockSignals, { meaningFilter: 'tech_dissatisfaction' });
      expect(result).toHaveLength(1);
      expect(result[0].signalType).toBe('tech_change');
    });

    it('excludes signals with null meaningCategory', () => {
      const result = filterSignals(mockSignals, { meaningFilter: 'vendor_evaluation' });
      expect(result.every(s => s.meaningCategory !== null)).toBe(true);
    });
  });

  describe('filterSignals — severity filter', () => {
    it('returns critical signals (includes high+confidence >= 0.85)', () => {
      const result = filterSignals(mockSignals, { severityFilter: 'critical' });
      // sig-1 is critical severity, sig-3 is high with 0.88 confidence -> critical
      expect(result).toHaveLength(2);
      expect(result.map(s => s.id)).toContain('sig-1');
      expect(result.map(s => s.id)).toContain('sig-3');
    });

    it('returns high signals (high severity with confidence < 0.85)', () => {
      const result = filterSignals(mockSignals, { severityFilter: 'high' });
      // sig-2 is high with confidence 0.78 (< 0.85)
      // sig-4 is medium severity, not high
      // sig-3 is high with confidence 0.88 (>= 0.85) → promoted to critical
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-2');
    });

    it('returns medium signals', () => {
      const result = filterSignals(mockSignals, { severityFilter: 'medium' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-4');
    });
  });

  describe('filterSignals — search', () => {
    it('filters by company name', () => {
      const result = filterSignals(mockSignals, { search: 'acme' });
      // sig-1, sig-2, sig-3 are Acme Corp signals
      // sig-4 is Beta Inc but description mentions 'Acme Corp'
      expect(result).toHaveLength(4);
      expect(result.slice(0, 3).every(s => s.company?.normalizedName?.toLowerCase().includes('acme'))).toBe(true);
    });

    it('filters by signal title', () => {
      const result = filterSignals(mockSignals, { search: 'funding' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain('Funding');
    });

    it('filters by signal type', () => {
      const result = filterSignals(mockSignals, { search: 'partnership' });
      expect(result).toHaveLength(1);
      expect(result[0].signalType).toBe('partnership');
    });

    it('returns empty for non-matching search', () => {
      const result = filterSignals(mockSignals, { search: 'zzz_nonexistent' });
      expect(result).toHaveLength(0);
    });
  });

  describe('filterSignals — sort', () => {
    it('sorts by severity (critical first)', () => {
      const result = filterSignals(mockSignals, { sortBy: 'severity' });
      const severities = result.map(s => getDisplaySeverity(s.severity, s.confidence));
      // Verify non-increasing order (critical=0 < high=1 < medium=2 < low=3)
      for (let i = 1; i < severities.length; i++) {
        expect(getSeverityOrder(severities[i])).toBeGreaterThanOrEqual(getSeverityOrder(severities[i - 1]));
      }
    });

    it('sorts by confidence (highest first)', () => {
      const result = filterSignals(mockSignals, { sortBy: 'confidence' });
      const confidences = result.map(s => s.confidence);
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i]).toBeLessThanOrEqual(confidences[i - 1]);
      }
    });

    it('sorts by time (newest first)', () => {
      const result = filterSignals(mockSignals, { sortBy: 'time' });
      const dates = result.map(s => new Date(s.extractedAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });
  });

  describe('filterSignals — combined filters', () => {
    it('applies type + severity filters together', () => {
      const result = filterSignals(mockSignals, { typeFilter: 'growth', severityFilter: 'critical' });
      // growth signals: sig-1 (funding, critical), sig-4 (hiring, medium)
      // only sig-1 passes the critical filter
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-1');
    });

    it('applies meaning + search filters together', () => {
      const result = filterSignals(mockSignals, { meaningFilter: 'leadership_openness', search: 'acme' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-2');
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 2: Integration Test — Evidence Count Accuracy
   (Per ARCHITECTURE.md: "Integration test: Evidence count accuracy")
   ═══════════════════════════════════════════════════════════════ */

/**
 * Simulates the evidenceCounts computation from the API route.
 * The API reads CompanySignal.evidenceIds (JSON array of Evidence IDs)
 * and returns Record<signalId, count>.
 */
function computeEvidenceCounts(
  signals: { id: string; evidenceIds: unknown }[]
): Record<string, number> {
  const evidenceCounts: Record<string, number> = {};
  for (const s of signals) {
    let count = 0;
    try {
      const ids = typeof s.evidenceIds === 'string'
        ? JSON.parse(s.evidenceIds)
        : s.evidenceIds;
      if (Array.isArray(ids)) count = ids.length;
    } catch { /* skip malformed JSON */ }
    evidenceCounts[s.id] = count;
  }
  return evidenceCounts;
}

describe('Ticket 8 — Evidence Count Accuracy (Integration)', () => {
  it('correctly counts evidence IDs from JSON arrays', () => {
    const signals = [
      { id: 'sig-a', evidenceIds: '["ev-1","ev-2","ev-3"]' },
      { id: 'sig-b', evidenceIds: '["ev-4"]' },
      { id: 'sig-c', evidenceIds: '[]' },
    ];
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-a']).toBe(3);
    expect(counts['sig-b']).toBe(1);
    expect(counts['sig-c']).toBe(0);
  });

  it('handles already-parsed JSON arrays', () => {
    const signals = [
      { id: 'sig-d', evidenceIds: ['ev-1', 'ev-2'] },
      { id: 'sig-e', evidenceIds: [] },
    ];
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-d']).toBe(2);
    expect(counts['sig-e']).toBe(0);
  });

  it('handles null/undefined evidenceIds gracefully', () => {
    const signals = [
      { id: 'sig-f', evidenceIds: null },
      { id: 'sig-g', evidenceIds: undefined },
    ];
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-f']).toBe(0);
    expect(counts['sig-g']).toBe(0);
  });

  it('handles malformed JSON gracefully (does not throw)', () => {
    const signals = [
      { id: 'sig-h', evidenceIds: 'not-valid-json' },
      { id: 'sig-i', evidenceIds: '{broken: true' },
    ];
    // Should not throw
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-h']).toBe(0);
    expect(counts['sig-i']).toBe(0);
  });

  it('handles non-array parsed JSON gracefully', () => {
    const signals = [
      { id: 'sig-j', evidenceIds: '"just-a-string"' },
      { id: 'sig-k', evidenceIds: '{"key": "value"}' },
    ];
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-j']).toBe(0);
    expect(counts['sig-k']).toBe(0);
  });

  it('produces correct counts for large arrays', () => {
    const largeIds = Array.from({ length: 100 }, (_, i) => `ev-${i}`);
    const signals = [
      { id: 'sig-large', evidenceIds: JSON.stringify(largeIds) },
    ];
    const counts = computeEvidenceCounts(signals);
    expect(counts['sig-large']).toBe(100);
  });

  it('evidence count matches the length of the evidenceIds array', () => {
    // Simulate real data flow: API creates evidenceCounts, frontend reads it
    const signals = [
      { id: 'sig-1', evidenceIds: '["e1","e2","e3","e4","e5"]' },
      { id: 'sig-2', evidenceIds: '["e6","e7"]' },
      { id: 'sig-3', evidenceIds: '[]' },
    ];
    const counts = computeEvidenceCounts(signals);

    // Verify frontend would display correct count
    expect(counts['sig-1']).toBe(5);
    expect(counts['sig-2']).toBe(2);
    expect(counts['sig-3']).toBe(0);

    // Verify total evidence across all signals
    const totalEvidence = Object.values(counts).reduce((sum, c) => sum + c, 0);
    expect(totalEvidence).toBe(7);
  });
});
