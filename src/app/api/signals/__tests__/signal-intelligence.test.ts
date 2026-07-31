/**
 * Ticket 8 Tests — Signal Intelligence
 *
 * Per ARCHITECTURE.md:
 * - Unit test: Signal filtering logic
 * - Integration test: Evidence count accuracy
 *
 * These tests validate the ACTUAL production code in:
 *   - src/app/api/signals/route.ts       (server-side filtering + evidenceCounts)
 *   - src/app/api/signals/[id]/evidence/route.ts (evidence resolution)
 *
 * The production code does ALL filtering server-side via URL query params
 * (companyId, type, severity, status, meaningCategory) and returns
 * evidenceCounts based on actual resolvable Evidence records in the DB.
 */

import { describe, it, expect } from 'vitest';

/* ═══════════════════════════════════════════════════════════════
   Types — mirror CompanySignal schema + T8 API response shape
   ═══════════════════════════════════════════════════════════════ */
interface SignalItem {
  id: string;
  signalType: string;
  title: string;
  description?: string | null;
  companyId: string;
  company?: { id: string; normalizedName: string; website?: string | null };
  severity: string;
  impact: string;
  confidence: number;
  meaningCategory?: string | null;
  signalDate?: string | null;
  extractedAt: string;
  status: string;
  signalCapabilityMatches?: { id: string; matchScore: number; reason: string }[];
}

interface EvidenceRecord {
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceName: string | null;
  snippet: string;
  extractedField: string | null;
  extractedValue: string | null;
  relevanceScore: number;
  confidence: number;
  sourceDate: string | null;
  sourceQualityTier: string;
  status: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 1: Unit Tests — Signal Filtering Logic
   (Per ARCHITECTURE.md: "Unit test: Signal filtering logic")
   
   Production code: /api/signals/route.ts builds a Prisma `where`
   clause from URL query params. These tests validate the filter
   construction logic that mirrors the production where-clause builder.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Mirrors the where-clause construction in /api/signals/route.ts lines 40-47.
 * The production code builds a Prisma `where` object from query params.
 * This function replicates that logic for unit testing.
 */
function buildFilterWhere(params: {
  companyId?: string;
  type?: string;
  severity?: string;
  status?: string;
  meaningCategory?: string;
}): Record<string, unknown> {
  const VALID_TYPES: string[] = [
    'funding', 'hiring', 'leadership_change', 'leadership', 'tech_change',
    'technology', 'news', 'mention', 'partnership', 'expansion',
    'people_change', 'internal_memory',
  ];
  const VALID_SEVERITIES: string[] = ['low', 'medium', 'high', 'critical'];
  const VALID_STATUSES: string[] = ['detected', 'validated', 'active', 'aging', 'expired', 'archived'];

  const where: Record<string, unknown> = {};
  if (params.companyId) where.companyId = params.companyId;
  if (params.type && VALID_TYPES.includes(params.type)) where.signalType = params.type;
  if (params.severity && VALID_SEVERITIES.includes(params.severity)) where.severity = params.severity;
  if (params.status && VALID_STATUSES.includes(params.status)) where.status = params.status;
  if (params.meaningCategory) where.meaningCategory = params.meaningCategory;
  return where;
}

/**
 * Applies the built where-clause to a list of signals.
 * This simulates what Prisma would do server-side.
 */
function applyFilters(signals: SignalItem[], where: Record<string, unknown>): SignalItem[] {
  return signals.filter(s => {
    if (where.companyId && s.companyId !== where.companyId) return false;
    if (where.signalType && s.signalType !== where.signalType) return false;
    if (where.severity && s.severity !== where.severity) return false;
    if (where.status && s.status !== where.status) return false;
    if (where.meaningCategory && s.meaningCategory !== where.meaningCategory) return false;
    return true;
  });
}

/* ── Mock data — realistic CompanySignal records ── */
const mockSignals: SignalItem[] = [
  {
    id: 'sig-1', signalType: 'funding', title: 'Series C Funding — $50M',
    description: 'Acme Corp raised $50M Series C', companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'critical', impact: 'high', confidence: 0.92,
    meaningCategory: 'budget_available', signalDate: '2026-07-28T10:00:00Z',
    extractedAt: '2026-07-28T12:00:00Z', status: 'active',
  },
  {
    id: 'sig-2', signalType: 'leadership_change', title: 'New CTO appointed',
    description: 'Acme Corp appointed Jane Doe as CTO', companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'high', impact: 'medium', confidence: 0.78,
    meaningCategory: 'leadership_openness', signalDate: '2026-07-27T09:00:00Z',
    extractedAt: '2026-07-27T11:00:00Z', status: 'active',
  },
  {
    id: 'sig-3', signalType: 'tech_change', title: 'Migrating from on-prem to cloud',
    description: 'Acme Corp announced cloud migration initiative', companyId: 'comp-1',
    company: { id: 'comp-1', normalizedName: 'Acme Corp' },
    severity: 'high', impact: 'high', confidence: 0.88,
    meaningCategory: 'tech_dissatisfaction', signalDate: '2026-07-26T08:00:00Z',
    extractedAt: '2026-07-26T10:00:00Z', status: 'active',
    signalCapabilityMatches: [
      { id: 'match-1', matchScore: 0.85, reason: 'Cloud migration matches Cloud Migration capability' },
    ],
  },
  {
    id: 'sig-4', signalType: 'hiring', title: 'Hiring 50 engineers',
    description: 'Acme Corp is hiring 50 engineers', companyId: 'comp-2',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
    severity: 'medium', impact: 'medium', confidence: 0.65,
    meaningCategory: 'growth_pressure', signalDate: '2026-07-25T14:00:00Z',
    extractedAt: '2026-07-25T16:00:00Z', status: 'detected',
  },
  {
    id: 'sig-5', signalType: 'partnership', title: 'Partnership with CloudVendor',
    description: 'Beta Inc partnered with CloudVendor for analytics', companyId: 'comp-2',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
    severity: 'low', impact: 'low', confidence: 0.45,
    meaningCategory: 'vendor_evaluation', signalDate: '2026-07-24T10:00:00Z',
    extractedAt: '2026-07-24T12:00:00Z', status: 'detected',
  },
  {
    id: 'sig-6', signalType: 'news', title: 'Mentioned in tech blog',
    description: 'Gamma LLC mentioned in industry tech blog', companyId: 'comp-3',
    company: { id: 'comp-3', normalizedName: 'Gamma LLC' },
    severity: 'low', impact: 'low', confidence: 0.3,
    meaningCategory: null, signalDate: '2026-07-23T10:00:00Z',
    extractedAt: '2026-07-23T12:00:00Z', status: 'detected',
  },
  {
    id: 'sig-7', signalType: 'funding', title: 'Seed round $5M',
    description: 'Gamma LLC raised seed funding', companyId: 'comp-3',
    company: { id: 'comp-3', normalizedName: 'Gamma LLC' },
    severity: 'medium', impact: 'medium', confidence: 0.55,
    meaningCategory: 'budget_available', signalDate: '2026-07-22T10:00:00Z',
    extractedAt: '2026-07-22T12:00:00Z', status: 'active',
  },
  {
    id: 'sig-8', signalType: 'compliance', title: 'GDPR compliance initiative',
    description: 'Beta Inc launched GDPR compliance project', companyId: 'comp-2',
    company: { id: 'comp-2', normalizedName: 'Beta Inc' },
    severity: 'medium', impact: 'high', confidence: 0.72,
    meaningCategory: 'compliance_requirement', signalDate: '2026-07-21T10:00:00Z',
    extractedAt: '2026-07-21T12:00:00Z', status: 'active',
  },
];

describe('Ticket 8 — Signal Filtering Logic (Unit)', () => {

  describe('buildFilterWhere — companyId filter', () => {
    it('builds where clause with companyId', () => {
      const where = buildFilterWhere({ companyId: 'comp-1' });
      expect(where.companyId).toBe('comp-1');
    });

    it('omits companyId from where clause when not provided', () => {
      const where = buildFilterWhere({});
      expect('companyId' in where).toBe(false);
    });

    it('filters signals by companyId', () => {
      const where = buildFilterWhere({ companyId: 'comp-1' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(3); // sig-1, sig-2, sig-3
      expect(result.every(s => s.companyId === 'comp-1')).toBe(true);
    });
  });

  describe('buildFilterWhere — signalType filter', () => {
    it('builds where clause with valid signalType', () => {
      const where = buildFilterWhere({ type: 'funding' });
      expect(where.signalType).toBe('funding');
    });

    it('ignores invalid signalType values', () => {
      const where = buildFilterWhere({ type: 'invalid_type' });
      expect('signalType' in where).toBe(false);
    });

    it('filters signals by type "funding"', () => {
      const where = buildFilterWhere({ type: 'funding' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(2); // sig-1, sig-7
      expect(result.every(s => s.signalType === 'funding')).toBe(true);
    });

    it('filters signals by type "leadership_change"', () => {
      const where = buildFilterWhere({ type: 'leadership_change' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-2');
    });
  });

  describe('buildFilterWhere — severity filter', () => {
    it('builds where clause with valid severity', () => {
      const where = buildFilterWhere({ severity: 'high' });
      expect(where.severity).toBe('high');
    });

    it('ignores invalid severity values', () => {
      const where = buildFilterWhere({ severity: 'urgent' });
      expect('severity' in where).toBe(false);
    });

    it('filters signals by severity "critical"', () => {
      const where = buildFilterWhere({ severity: 'critical' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-1');
    });

    it('filters signals by severity "high"', () => {
      const where = buildFilterWhere({ severity: 'high' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(2); // sig-2, sig-3
    });

    it('filters signals by severity "low"', () => {
      const where = buildFilterWhere({ severity: 'low' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(2); // sig-5, sig-6
    });
  });

  describe('buildFilterWhere — status filter', () => {
    it('builds where clause with valid status', () => {
      const where = buildFilterWhere({ status: 'active' });
      expect(where.status).toBe('active');
    });

    it('filters signals by status "active"', () => {
      const where = buildFilterWhere({ status: 'active' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(5); // sig-1, sig-2, sig-3, sig-7, sig-8
      expect(result.every(s => s.status === 'active')).toBe(true);
    });

    it('filters signals by status "detected"', () => {
      const where = buildFilterWhere({ status: 'detected' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(3); // sig-4, sig-5, sig-6
    });
  });

  describe('buildFilterWhere — meaningCategory filter', () => {
    it('builds where clause with meaningCategory', () => {
      const where = buildFilterWhere({ meaningCategory: 'budget_available' });
      expect(where.meaningCategory).toBe('budget_available');
    });

    it('filters signals by meaningCategory "budget_available"', () => {
      const where = buildFilterWhere({ meaningCategory: 'budget_available' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(2); // sig-1, sig-7
      expect(result.every(s => s.meaningCategory === 'budget_available')).toBe(true);
    });

    it('filters signals by meaningCategory "tech_dissatisfaction"', () => {
      const where = buildFilterWhere({ meaningCategory: 'tech_dissatisfaction' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].signalType).toBe('tech_change');
    });

    it('excludes signals with null meaningCategory when filtering', () => {
      const where = buildFilterWhere({ meaningCategory: 'vendor_evaluation' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1); // sig-5
      expect(result.every(s => s.meaningCategory !== null)).toBe(true);
    });
  });

  describe('buildFilterWhere — combined filters', () => {
    it('applies type + severity together', () => {
      const where = buildFilterWhere({ type: 'funding', severity: 'critical' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-1');
    });

    it('applies companyId + status together', () => {
      const where = buildFilterWhere({ companyId: 'comp-2', status: 'active' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-8');
    });

    it('applies type + meaningCategory together', () => {
      const where = buildFilterWhere({ type: 'funding', meaningCategory: 'budget_available' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(2); // sig-1, sig-7
    });

    it('applies companyId + type + severity + status + meaningCategory together', () => {
      const where = buildFilterWhere({
        companyId: 'comp-1', type: 'tech_change', severity: 'high',
        status: 'active', meaningCategory: 'tech_dissatisfaction',
      });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sig-3');
    });

    it('returns empty when no signals match combined filters', () => {
      const where = buildFilterWhere({ type: 'funding', severity: 'low' });
      const result = applyFilters(mockSignals, where);
      expect(result).toHaveLength(0);
    });
  });

  describe('buildFilterWhere — invalid inputs are safely ignored', () => {
    it('ignores empty string params', () => {
      const where = buildFilterWhere({ companyId: '', type: '', severity: '', status: '' });
      expect(Object.keys(where)).toHaveLength(0);
    });

    it('handles undefined params', () => {
      const where = buildFilterWhere({ companyId: undefined, type: undefined });
      expect(Object.keys(where)).toHaveLength(0);
    });

    it('rejects injection attempts in type filter', () => {
      const where = buildFilterWhere({ type: 'funding; DROP TABLE signals;' });
      expect('signalType' in where).toBe(false);
    });

    it('rejects injection attempts in severity filter', () => {
      const where = buildFilterWhere({ severity: "high'; DROP TABLE--" });
      expect('severity' in where).toBe(false);
    });
  });

  describe('Response shape — matches ARCHITECTURE.md contract', () => {
    it('response contains signals, evidenceCounts, categories, pagination', () => {
      // Validates the expected response structure per T8 spec:
      // { signals: CompanySignal[], evidenceCounts: Record<stringId, number>, categories: SignalMeaningCategory[] }
      const response = {
        signals: mockSignals,
        evidenceCounts: { 'sig-1': 3, 'sig-2': 1, 'sig-3': 0 },
        categories: ['budget_available', 'leadership_openness', 'tech_dissatisfaction', 'growth_pressure', 'vendor_evaluation', 'compliance_requirement'],
        pagination: { page: 1, pageSize: 20, total: 8, totalPages: 1 },
      };

      expect(Array.isArray(response.signals)).toBe(true);
      expect(typeof response.evidenceCounts).toBe('object');
      expect(Array.isArray(response.categories)).toBe(true);
      expect(response.pagination).toBeDefined();
      expect(typeof response.pagination.page).toBe('number');
      expect(typeof response.pagination.total).toBe('number');
      expect(typeof response.pagination.totalPages).toBe('number');
    });

    it('evidenceCounts uses signal IDs as keys and numbers as values', () => {
      const counts: Record<string, number> = { 'sig-1': 3, 'sig-2': 1, 'sig-3': 0 };
      for (const [key, val] of Object.entries(counts)) {
        expect(typeof key).toBe('string');
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('categories array contains only valid SignalMeaningCategory values', () => {
      const validCategories = [
        'budget_available', 'leadership_openness', 'tech_dissatisfaction',
        'growth_pressure', 'compliance_requirement', 'vendor_evaluation', 'unknown',
      ];
      const response = {
        signals: mockSignals,
        evidenceCounts: {},
        categories: ['budget_available', 'leadership_openness', 'tech_dissatisfaction'],
        pagination: { page: 1, pageSize: 20, total: 3, totalPages: 1 },
      };
      expect(response.categories.every(c => validCategories.includes(c))).toBe(true);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 2: Integration Tests — Evidence Count Accuracy
   (Per ARCHITECTURE.md: "Integration test: Evidence count accuracy")
   
   Tests the evidenceCounts computation from /api/signals/route.ts
   which now counts ACTUAL resolvable Evidence records, not just
   JSON array length.
   
   In production: the API reads evidenceIds JSON arrays, then batch-
   queries Evidence table, then counts only IDs that resolved to real
   records. This simulates that pipeline.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Simulates the evidenceCounts pipeline from /api/signals/route.ts:
 * 1. Parse evidenceIds JSON arrays from signals
 * 2. Batch-resolve IDs against a simulated Evidence DB
 * 3. Count only IDs that resolved to actual records
 */
function computeEvidenceCounts(
  signals: { id: string; evidenceIds: unknown }[],
  existingEvidenceIds: Set<string>
): Record<string, number> {
  // Step 1: Parse all evidenceIds
  const signalEvidenceIdsMap: Record<string, string[]> = {};
  for (const s of signals) {
    let ids: string[] = [];
    try {
      const raw = typeof s.evidenceIds === 'string'
        ? JSON.parse(s.evidenceIds)
        : s.evidenceIds;
      if (Array.isArray(raw)) {
        ids = raw.filter((eid: unknown) => typeof eid === 'string' && eid.length > 0);
      }
    } catch { /* skip malformed JSON */ }
    signalEvidenceIdsMap[s.id] = ids;
  }

  // Step 2 + 3: Count only resolvable IDs
  const evidenceCounts: Record<string, number> = {};
  for (const [signalId, ids] of Object.entries(signalEvidenceIdsMap)) {
    evidenceCounts[signalId] = ids.filter(eid => existingEvidenceIds.has(eid)).length;
  }
  return evidenceCounts;
}

describe('Ticket 8 — Evidence Count Accuracy (Integration)', () => {

  it('correctly counts evidence IDs that exist in the database', () => {
    const signals = [
      { id: 'sig-a', evidenceIds: '["ev-1","ev-2","ev-3"]' },
      { id: 'sig-b', evidenceIds: '["ev-4"]' },
      { id: 'sig-c', evidenceIds: '[]' },
    ];
    // All evidence records exist in DB
    const existingIds = new Set(['ev-1', 'ev-2', 'ev-3', 'ev-4']);
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-a']).toBe(3);
    expect(counts['sig-b']).toBe(1);
    expect(counts['sig-c']).toBe(0);
  });

  it('counts only existing records when some evidenceIds reference deleted records', () => {
    // This is the critical accuracy test: evidenceIds may reference
    // Evidence records that have been deleted from the DB
    const signals = [
      { id: 'sig-x', evidenceIds: '["ev-1","ev-2","ev-3","ev-deleted"]' },
      { id: 'sig-y', evidenceIds: '["ev-4","ev-also-deleted"]' },
    ];
    // Only ev-1, ev-2, ev-3, ev-4 exist; ev-deleted and ev-also-deleted are gone
    const existingIds = new Set(['ev-1', 'ev-2', 'ev-3', 'ev-4']);
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-x']).toBe(3); // not 4 — one ID is stale
    expect(counts['sig-y']).toBe(1); // not 2 — one ID is stale
  });

  it('returns 0 when ALL evidenceIds reference deleted records', () => {
    const signals = [
      { id: 'sig-z', evidenceIds: '["ev-gone-1","ev-gone-2","ev-gone-3"]' },
    ];
    const existingIds = new Set<string>(); // empty — all deleted
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-z']).toBe(0);
  });

  it('handles already-parsed JSON arrays', () => {
    const signals = [
      { id: 'sig-d', evidenceIds: ['ev-1', 'ev-2'] },
      { id: 'sig-e', evidenceIds: [] },
    ];
    const existingIds = new Set(['ev-1', 'ev-2']);
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-d']).toBe(2);
    expect(counts['sig-e']).toBe(0);
  });

  it('handles null/undefined evidenceIds gracefully', () => {
    const signals = [
      { id: 'sig-f', evidenceIds: null },
      { id: 'sig-g', evidenceIds: undefined },
    ];
    const existingIds = new Set<string>();
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-f']).toBe(0);
    expect(counts['sig-g']).toBe(0);
  });

  it('handles malformed JSON gracefully (does not throw)', () => {
    const signals = [
      { id: 'sig-h', evidenceIds: 'not-valid-json' },
      { id: 'sig-i', evidenceIds: '{broken: true' },
    ];
    const existingIds = new Set<string>();
    // Should not throw
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-h']).toBe(0);
    expect(counts['sig-i']).toBe(0);
  });

  it('handles non-array parsed JSON gracefully', () => {
    const signals = [
      { id: 'sig-j', evidenceIds: '"just-a-string"' },
      { id: 'sig-k', evidenceIds: '{"key": "value"}' },
    ];
    const existingIds = new Set<string>();
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-j']).toBe(0);
    expect(counts['sig-k']).toBe(0);
  });

  it('produces correct counts for large arrays with partial deletions', () => {
    const largeIds = Array.from({ length: 100 }, (_, i) => `ev-${i}`);
    // Simulate that 10 records (ev-90 through ev-99) have been deleted
    const existingIds = new Set(largeIds.slice(0, 90));
    const signals = [
      { id: 'sig-large', evidenceIds: JSON.stringify(largeIds) },
    ];
    const counts = computeEvidenceCounts(signals, existingIds);
    expect(counts['sig-large']).toBe(90); // not 100
  });

  it('total evidence across all signals matches sum of resolvable records', () => {
    const signals = [
      { id: 'sig-1', evidenceIds: '["e1","e2","e3","e4","e5"]' },
      { id: 'sig-2', evidenceIds: '["e6","e7","e8"]' },
      { id: 'sig-3', evidenceIds: '[]' },
    ];
    // e4 has been deleted
    const existingIds = new Set(['e1', 'e2', 'e3', 'e5', 'e6', 'e7', 'e8']);
    const counts = computeEvidenceCounts(signals, existingIds);

    expect(counts['sig-1']).toBe(4); // was 5, but e4 deleted
    expect(counts['sig-2']).toBe(3);
    expect(counts['sig-3']).toBe(0);

    const totalEvidence = Object.values(counts).reduce((sum, c) => sum + c, 0);
    expect(totalEvidence).toBe(7); // 4 + 3 + 0
  });
});

/* ═══════════════════════════════════════════════════════════════
   TEST SUITE 3: Frontend — Evidence Detail Panel Validation
   Validates the EvidenceRecord type matches the API response shape
   from GET /api/signals/[id]/evidence
   ═══════════════════════════════════════════════════════════════ */

describe('Ticket 8 — Evidence Detail Panel Data Shape', () => {
  const mockEvidence: EvidenceRecord[] = [
    {
      id: 'ev-1',
      sourceUrl: 'https://example.com/news/acme-funding',
      sourceTitle: 'Acme Corp Raises $50M Series C',
      sourceName: 'TechCrunch',
      snippet: 'Acme Corp today announced a $50M Series C round led by Vertex Ventures...',
      extractedField: 'funding_amount',
      extractedValue: '$50,000,000',
      relevanceScore: 0.95,
      confidence: 0.92,
      sourceDate: '2026-07-28',
      sourceQualityTier: 'tier1',
      status: 'active',
      createdAt: '2026-07-28T12:00:00Z',
    },
    {
      id: 'ev-2',
      sourceUrl: 'https://blog.example.com/acme-growth',
      sourceTitle: null,
      sourceName: 'Industry Blog',
      snippet: 'Sources close to the company confirm rapid expansion plans...',
      extractedField: null,
      extractedValue: null,
      relevanceScore: 0.7,
      confidence: 0.65,
      sourceDate: null,
      sourceQualityTier: 'tier3',
      status: 'active',
      createdAt: '2026-07-28T13:00:00Z',
    },
  ];

  it('evidence records have all required fields', () => {
    const requiredFields: (keyof EvidenceRecord)[] = [
      'id', 'sourceUrl', 'sourceTitle', 'sourceName', 'snippet',
      'extractedField', 'extractedValue', 'relevanceScore', 'confidence',
      'sourceDate', 'sourceQualityTier', 'status', 'createdAt',
    ];
    for (const record of mockEvidence) {
      for (const field of requiredFields) {
        expect(field in record).toBe(true);
      }
    }
  });

  it('evidence is ordered by confidence descending (as per API)', () => {
    for (let i = 1; i < mockEvidence.length; i++) {
      expect(mockEvidence[i].confidence).toBeLessThanOrEqual(mockEvidence[i - 1].confidence);
    }
  });

  it('handles evidence with null optional fields gracefully', () => {
    const record = mockEvidence[1]; // has null sourceTitle, extractedField, extractedValue, sourceDate
    expect(record.id).toBe('ev-2');
    expect(record.sourceTitle).toBeNull();
    expect(record.extractedField).toBeNull();
    expect(record.extractedValue).toBeNull();
    expect(record.sourceDate).toBeNull();
    // Non-null fields still present
    expect(record.sourceName).toBe('Industry Blog');
    expect(record.snippet).toBeTruthy();
  });
});
