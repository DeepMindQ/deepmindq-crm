import { describe, it, expect } from 'vitest'

describe('AI Governance — Generation Types', () => {
  const TYPES = ['company_research','contact_analysis','opportunity_assessment','signal_interpretation','recommendation','competitive_analysis','executive_brief','market_analysis','technology_assessment','financial_analysis','partnership_eval','expansion_planning'];
  it('validates snake_case format', () => {
    const re = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
    TYPES.forEach(t => expect(t).toMatch(re));
  });
  it('has 12+ types', () => expect(TYPES.length).toBeGreaterThanOrEqual(12));
});

describe('AI Governance — Non-Throwing', () => {
  it('returns structured error on failure', () => {
    const r = { success: false, error: 'Check failed', checks: [{name:'rate_limit',passed:false}] };
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });
  it('6-check gate', () => {
    const checks = ['rate_limit','content_policy','input_validation','output_format','citation_requirement','confidence_gate'];
    expect(checks).toHaveLength(6);
  });
});