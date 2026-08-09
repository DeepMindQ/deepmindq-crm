/**
 * Shared Deduplication Matching Utilities
 *
 * Single source of truth for string matching functions used by both:
 *   - dedup-engine.ts (batch company dedup scanning)
 *   - deduplicator.ts (import-time row-level dedup)
 *
 * Functions are pure and stateless — safe to call from any module.
 */

// ── Levenshtein Distance ───────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }
  return dp[m][n];
}

// ── Normalization ─────────────────────────────────────────────────

/**
 * Normalize a company name for matching by stripping legal suffixes,
 * punctuation, and extra whitespace.
 */
export function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|corporation|limited|co|company|pvt|private|gmbh|ag|bv|sa|pte|srl|pty|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Company Similarity ────────────────────────────────────────────

/**
 * Compute similarity between two company names (0–100).
 * Uses normalized form comparison + word overlap with fuzzy matching.
 */
export function companySimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 95;
  if (na.includes(nb) || nb.includes(na)) return 75;

  const wordsA = na.split(/\s+/).filter(Boolean);
  const wordsB = nb.split(/\s+/).filter(Boolean);

  // Word overlap ratio
  const overlap = wordsA.filter(wa =>
    wordsB.some(wb => wb === wa || levenshtein(wa, wb) <= 1)
  );
  if (overlap.length === 0) return 0;

  return Math.round(
    (overlap.length / Math.max(wordsA.length, wordsB.length)) * 70
  );
}

/**
 * General string similarity (0–100) using Levenshtein distance.
 * Used for email-based and non-company-name comparisons.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 100;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 98;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(na, nb) / maxLen) * 100);
}
