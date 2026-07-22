import { describe, test, expect } from 'bun:test';
import { estimateCost } from '../usage-tracker';

describe('estimateCost', () => {
  test('returns 0 for free tier models', () => {
    expect(estimateCost('meta/llama-3.1-8b-instruct', 1000, 500)).toBe(0);
    expect(estimateCost('accounts/fireworks/models/llama-v3p3-70b-instruct', 1000, 500)).toBe(0);
    expect(estimateCost('llama-3.3-70b-versatile', 1000, 500)).toBe(0);
  });

  test('calculates cost for gemini-2.0-flash', () => {
    // prompt: $0.000075/token, completion: $0.0003/token
    const cost = estimateCost('gemini-2.0-flash', 1000, 1000);
    // (1000/1000 * 0.000075) + (1000/1000 * 0.0003) = 0.000075 + 0.0003 = 0.000375
    expect(cost).toBeCloseTo(0.000375, 6);
  });

  test('calculates cost for gpt-4o', () => {
    // prompt: $0.0025/token, completion: $0.01/token
    const cost = estimateCost('gpt-4o', 1000, 1000);
    // (1000/1000 * 0.0025) + (1000/1000 * 0.01) = 0.0025 + 0.01 = 0.0125
    expect(cost).toBeCloseTo(0.0125, 4);
  });

  test('handles zero tokens', () => {
    expect(estimateCost('gemini-2.0-flash', 0, 0)).toBe(0);
    expect(estimateCost('gpt-4o', 0, 0)).toBe(0);
  });

  test('handles unknown model with default rate', () => {
    const cost = estimateCost('unknown-model', 1000, 1000);
    // Default rate: prompt $0.001/1K, completion $0.005/1K
    // (1000/1000 * 0.001) + (1000/1000 * 0.005) = 0.006
    expect(cost).toBeCloseTo(0.006, 4);
  });

  test('returns non-negative values', () => {
    const cost = estimateCost('claude-sonnet', 10000, 5000);
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  test('scales linearly with tokens', () => {
    const cost1 = estimateCost('gemini-2.0-flash', 1000, 1000);
    const cost2 = estimateCost('gemini-2.0-flash', 2000, 2000);
    expect(cost2).toBeCloseTo(cost1 * 2, 3);
  });
});
