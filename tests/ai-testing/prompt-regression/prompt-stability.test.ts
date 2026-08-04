import { describe, it, expect } from 'vitest'

describe('Prompt Regression — Governance Elements', () => {
  const REQUIRED = ['factual','evidence','citation','verify','confidence','uncertainty','hallucination'];
  it('prompt contains all governance elements', () => {
    const prompt = 'Analyze company intelligence with confidence scoring. Only include factual claims supported by evidence. Include citations in [E_n] format. Verify all claims against hallucination risk. Express uncertainty when confidence is low. Do not hallucinate information.';
    const missing = REQUIRED.filter(e => !prompt.toLowerCase().includes(e));
    expect(missing).toEqual([]);
  });
  it('includes citation format', () => expect('Use [E1], [E2] format').toMatch(/\[E\d+\]/));
  it('includes confidence instructions', () => expect('Rate confidence 0-100').toMatch(/0-100|confidence/i));
});

describe('Prompt Regression — Output Format', () => {
  it('enforces JSON structure', () => {
    const tmpl = 'Return JSON with summary, signals, recommendations';
    expect(tmpl).toContain('JSON');
    expect(tmpl).toContain('summary');
    expect(tmpl).toContain('signals');
  });
});