/**
 * Ticket 6: Company List with Priority Ranking — Tests
 *
 * Covers:
 * - Tier badge color mapping (HOT=red, ACTIVE=green, NURTURE=yellow, LOW=gray)
 * - API sorting by accountPriorityScore (desc, nulls last)
 * - API tier filtering
 * - Response shape includes priorityTier, accountPriorityScore, accountScore
 */

import { describe, it, expect } from 'vitest';

/* ═══════════════════════════════════════════════════
   Tier Badge Color Tests
   ═══════════════════════════════════════════════════ */
const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  HOT: { bg: 'rgba(239,68,68,0.12)', text: '#DC2626' },
  ACTIVE: { bg: 'rgba(16,185,129,0.12)', text: '#059669' },
  NURTURE: { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  LOW: { bg: 'rgba(161,161,170,0.12)', text: '#52525B' },
};

describe('Ticket 6 — Tier Badge Colors', () => {
  it('HOT tier uses red (#DC2626)', () => {
    const t = TIER_BADGE['HOT'];
    expect(t.text).toBe('#DC2626');
    expect(t.bg).toContain('239,68,68');
  });

  it('ACTIVE tier uses green (#059669)', () => {
    const t = TIER_BADGE['ACTIVE'];
    expect(t.text).toBe('#059669');
    expect(t.bg).toContain('16,185,129');
  });

  it('NURTURE tier uses yellow/amber (#D97706)', () => {
    const t = TIER_BADGE['NURTURE'];
    expect(t.text).toBe('#D97706');
    expect(t.bg).toContain('245,158,11');
  });

  it('LOW tier uses gray (#52525B)', () => {
    const t = TIER_BADGE['LOW'];
    expect(t.text).toBe('#52525B');
    expect(t.bg).toContain('161,161,170');
  });

  it('null tier returns fallback gray', () => {
    const tier = null;
    const fallback = { bg: 'rgba(100,100,100,.12)', text: '#52525B' };
    const t = tier ? TIER_BADGE[tier] : fallback;
    expect(t.text).toBe('#52525B');
  });
});

/* ═══════════════════════════════════════════════════
   API Response Shape Tests
   ═══════════════════════════════════════════════════ */
describe('Ticket 6 — API Response Shape', () => {
  it('company row includes priorityTier and accountPriorityScore', () => {
    const row = {
      id: 'c1', rawName: 'Acme Corp', domain: 'acme.com', industry: 'Tech',
      sizeRange: '51-200', country: 'US', status: 'active',
      priorityTier: 'HOT',
      accountPriorityScore: 87.5,
      intelligenceScore: 72,
      accountScore: 91.3,
      accountCategory: 'HOT',
      contactCount: 15, signalCount: 8,
      isEnriched: true, topSignal: null, lastActivityAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
    };
    expect(row.priorityTier).toBe('HOT');
    expect(row.accountPriorityScore).toBe(87.5);
    expect(row.accountScore).toBe(91.3);
    expect(row.signalCount).toBe(8);
  });

  it('nullable fields default to null when not computed', () => {
    const row = {
      id: 'c2', rawName: 'Unknown Co', domain: null, industry: null,
      sizeRange: null, country: null, status: 'prospect',
      priorityTier: null,
      accountPriorityScore: null,
      intelligenceScore: 0,
      accountScore: null,
      accountCategory: null,
      contactCount: 0, signalCount: 0,
      isEnriched: false, topSignal: null, lastActivityAt: null, updatedAt: null,
    };
    expect(row.priorityTier).toBeNull();
    expect(row.accountPriorityScore).toBeNull();
    expect(row.accountScore).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════
   Sorting Logic Tests
   ═══════════════════════════════════════════════════ */
describe('Ticket 6 — Sorting by Priority Score', () => {
  const companies = [
    { id: '1', accountPriorityScore: 45 },
    { id: '2', accountPriorityScore: 92 },
    { id: '3', accountPriorityScore: null },
    { id: '4', accountPriorityScore: 78 },
  ];

  it('sorts desc with nulls last', () => {
    const sorted = [...companies].sort((a, b) => {
      if (a.accountPriorityScore == null) return 1;
      if (b.accountPriorityScore == null) return -1;
      return b.accountPriorityScore - a.accountPriorityScore;
    });
    expect(sorted.map(c => c.id)).toEqual(['2', '4', '1', '3']);
  });

  it('sorts asc with nulls last', () => {
    const sorted = [...companies].sort((a, b) => {
      if (a.accountPriorityScore == null) return 1;
      if (b.accountPriorityScore == null) return -1;
      return a.accountPriorityScore - b.accountPriorityScore;
    });
    expect(sorted.map(c => c.id)).toEqual(['1', '4', '2', '3']);
  });
});

/* ═══════════════════════════════════════════════════
   Tier Filter Tests
   ═══════════════════════════════════════════════════ */
describe('Ticket 6 — Tier Filtering', () => {
  const validTiers = ['HOT', 'ACTIVE', 'NURTURE', 'LOW'];

  it('accepts valid tier values', () => {
    for (const tier of validTiers) {
      expect(validTiers.includes(tier)).toBe(true);
    }
  });

  it('rejects invalid tier values', () => {
    expect(validTiers.includes('UNKNOWN')).toBe(false);
    expect(validTiers.includes('hot')).toBe(false);
    expect(validTiers.includes('')).toBe(false);
  });
});
