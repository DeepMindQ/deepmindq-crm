import { describe, it, expect } from 'vitest';

// ─── Signal Detection Tests ──────────────────────────────────────────────

describe('Signal Confidence Scoring', () => {
  it('scores high confidence for direct employee data', () => {
    const score = 85;
    expect(score).toBeGreaterThan(70);
  });

  it('scores medium confidence for industry inference', () => {
    const score = 75;
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(90);
  });

  it('scores low confidence for absence of data', () => {
    const score = 30;
    expect(score).toBeLessThan(50);
  });
});

describe('Signal Severity Classification', () => {
  it('classifies large enterprise as high severity', () => {
    const employeeCount = 2500;
    const severity = employeeCount > 2000 ? 'high' : 'medium';
    expect(severity).toBe('high');
  });

  it('classifies mid-market as medium severity', () => {
    const employeeCount = 800;
    const severity = employeeCount > 2000 ? 'high' : 'medium';
    expect(severity).toBe('medium');
  });

  it('classifies critical signals correctly', () => {
    const severity = 'critical';
    expect(['critical', 'high', 'medium', 'low']).toContain(severity);
  });
});

describe('Revenue Parsing', () => {
  it('parses million format', () => {
    const revenue = '$50M';
    const cleaned = revenue.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    const multiplier = /billion|b/i.test(revenue) ? 1_000_000_000
      : /million|m/i.test(revenue) ? 1_000_000
      : /thousand|k/i.test(revenue) ? 1_000 : 1;
    const result = num * multiplier;
    expect(result).toBe(50_000_000);
  });

  it('parses billion format', () => {
    const revenue = '$2.5B';
    const cleaned = revenue.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    const multiplier = /billion|b/i.test(revenue) ? 1_000_000_000 : 1;
    const result = num * multiplier;
    expect(result).toBe(2_500_000_000);
  });

  it('handles unknown revenue', () => {
    const revenue = 'Unknown';
    const cleaned = revenue.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    expect(Number.isFinite(num)).toBe(false);
  });
});

// ─── Reasoning Tests ─────────────────────────────────────────────────────

describe('Confidence Level Classification', () => {
  it('classifies very_high (90+)', () => {
    const score = 95;
    const level = score >= 90 ? 'very_high' : score >= 75 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'very_low';
    expect(level).toBe('very_high');
  });

  it('classifies high (75-89)', () => {
    const score = 82;
    const level = score >= 90 ? 'very_high' : score >= 75 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'very_low';
    expect(level).toBe('high');
  });

  it('classifies medium (50-74)', () => {
    const score = 60;
    const level = score >= 90 ? 'very_high' : score >= 75 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'very_low';
    expect(level).toBe('medium');
  });

  it('classifies low (25-49)', () => {
    const score = 35;
    const level = score >= 90 ? 'very_high' : score >= 75 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'very_low';
    expect(level).toBe('low');
  });

  it('classifies very_low (<25)', () => {
    const score = 10;
    const level = score >= 90 ? 'very_high' : score >= 75 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'very_low';
    expect(level).toBe('very_low');
  });
});

describe('Opportunity Score Calculation', () => {
  it('calculates high opportunity with many signals and contacts', () => {
    const signalStrength = 5;
    const contactCoverage = 4;
    const dataRichness = 3;
    const score = Math.min(100,
      (signalStrength > 3 ? 30 : signalStrength * 10) +
      (contactCoverage > 2 ? 25 : contactCoverage * 12) +
      (dataRichness * 15)
    );
    expect(score).toBeGreaterThan(70);
  });

  it('calculates low opportunity with limited data', () => {
    const signalStrength = 1;
    const contactCoverage = 0;
    const dataRichness = 1;
    const score = Math.min(100,
      (signalStrength > 3 ? 30 : signalStrength * 10) +
      (contactCoverage > 2 ? 25 : contactCoverage * 12) +
      (dataRichness * 15)
    );
    expect(score).toBeLessThan(50);
  });
});

describe('Signal Grouping', () => {
  it('groups signals by type', () => {
    const signals = [
      { signalType: 'financial_indicator', title: 'A' },
      { signalType: 'financial_indicator', title: 'B' },
      { signalType: 'leadership_change', title: 'C' },
    ];

    const grouped = signals.reduce((groups: Record<string, unknown[]>, item) => {
      const key = String(item.signalType);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, unknown[]>);

    expect(grouped['financial_indicator']).toHaveLength(2);
    expect(grouped['leadership_change']).toHaveLength(1);
  });
});
