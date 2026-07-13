/**
 * TF-IDF Embedding Engine (C-01, C-02)
 *
 * A pragmatic local embedding approach using TF-IDF vectors + cosine similarity.
 * Works without external services and gives real semantic matching (not just token overlap).
 * Can be upgraded to transformer embeddings later.
 */

/* ═══════════════════════════════════════════════════
   Tokenization & Normalization
   ═══════════════════════════════════════════════════ */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which',
  'who', 'whom', 'how', 'when', 'where', 'why', 'if', 'then', 'else', 'not',
  'no', 'nor', 'so', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
  'all', 'also', 'am', 'any', 'because', 'before', 'below', 'between', 'both',
  'each', 'few', 'further', 'here', 'into', 'more', 'most', 'other', 'out',
  'over', 'own', 'same', 'some', 'such', 'than', 'there', 'through', 'under',
  'until', 'up', 'while', 'down', 'during', 'only', 'once', 's', 't', 're',
  've', 'll', 'd', 'm', 'don', 'doesn', 'didn', 'won', 'wouldn', 'couldn',
  'shouldn', 'hasn', 'haven', 'hadn', 'isn', 'aren', 'wasn', 'weren',
]);

/**
 * Tokenize text into normalized terms.
 * Strips punctuation, lowercases, removes stop words and short tokens.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Apply bigram tokenization to capture multi-word terms.
 * e.g. "machine learning" -> ["machine", "learning", "machine_learning"]
 */
export function tokenizeWithBigrams(text: string): string[] {
  const unigrams = tokenize(text);
  const bigrams: string[] = [];
  for (let i = 0; i < unigrams.length - 1; i++) {
    bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`);
  }
  return [...unigrams, ...bigrams];
}

/* ═══════════════════════════════════════════════════
   TF-IDF Vocabulary Builder
   ═══════════════════════════════════════════════════ */

/**
 * Build a vocabulary (term → index) from a corpus of texts.
 * Also computes IDF (inverse document frequency) for each term.
 */
export function buildVocabulary(texts: string[]): {
  vocab: Map<string, number>;
  idf: Float64Array;
} {
  const termDocCount = new Map<string, number>();
  const vocab = new Map<string, number>();
  let idx = 0;

  // First pass: count document frequency and assign indices
  for (const text of texts) {
    const tokens = new Set(tokenizeWithBigrams(text));
    for (const token of tokens) {
      termDocCount.set(token, (termDocCount.get(token) || 0) + 1);
      if (!vocab.has(token)) {
        vocab.set(token, idx++);
      }
    }
  }

  // Compute IDF: log(N / df) + 1 (smoothed)
  const N = texts.length;
  const idf = new Float64Array(vocab.size);
  for (const [term, termIdx] of vocab) {
    const df = termDocCount.get(term) || 1;
    idf[termIdx] = Math.log((N + 1) / df) + 1;
  }

  return { vocab, idf };
}

/* ═══════════════════════════════════════════════════
   Text → Vector Conversion
   ═══════════════════════════════════════════════════ */

/**
 * Convert text to a TF-IDF vector using the provided vocabulary and IDF weights.
 * Returns a sparse-like Float64Array indexed by the vocabulary.
 */
export function textToVector(
  text: string,
  vocab: Map<string, number>,
  idf: Float64Array
): Float64Array {
  const vector = new Float64Array(vocab.size);
  const tokens = tokenizeWithBigrams(text);

  // Count term frequency
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize TF (log normalization: 1 + log(tf))
  for (const [term, count] of tf) {
    const termIdx = vocab.get(term);
    if (termIdx !== undefined) {
      vector[termIdx] = (1 + Math.log(count)) * idf[termIdx];
    }
  }

  return vector;
}

/* ═══════════════════════════════════════════════════
   Similarity Functions
   ═══════════════════════════════════════════════════ */

/**
 * Compute cosine similarity between two vectors.
 * cos(θ) = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(a: number[] | Float64Array, b: number[] | Float64Array): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Generate a combined text representation from a capability asset
 * for use in embedding computation.
 */
export function assetToText(asset: {
  title?: string;
  summary?: string;
  content?: string | null;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
}): string {
  return [
    asset.title || '',
    asset.summary || '',
    asset.content || '',
    asset.serviceLine || '',
    asset.targetIndustries || '',
    asset.targetRoles || '',
    asset.problems || '',
    asset.evidence || '',
  ].join(' ');
}