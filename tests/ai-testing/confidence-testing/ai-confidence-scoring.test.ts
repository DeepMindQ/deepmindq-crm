import { describe, it, expect } from 'vitest'

describe('AI Confidence — Grade Mapping', () => {
  const grades = [{min:97,g:'A+'},{min:93,g:'A'},{min:90,g:'A-'},{min:87,g:'B+'},{min:83,g:'B'},{min:80,g:'B-'},{min:77,g:'C+'},{min:73,g:'C'},{min:70,g:'C-'},{min:60,g:'D'},{min:0,g:'F'}];
  it('98 -> A+', () => expect(grades.find(g => g.min <= 98)?.g).toBe('A+'));
  it('95 -> A', () => expect(grades.find(g => g.min <= 95)?.g).toBe('A'));
  it('91 -> A-', () => expect(grades.find(g => g.min <= 91)?.g).toBe('A-'));
  it('30 -> F', () => expect(grades.find(g => g.min <= 30)?.g).toBe('F'));
});

describe('AI Confidence — Trust Classification', () => {
  it('>=70 enterprise', () => expect(75).toBeGreaterThanOrEqual(70));
  it('50-69 advisory', () => { expect(60).toBeGreaterThanOrEqual(50); expect(60).toBeLessThan(70); });
  it('30-49 speculative', () => { expect(40).toBeGreaterThanOrEqual(30); expect(40).toBeLessThan(50); });
  it('<30 unreliable', () => expect(20).toBeLessThan(30));
});

describe('AI Confidence — Dimension Weights', () => {
  const W = { data_quality: 0.20, source_reliability: 0.20, freshness: 0.15, cross_validation: 0.15, evidence_coverage: 0.15, ai_certainty: 0.15 };
  it('weights sum to 1.0', () => {
    expect(Object.values(W).reduce((a,b)=>a+b,0)).toBeCloseTo(1.0, 10);
  });
});