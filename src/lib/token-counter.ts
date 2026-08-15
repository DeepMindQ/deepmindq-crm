/**
 * Token Counter — Estimation utilities for LLM usage tracking.
 *
 * Provides a fast character-based approximation when tiktoken is not
 * available, and a precise tiktoken-based count when it is.
 *
 * Character-based heuristic: ~4 characters per token for English text.
 * This is accurate to within ~10-15% for typical English prose.
 */

// Approximate tokens per character for different languages
const CHARS_PER_TOKEN_EN = 4;
const CHARS_PER_TOKEN_CJK = 2;

/**
 * Detect if text contains significant CJK characters.
 * CJK text has roughly 2 chars per token (much denser than English).
 */
function hasSignificantCJK(text: string): boolean {
  let cjkCount = 0;
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const code = text.charCodeAt(i);
    // CJK Unified Ideographs: U+4E00–U+9FFF
    // Hiragana: U+3040–U+309F
    // Katakana: U+30A0–U+30FF
    // Hangul: U+AC00–U+D7AF
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    ) {
      cjkCount++;
    }
  }
  return cjkCount > Math.min(text.length, 500) * 0.1; // >10% CJK
}

/**
 * Count tokens in text using the best available method.
 *
 * Priority:
 *   1. tiktoken (if available) — precise GPT-style BPE tokenization
 *   2. Character-based approximation — fast, ~10-15% error for English
 *
 * @param text - The text to count tokens for
 * @returns Estimated or precise token count
 */
export async function countTokens(text: string): Promise<number> {
  if (!text) return 0;

  // Try tiktoken for precise counting
  try {
    const tiktoken = await import('tiktoken');
    // Dynamic import may fail if tiktoken isn't installed or doesn't bundle for this env
    if (typeof tiktoken.encoding_for_model === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encoder = tiktoken.encoding_for_model('gpt-4o' as any);
      return encoder.encode(text).length;
    }
  } catch {
    // tiktoken not available — fall through to approximation
  }

  // Character-based approximation
  return approximateTokenCount(text);
}

/**
 * Fast synchronous token approximation.
 * Use this when async tiktoken loading is not needed.
 *
 * ~4 chars/token for English, ~2 chars/token for CJK-dominant text.
 * Adds ~10% overhead for special tokens (role markers, formatting).
 */
export function approximateTokenCount(text: string): number {
  if (!text) return 0;

  const ratio = hasSignificantCJK(text) ? CHARS_PER_TOKEN_CJK : CHARS_PER_TOKEN_EN;
  // Add 5% buffer for special tokens (BOS, EOS, role markers)
  return Math.max(1, Math.ceil((text.length / ratio) * 1.05));
}
