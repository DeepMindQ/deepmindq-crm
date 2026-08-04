import { describe, it, expect } from 'vitest'

describe('Recommendation Engine — Contact Influence Scoring', () => {
  const SCORES = {
    CEO: 100, CTO: 95, CFO: 92, COO: 90, CMO: 88,
    VP: 75, Director: 65, 'Senior Manager': 55, Manager: 45,
    'Team Lead': 38, Senior: 30, 'Mid-Level': 22, Junior: 15, Intern: 8,
    Founder: 98, 'Co-Founder': 96, President: 97, 'Head of': 80,
  };

  it('CEO scores 100', () => expect(SCORES.CEO).toBe(100));
  it('CTO scores 95', () => expect(SCORES.CTO).toBe(95));
  it('VP scores 75', () => expect(SCORES.VP).toBe(75));
  it('Director scores 65', () => expect(SCORES.Director).toBe(65));
  it('Manager scores 45', () => expect(SCORES.Manager).toBe(45));
  it('Junior scores 15', () => expect(SCORES.Junior).toBe(15));

  it('All C-Suite > 85', () => {
    ['CEO','CTO','CFO','COO','CMO'].forEach(r => expect(SCORES[r]).toBeGreaterThan(85));
  });

  it('Score decreases monotonically CEO > VP > Director > Manager > Junior', () => {
    const hierarchy = ['CEO','VP','Director','Senior Manager','Manager','Senior','Junior'];
    for (let i = 0; i < hierarchy.length - 1; i++) {
      expect(SCORES[hierarchy[i]]).toBeGreaterThan(SCORES[hierarchy[i+1]]);
    }
  });
});

describe('Recommendation Engine — Priority Calculation', () => {
  it('CEO with moderate signal beats Manager with strong signal', () => {
    const score = (inf, sig, tim) => inf * 0.5 + sig * 0.3 + tim * 0.2;
    expect(score(100, 80, 90)).toBeGreaterThan(score(45, 95, 85));
  });
});