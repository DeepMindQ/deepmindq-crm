/**
 * AI Revenue Copilot — Evidence Synthesizer
 *
 * Clusters raw intelligence points into thematic groups, ranks them by
 * strength and recency, and selects the most relevant evidence for LLM
 * grounding. This pre-processing step reduces noise and ensures the LLM
 * receives focused, high-quality input.
 *
 * Algorithm:
 * 1. Group knowledge entries by category → base clusters.
 * 2. Extract sub-themes within each category using keyword overlap.
 * 3. Compute strength (volume × avg confidence) and recency (time decay).
 * 4. Rank by combined score and select top evidence with deduplication.
 */

import type { ReasoningContext, ThematicCluster } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Half-life in milliseconds for recency decay (90 days). */
const RECENCY_HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000;

/** Stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'that',
  'this', 'these', 'those', 'it', 'its', 'they', 'their', 'them', 'we',
  'our', 'us', 'he', 'she', 'him', 'her', 'his', 'you', 'your', 'not',
  'no', 'nor', 'if', 'then', 'than', 'so', 'as', 'up', 'out', 'about',
  'into', 'over', 'after', 'all', 'also', 'just', 'very', 'often', 'most',
  'more', 'some', 'any', 'each', 'every', 'both', 'few', 'many', 'such',
  'only', 'own', 'same', 'how', 'which', 'who', 'whom', 'what', 'when',
  'where', 'why', 'while', 'during', 'through', 'before', 'between',
  'under', 'again', 'further', 'once', 'here', 'there', 'above', 'below',
  'because', 'since', 'until', 'other', 'new', 'per', 'via', 'etc',
]);

/** Minimum keyword length to consider. */
const MIN_KEYWORD_LENGTH = 3;

/** Maximum keywords extracted per entry for matching. */
const MAX_KEYWORDS_PER_ENTRY = 10;

// ═══════════════════════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tokenizes a content string into lowercase keywords, filtering stop words.
 */
function extractKeywords(content: string): string[] {
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w));

  // Count frequency and return top keywords
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_KEYWORDS_PER_ENTRY)
    .map(([word]) => word);
}

/**
 * Computes Jaccard similarity between two keyword sets.
 */
function keywordSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  const setAValues = Array.from(setA);
  for (let i = 0; i < setAValues.length; i++) {
    if (setB.has(setAValues[i])) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes recency score (0-100) based on time since updatedAt.
 * Uses exponential decay with a 90-day half-life.
 */
function computeRecencyScore(updatedAt: Date, now: Date = new Date()): number {
  const ageMs = now.getTime() - updatedAt.getTime();
  if (ageMs <= 0) return 100;
  const decay = Math.pow(0.5, ageMs / RECENCY_HALF_LIFE_MS);
  return Math.round(decay * 100);
}

/**
 * Computes strength score (0-100) based on entry volume and avg confidence.
 */
function computeStrength(entries: ThematicCluster['entries']): number {
  if (entries.length === 0) return 0;

  const avgConfidence =
    entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length;

  // Volume factor: logarithmic scaling so more entries add diminishing value
  const volumeFactor = Math.min(Math.log2(entries.length + 1) / Math.log2(11), 1); // cap at 10 entries = 1.0

  return Math.round(volumeFactor * avgConfidence * 100);
}

/**
 * Simple substring-based deduplication check.
 * Returns true if contentB is a near-duplicate of contentA.
 */
function isNearDuplicate(contentA: string, contentB: string, threshold: number = 0.8): boolean {
  if (contentA === contentB) return true;

  // Normalize for comparison
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s+/g, ' ').trim();

  const normA = normalize(contentA);
  const normB = normalize(contentB);

  // Substring check: if one is mostly contained in the other
  const shorter = normA.length <= normB.length ? normA : normB;
  const longer = normA.length > normB.length ? normA : normB;

  if (longer.includes(shorter) && shorter.length > 20) {
    return (shorter.length / longer.length) >= threshold;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clusters knowledge entries by category, then sub-groups by keyword similarity
 * to find thematic sub-clusters within each category.
 *
 * Returns clusters sorted by strength (descending).
 */
export function clusterByTheme(
  entries: Array<{
    id: string;
    category: string;
    content: string;
    source: string | null;
    confidence: number;
    updatedAt: Date;
  }>
): ThematicCluster[] {
  if (entries.length === 0) return [];

  // Step 1: Group by category
  const byCategory = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = byCategory.get(entry.category) ?? [];
    group.push(entry);
    byCategory.set(entry.category, group);
  }

  // Step 2: Sub-cluster by keyword similarity within each category
  const clusters: ThematicCluster[] = [];
  const categoryList = Array.from(byCategory.entries());

  for (const [category, categoryEntries] of categoryList) {
    // Extract keywords for each entry
    const keywordMap = new Map<string, string[]>();
    for (const entry of categoryEntries) {
      keywordMap.set(entry.id, extractKeywords(entry.content));
    }

    // Simple agglomerative clustering: assign to existing cluster if similarity > 0.3
    const assigned = new Map<string, number>(); // entryId → clusterIndex
    const subClusterList: ThematicCluster['entries'][] = [];

    for (const entry of categoryEntries) {
      const keywords = keywordMap.get(entry.id) ?? [];
      let bestClusterIdx = -1;
      let bestSimilarity = 0.3; // minimum threshold

      for (let ci = 0; ci < subClusterList.length; ci++) {
        const cluster = subClusterList[ci];
        for (let ei = 0; ei < cluster.length; ei++) {
          const existing = cluster[ei];
          const existingKw = keywordMap.get(existing.id) ?? [];
          const sim = keywordSimilarity(keywords, existingKw);
          if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestClusterIdx = ci;
          }
        }
      }

      const newEntry = {
        id: entry.id,
        content: entry.content,
        source: entry.source ?? 'unknown',
        confidence: entry.confidence,
      };

      if (bestClusterIdx >= 0) {
        subClusterList[bestClusterIdx].push(newEntry);
        assigned.set(entry.id, bestClusterIdx);
      } else {
        // Create new sub-cluster
        const idx = subClusterList.length;
        subClusterList.push([newEntry]);
        assigned.set(entry.id, idx);
      }
    }

    // Build thematic clusters
    for (let si = 0; si < subClusterList.length; si++) {
      const subEntries = subClusterList[si];
      const now = new Date();
      let recencySum = 0;
      for (let ei = 0; ei < subEntries.length; ei++) {
        const e = subEntries[ei];
        // Find original entry for updatedAt
        let found = false;
        for (let ci = 0; ci < categoryEntries.length; ci++) {
          if (categoryEntries[ci].id === e.id) {
            recencySum += computeRecencyScore(categoryEntries[ci].updatedAt, now);
            found = true;
            break;
          }
        }
        if (!found) recencySum += 50;
      }
      const avgRecency = subEntries.length > 0 ? recencySum / subEntries.length : 50;

      // Generate theme name from the first entry's content or category
      let themeName = category;
      if (subEntries.length === 1) {
        // Single entry: use category + truncated content
        const contentPreview = subEntries[0].content.slice(0, 60);
        themeName = `${category}: ${contentPreview}`;
      } else {
        // Multiple entries: use category + top shared keyword
        const allKeywords: string[] = [];
        for (let ei = 0; ei < subEntries.length; ei++) {
          const kws = extractKeywords(subEntries[ei].content);
          for (let ki = 0; ki < kws.length; ki++) {
            allKeywords.push(kws[ki]);
          }
        }
        const kwFreq = new Map<string, number>();
        for (const kw of allKeywords) {
          kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
        }
        const topKw = Array.from(kwFreq.entries())
          .sort((a, b) => b[1] - a[1])
          .filter(entry => entry[1] > 1)
          .slice(0, 3)
          .map(entry => entry[0]);
        if (topKw.length > 0) {
          themeName = `${category}: ${topKw.join(', ')}`;
        }
      }

      clusters.push({
        theme: themeName,
        entries: subEntries,
        strength: computeStrength(subEntries),
        recency: Math.round(avgRecency),
      });
    }
  }

  // Sort by strength descending
  return clusters.sort((a, b) => b.strength - a.strength);
}

/**
 * Reranks clusters based on a combined score of strength × recency × confidence.
 *
 * This prioritizes clusters that are not only strong but also recent and
 * backed by high-confidence sources.
 */
export function rankClusters(clusters: ThematicCluster[]): ThematicCluster[] {
  return [...clusters].sort((a, b) => {
    const scoreA = a.strength * (a.recency / 100) * 0.5 + a.strength * 0.5;
    const scoreB = b.strength * (b.recency / 100) * 0.5 + b.strength * 0.5;
    return scoreB - scoreA;
  });
}

/**
 * Selects the top evidence items from signals, knowledge entries, and
 * intelligence objects. Deduplicates by content similarity (substring check).
 *
 * Priority:
 * 1. Evidence items (highest priority — structured, relevance-scored)
 * 2. Company signals (signal-detected, often high urgency)
 * 3. Opportunity signals (scored business relevance)
 * 4. Knowledge entries (structured knowledge fabric)
 */
export function selectTopEvidence(
  ctx: ReasoningContext,
  maxItems: number
): Array<{ id: string; snippet: string; relevance: string }> {
  const candidates: Array<{ id: string; snippet: string; relevance: string }> = [];

  // 1. Evidence items
  for (const ev of ctx.evidence) {
    const rel = ev.extractedField ?? 'general intelligence';
    candidates.push({
      id: ev.id,
      snippet: ev.snippet,
      relevance: `${rel} (relevance: ${Math.round(ev.relevanceScore * 100)}%, confidence: ${Math.round(ev.confidence * 100)}%)`,
    });
  }

  // 2. Company signals
  for (const sig of ctx.signals) {
    candidates.push({
      id: sig.id,
      snippet: sig.title,
      relevance: `${sig.signalType} signal (severity: ${sig.severity}, confidence: ${Math.round(sig.confidence * 100)}%)`,
    });
  }

  // 3. Opportunity signals
  for (const opp of ctx.opportunitySignals) {
    candidates.push({
      id: opp.id,
      snippet: opp.title,
      relevance: `${opp.signalType} opportunity (score: ${Math.round(opp.score)}, confidence: ${Math.round(opp.confidence * 100)}%)`,
    });
  }

  // 4. Knowledge entries (top by confidence)
  const sortedKnowledge = [...ctx.knowledgeEntries].sort(
    (a, b) => b.confidence - a.confidence
  );
  for (const entry of sortedKnowledge.slice(0, maxItems * 2)) {
    candidates.push({
      id: entry.id,
      snippet: entry.content,
      relevance: `${entry.category} knowledge (confidence: ${Math.round(entry.confidence * 100)}%, source: ${entry.source ?? 'unknown'})`,
    });
  }

  // Deduplicate by content similarity
  const selected: Array<{ id: string; snippet: string; relevance: string }> = [];
  for (const candidate of candidates) {
    if (selected.length >= maxItems) break;

    const isDuplicate = selected.some(
      existing => isNearDuplicate(existing.snippet, candidate.snippet, 0.8)
    );

    if (!isDuplicate) {
      selected.push(candidate);
    }
  }

  return selected;
}
