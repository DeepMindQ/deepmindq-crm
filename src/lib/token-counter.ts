/**
 * P3.1 — Central Token Counter
 *
 * Uses tiktoken for accurate BPE token counting when available,
 * falls back to character-based heuristic.
 *
 * The tiktoken encoding is loaded lazily on first use and cached
 * for the lifetime of the process. If tiktoken fails to load (e.g.
 * in edge runtimes without WASM support) the heuristic is used
 * permanently.
 */

let _encoding: any = null;
let _encodingLoadFailed = false;

async function getEncoding(): Promise<any> {
  if (_encoding) return _encoding;
  if (_encodingLoadFailed) return null;
  try {
    const tiktoken = await import('tiktoken');
    // encoding_for_model is synchronous in the tiktoken npm package.
    // Use cl100k_base (GPT-4/GPT-3.5 compatible, close enough for most models)
    _encoding = tiktoken.encoding_for_model('gpt-4');
    return _encoding;
  } catch {
    _encodingLoadFailed = true;
    return null;
  }
}

/**
 * Count tokens in a text string using tiktoken (BPE) when available,
 * falling back to a character-based heuristic.
 *
 * This function is async because tiktoken initialization is async.
 * It never throws — errors from tiktoken are silently caught and the
 * heuristic is used instead.
 */
export async function countTokens(text: string): Promise<number> {
  if (!text) return 0;
  const enc = await getEncoding();
  if (enc) {
    try {
      const tokens = enc.encode(text);
      return tokens.length;
    } catch {
      // tiktoken failed for this text, fall through to heuristic
    }
  }
  return estimateTokens(text);
}

/**
 * Character-based heuristic fallback for token estimation.
 *
 * Uses segment-specific ratios:
 * - CJK text: ~1.5 chars/token
 * - Code punctuation: ~3 chars/token
 * - Other (English, whitespace): ~4 chars/token
 *
 * This is the same logic that was in model-router.ts and is kept
 * here for synchronous callers that cannot await.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let code = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) > 0x2E7F) cjk++;
    else if ('{}[]()<>;:=+-*/&|!@#$%^~`\'"'.includes(char)) code++;
    else other++;
  }
  return Math.ceil(cjk / 1.5) + Math.ceil(code / 3) + Math.ceil(other / 4);
}
