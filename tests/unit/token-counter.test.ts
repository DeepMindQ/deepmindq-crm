// ═══════════════════════════════════════════════════════════════════════════
// Token Counter — Unit Tests
//
// Tests approximateTokenCount and countTokens from @/lib/token-counter.ts.
// tiktoken is mocked to always fail, so countTokens falls back to approximation.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Force tiktoken to fail so countTokens uses approximation path
vi.mock('tiktoken', () => {
  throw new Error('tiktoken not available');
});

import { approximateTokenCount, countTokens } from '@/lib/token-counter';

describe('token-counter', () => {
  // ── approximateTokenCount ─────────────────────────────────────────
  describe('approximateTokenCount', () => {
    it('returns 0 for empty string', () => {
      expect(approximateTokenCount('')).toBe(0);
    });

    it('returns at least 1 for non-empty string', () => {
      expect(approximateTokenCount('a')).toBeGreaterThanOrEqual(1);
    });

    it('estimates English text correctly (~4 chars/token)', () => {
      const text = 'a'.repeat(100); // 100 chars
      const tokens = approximateTokenCount(text);
      // 100/4 * 1.05 = 26.25 → ceil = 27
      expect(tokens).toBe(27);
    });

    it('estimates longer English text', () => {
      const text = 'Hello world! This is a test of the token counter.';
      const tokens = approximateTokenCount(text);
      const charsPerToken = 4;
      const expected = Math.ceil((text.length / charsPerToken) * 1.05);
      expect(tokens).toBe(expected);
    });

    it('detects CJK characters and uses 2 chars/token', () => {
      // 10 repetitions of '你好' = 20 CJK chars + 5 ASCII = 25 total chars
      const text = '你好你好你好你好你好你好你好你好你好你好abcde';
      const tokens = approximateTokenCount(text);
      // Using CJK ratio: 25/2 * 1.05 = 13.125 → ceil = 14
      expect(tokens).toBe(14);
    });

    it('uses English ratio when CJK is under 10%', () => {
      // 1 CJK char in 100 ASCII chars = 1% → not significant
      const text = 'a'.repeat(99) + '你';
      const tokens = approximateTokenCount(text);
      // English ratio: 100/4 * 1.05 = 26.25 → ceil = 27
      expect(tokens).toBe(27);
    });

    it('handles exactly 10% CJK (not > 10%, so English)', () => {
      // 10 CJK in 100 chars = exactly 10%, not > 10%
      const cjk = '你'.repeat(10);
      const ascii = 'a'.repeat(90);
      const text = cjk + ascii;
      const tokens = approximateTokenCount(text);
      // Should use English ratio since 10 is NOT > 10
      expect(tokens).toBe(Math.ceil((100 / 4) * 1.05));
    });

    it('handles whitespace-only text', () => {
      const tokens = approximateTokenCount('   ');
      expect(tokens).toBeGreaterThanOrEqual(1);
    });

    it('handles Korean (Hangul) characters', () => {
      // Hangul range: U+AC00–U+D7AF
      const text = '안녕하세요'; // 5 Hangul chars
      const tokens = approximateTokenCount(text);
      // All CJK-like → 5/2 * 1.05 = 2.625 → ceil = 3
      expect(tokens).toBe(3);
    });

    it('handles Hiragana characters', () => {
      // Hiragana range: U+3040–U+309F
      const text = 'こんにちは'; // 5 Hiragana chars
      const tokens = approximateTokenCount(text);
      expect(tokens).toBe(3);
    });

    it('handles Katakana characters', () => {
      // Katakana range: U+30A0–U+30FF
      const text = 'コンニチハ'; // 5 Katakana chars
      const tokens = approximateTokenCount(text);
      expect(tokens).toBe(3);
    });
  });

  // ── countTokens (async, tiktoken mocked to fail) ────────────────
  describe('countTokens', () => {
    it('returns 0 for empty string', async () => {
      expect(await countTokens('')).toBe(0);
    });

    it('falls back to approximation when tiktoken unavailable', async () => {
      const text = 'Hello world test string';
      const asyncResult = await countTokens(text);
      const syncResult = approximateTokenCount(text);
      expect(asyncResult).toBe(syncResult);
    });

    it('handles very long text', async () => {
      const text = 'a'.repeat(10000);
      const tokens = await countTokens(text);
      expect(tokens).toBe(approximateTokenCount(text));
    });
  });
});
