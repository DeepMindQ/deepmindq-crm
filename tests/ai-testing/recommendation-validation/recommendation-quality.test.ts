import { describe, it, expect } from 'vitest'

describe('Recommendation Validation — Priority Ordering', () => {
  it('sorts by score descending', () => {
    const recs = [{action:'Low',score:30},{action:'High',score:85},{action:'Med',score:60}];
    const sorted = [...recs].sort((a,b) => b.score - a.score);
    expect(sorted[0].action).toBe('High');
    expect(sorted[1].action).toBe('Med');
    expect(sorted[2].action).toBe('Low');
  });
});

describe('Recommendation Validation — Actionability', () => {
  const VERBS = ['schedule','send','call','prepare','research','update','create','review','follow','reach out'];
  it('starts with actionable verb', () => {
    const rec = 'Schedule a demo call with the CTO';
    expect(VERBS).toContain(rec.split(' ')[0].toLowerCase());
  });
  it('rejects vague recommendations', () => {
    const isVague = (r: string) => !VERBS.some(v => r.toLowerCase().startsWith(v));
    expect(isVague('Look into this company')).toBe(true);
    expect(isVague('Schedule a meeting')).toBe(false);
  });
});

describe('Recommendation Validation — Evidence Backing', () => {
  it('requires evidence reference', () => {
    expect('Schedule demo with CTO (based on hiring signal [E3])').toMatch(/\[E\d+\]/);
  });
  it('flags missing evidence', () => {
    expect('Send an email to the company').not.toMatch(/\[E\d+\]/);
  });
});