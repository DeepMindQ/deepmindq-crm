/**
 * Tests for AI Quality Gates — LLM output validation.
 */

import { describe, it, expect } from 'vitest';

import { runQualityGates, formatQualityReportForLog } from '@/lib/ai-copilot/quality-gates';

describe('Quality Gates', () => {
  describe('Gate 1: Non-empty output', () => {
    it('rejects empty output with score 0', async () => {
      const result = await runQualityGates('prompt', '');
      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('empty_output');
    });

    it('rejects whitespace-only output', async () => {
      const result = await runQualityGates('prompt', '   \n\t  ');
      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });
  });

  describe('Gate 2: Length bounds', () => {
    it('penalizes output that is too short', async () => {
      const short = 'Hi';
      const result = await runQualityGates('prompt', short);
      expect(result.score).toBeLessThan(100);
      expect(result.issues.some((i) => i.startsWith('output_too_short'))).toBe(true);
    });

    it('accepts normal-length output without length penalty', async () => {
      const normal = 'This is a perfectly normal response with enough content to pass.';
      const result = await runQualityGates('prompt', normal);
      expect(result.issues.some((i) => i.startsWith('output_too_short'))).toBe(false);
      expect(result.issues.some((i) => i.startsWith('output_too_long'))).toBe(false);
    });
  });

  describe('Gate 3: JSON validation', () => {
    it('passes for valid JSON', async () => {
      const json = JSON.stringify({ name: 'Acme Corp', score: 85 });
      const result = await runQualityGates('prompt', json);
      expect(result.issues.some((i) => i.startsWith('invalid_json'))).toBe(false);
    });

    it('penalizes malformed JSON that looks like JSON', async () => {
      const malformed = '{ name: "Acme", broken';
      const result = await runQualityGates('prompt', malformed);
      expect(result.issues.some((i) => i.startsWith('invalid_json'))).toBe(true);
    });

    it('extracts JSON from markdown code blocks', async () => {
      const withBlock = '```json\n{"name": "Acme"}\n```';
      const result = await runQualityGates('prompt', withBlock);
      expect(result.issues.some((i) => i.startsWith('invalid_json'))).toBe(false);
    });
  });

  describe('Gate 4: Hallucination detection', () => {
    it('flags placeholder URLs', async () => {
      const text = 'Check https://www.example.com for details.';
      const result = await runQualityGates('prompt', text);
      expect(result.issues.some((i) => i.includes('placeholder_url'))).toBe(true);
    });

    it('flags excessive disclaimers', async () => {
      const text =
        "As an AI I cannot verify this. As an AI I don't have access. As an AI I cannot verify. As an AI I don't have access.";
      const result = await runQualityGates('prompt', text);
      expect(result.issues.some((i) => i.includes('excessive_disclaimers'))).toBe(true);
    });

    it('flags serialized nulls', async () => {
      const text = 'The value is "null" and status is "undefined".';
      const result = await runQualityGates('prompt', text);
      expect(result.issues.some((i) => i.includes('serialized_nulls'))).toBe(true);
    });
  });

  describe('Gate 5: Repetition detection', () => {
    it('flags highly repetitive output', async () => {
      const repetitive = 'This is a test. This is a test. This is a test. '.repeat(20);
      const result = await runQualityGates('prompt', repetitive);
      expect(result.issues.some((i) => i.includes('repetitive_output'))).toBe(true);
    });

    it('does not flag normal varied output', async () => {
      const varied =
        'Acme Corp is a technology company based in San Francisco. They have been growing rapidly and recently raised a Series B round. The company focuses on AI-powered analytics.';
      const result = await runQualityGates('prompt', varied);
      expect(result.issues.some((i) => i.includes('repetitive_output'))).toBe(false);
    });
  });

  describe('Pass/Fail Threshold', () => {
    it('passes for good output', async () => {
      const good = JSON.stringify({
        analysis: 'Acme Corp shows strong growth indicators.',
        confidence: 85,
      });
      const result = await runQualityGates('prompt', good);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('fails for very poor output', async () => {
      const result = await runQualityGates('prompt', '');
      expect(result.passed).toBe(false);
    });
  });

  describe('Format Report', () => {
    it('formats passing report correctly', () => {
      const report = formatQualityReportForLog({ score: 90, issues: [], passed: true });
      expect(report).toBe('quality:pass:90');
    });

    it('formats failing report with issues', () => {
      const report = formatQualityReportForLog({
        score: 30,
        issues: ['empty_output', 'output_too_short:2chars'],
        passed: false,
      });
      expect(report).toBe('quality:fail:30:empty_output,output_too_short:2chars');
    });
  });
});
