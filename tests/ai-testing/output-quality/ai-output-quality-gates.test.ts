import { describe, it, expect } from 'vitest'

describe('Output Quality — Citation Validation', () => {
  const re = /\[E\d+\]/;
  it('accepts [E1], [E12], [E100]', () => {
    expect(re.test('[E1]')).toBe(true);
    expect(re.test('[E12]')).toBe(true);
    expect(re.test('[E100]')).toBe(true);
  });
  it('rejects invalid formats', () => {
    expect(re.test('[e1]')).toBe(false);
    expect(re.test('[1]')).toBe(false);
    expect(re.test('(E1)')).toBe(false);
  });
});

describe('Output Quality — Hedging Detection', () => {
  const HEDGES = ['might','may','could','possibly','perhaps','suggests','appears','seems','potentially','likely','estimated'];
  it('detects hedging in vague text', () => {
    const text = 'The company might be expanding and could hire 200 people.';
    expect(HEDGES.filter(h => text.toLowerCase().includes(h)).length).toBeGreaterThanOrEqual(2);
  });
  it('no hedging in definitive text', () => {
    const text = 'The company announced a $50M Series B funding round on March 15, 2025.';
    expect(HEDGES.filter(h => text.toLowerCase().includes(h)).length).toBeLessThanOrEqual(1);
  });
});

describe('Output Quality — Specificity Scoring', () => {
  const score = (t: string) => {
    let s = 0;
    if (/\d+/.test(t)) s += 20;
    if (/\$[\d,]+/.test(t)) s += 15;
    if (/\d{4}/.test(t)) s += 15;
    if (/\[E\d+\]/.test(t)) s += 15;
    return Math.min(100, s);
  };
  it('detailed text scores >=60', () => {
    expect(score('TechCorp raised $50M on March 15, 2025 [E1]. CEO Sarah Chen announced.')).toBeGreaterThanOrEqual(60);
  });
  it('vague text scores <20', () => {
    expect(score('The company might be doing something soon.')).toBeLessThan(20);
  });
});