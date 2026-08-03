/**
 * Hybrid Retrieval Engine — WI-16F
 * ====================================
 *
 * Enterprise-grade retrieval system replacing the single-signal cosine similarity
 * search with a multi-signal hybrid approach. This is the FOUNDATION of AI
 * correctness — better retrieval = better evidence = better intelligence.
 *
 * BEFORE (single-signal):
 *   Query → Embedding → Cosine Similarity → Results
 *
 * AFTER (multi-signal hybrid):
 *   Query → Query Understanding
 *              |
 *              ↓
 *         Hybrid Retrieval Engine
 *              |
 *   ┌──────────┼──────────┬──────────┬──────────┐
 *   |          |          |          |          |
 * Vector    Keyword    Entity    Knowledge   Semantic
 * Search    Match      Extract    Graph       Field
 * (existing) (BM25)    (NER)      Traversal   Match
 *   |          |          |          |          |
 *   └──────────┴──────────┴──────────┴──────────┘
 *              |
 *              ↓
 *       Score Fusion (RRF)
 *              |
 *              ↓
 *       Re-ranking Engine
 *     (recency + source reliability + freshness + relevance)
 *              |
 *              ↓
 *       Evidence Package
 *              |
 *              ↓
 *       Governed AI Generation
 *
 * RETRIEVAL SIGNALS:
 *   1. Vector Search    — Semantic similarity via embeddings (existing)
 *   2. Keyword Search   — BM25-style term frequency / inverse document frequency
 *   3. Entity Matching  — Named entity recognition and exact/partial matching
 *   4. Knowledge Graph  — Relationship traversal (company → people → signals)
 *   5. Recency Weighting — Time-decay scoring favoring fresh intelligence
 *   6. Source Reliability — Premium/standard/low tier weighting
 *
 * SCORE FUSION: Reciprocal Rank Fusion (RRF)
 *   Combines multiple signal rankings into a single score.
 *   RRF(score) = Σ 1/(k + rank_i) for each signal i
 *   k=60 is the standard smoothing constant.
 *
 * RE-RANKING: Multi-factor scoring
 *   Final score = fused_similarity * recency_weight * source_weight * freshness_bonus
 *
 * NON-THROWING DESIGN: All functions return structured results, never throw.
 */

import { logger } from '@/lib/logger';
import { cosineSimilarity, tokenize, tokenizeWithBigrams } from '@/lib/embeddings';

// ── Types ────────────────────────────────────────────────────────────────────

/** Retrieval signal types. */
export type RetrievalSignal = 'vector' | 'keyword' | 'entity' | 'knowledge_graph' | 'recency' | 'source_reliability';

/** Source reliability tiers (from evidence-quality-framework). */
export type SourceTier = 'premium' | 'standard' | 'low' | 'unknown';

/** Entity types recognized by the entity matcher. */
export type EntityType = 'company' | 'person' | 'technology' | 'industry' | 'role' | 'location' | 'product' | 'financial' | 'event' | 'generic';

/** A single result from a retrieval signal. */
export interface SignalResult {
  /** Unique result identifier. */
  id: string;
  /** Entity/data ID. */
  entityId: string;
  /** Type of the entity. */
  entityType: string;
  /** The raw text content. */
  content: string;
  /** Short snippet for display. */
  snippet: string;
  /** Signal-specific score (0-1). */
  rawScore: number;
  /** Which signal produced this result. */
  signal: RetrievalSignal;
  /** Source of this result (if available). */
  source: string | null;
  /** Date of the source content (ISO string, if available). */
  sourceDate: string | null;
  /** Source reliability tier. */
  sourceTier: SourceTier;
  /** Entities found in this result. */
  entities: ExtractedEntity[];
  /** Metadata for signal-specific attributes. */
  metadata?: Record<string, unknown>;
}

/** A combined result after score fusion. */
export interface HybridResult {
  /** Unique result ID. */
  id: string;
  /** Entity/data ID. */
  entityId: string;
  /** Entity type. */
  entityType: string;
  /** Content text. */
  content: string;
  /** Display snippet. */
  snippet: string;
  /** Fused score from all signals (0-1). */
  fusedScore: number;
  /** Re-ranked final score (0-1). */
  finalScore: number;
  /** Per-signal breakdown. */
  signalScores: Record<RetrievalSignal, number>;
  /** Which signals contributed. */
  activeSignals: RetrievalSignal[];
  /** Source tier. */
  sourceTier: SourceTier;
  /** Source name. */
  source: string | null;
  /** Source date. */
  sourceDate: string | null;
  /** Entities found. */
  entities: ExtractedEntity[];
  /** Re-ranking explanation. */
  rerankExplanation: string;
}

/** An extracted named entity. */
export interface ExtractedEntity {
  text: string;
  type: EntityType;
  position: number;
  normalized: string;
}

/** Query understanding output. */
export interface QueryUnderstanding {
  /** Original query text. */
  original: string;
  /** Extracted entities from the query. */
  entities: ExtractedEntity[];
  /** Expanded query terms (synonyms, related terms). */
  expandedTerms: string[];
  /** Query intent classification. */
  intent: 'company_lookup' | 'contact_search' | 'signal_analysis' | 'capability_match' | 'opportunity_assessment' | 'general_knowledge';
  /** Key terms (after stop word removal). */
  keyTerms: string[];
  /** Bigrams from the query. */
  bigrams: string[];
  /** Query type classification. */
  queryType: 'factual' | 'analytical' | 'action' | 'comparison' | 'exploratory';
}

/** Evidence package — the final output of hybrid retrieval. */
export interface EvidencePackage {
  /** Package ID. */
  packageId: string;
  /** Query that was run. */
  query: string;
  /** Query understanding output. */
  queryUnderstanding: QueryUnderstanding;
  /** Number of signals that contributed. */
  activeSignalCount: number;
  /** Top results after re-ranking. */
  results: HybridResult[];
  /** Total items retrieved before filtering. */
  totalRetrieved: number;
  /** Retrieval latency in milliseconds. */
  latencyMs: number;
  /** Retrieval quality indicators. */
  quality: {
    /** Average confidence of returned results. */
    averageConfidence: number;
    /** Number of results from premium sources. */
    premiumSourceCount: number;
    /** Average recency score. */
    averageRecencyScore: number;
    /** Whether results cover multiple signals (diversity). */
    signalDiversity: number;
  };
  /** Timestamp. */
  timestamp: string;
}

/** Input for the hybrid retrieval search. */
export interface HybridSearchInput {
  /** The user query. */
  query: string;
  /** Maximum results to return. */
  topK?: number;
  /** Entity type filter (e.g. 'capability_asset'). */
  filterType?: string;
  /** Company ID for context-aware retrieval. */
  companyId?: string;
  /** Minimum relevance threshold (0-1). Results below this are discarded. */
  minRelevance?: number;
  /** Whether to include knowledge graph traversal. */
  includeKnowledgeGraph?: boolean;
  /** Weight configuration for signal fusion. */
  weights?: Partial<SignalWeights>;
  /** Context from research (company data, signals, etc.). */
  context?: {
    companyName?: string;
    industry?: string;
    technology?: string[];
    signals?: Array<{ type: string; description: string }>;
  };
}

/** Signal weight configuration for fusion. */
export interface SignalWeights {
  vector: number;
  keyword: number;
  entity: number;
  knowledge_graph: number;
  recency: number;
  source_reliability: number;
}

/** Index entry for the hybrid retrieval system. */
export interface HybridIndexEntry {
  id: string;
  entityId: string;
  entityType: string;
  content: string;
  snippet: string;
  vector: Float64Array | null;
  source: string | null;
  sourceDate: string | null;
  sourceTier: SourceTier;
  entities: ExtractedEntity[];
  /** TF representation for keyword search. */
  termFrequencies: Map<string, number>;
  /** Created/last updated timestamp. */
  indexedAt: number;
  /** Metadata. */
  metadata?: Record<string, unknown>;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Default signal weights for RRF fusion. */
const DEFAULT_WEIGHTS: SignalWeights = {
  vector: 1.0,
  keyword: 0.8,
  entity: 0.6,
  knowledge_graph: 0.7,
  recency: 0.5,
  source_reliability: 0.4,
};

/** RRF smoothing constant. */
const RRF_K = 60;

/** Source tier reliability scores. */
const SOURCE_TIER_SCORES: Record<SourceTier, number> = {
  premium: 1.0,
  standard: 0.7,
  low: 0.4,
  unknown: 0.5,
};

/** Premium source domains. */
const PREMIUM_SOURCES = new Set([
  'bloomberg.com', 'reuters.com', 'wsj.com', 'ft.com', 'sec.gov',
  'crunchbase.com', 'pitchbook.com', 'privco.com', 'linkedin.com',
  'techcrunch.com', 'wired.com', 'arxiv.org', 'nature.com', 'ieee.org',
  'reuters', 'bloomberg', 'wsj', 'crunchbase', 'pitchbook',
]);

/** Standard source domains. */
const STANDARD_SOURCES = new Set([
  'company website', 'linkedin', 'press release', 'conference report',
  'industry report', 'annual report', 'company blog', 'medium.com',
]);

/** Recency half-life in days. Intelligence older than this decays. */
const RECENCY_HALF_LIFE_DAYS = 90;

/** Maximum index size for in-memory storage. */
const MAX_HYBRID_INDEX_SIZE = 100_000;

// ── Named Entity Recognition Patterns ──────────────────────────────────────

const ENTITY_PATTERNS: Array<{ type: EntityType; pattern: RegExp; description: string }> = [
  // Financial patterns
  { type: 'financial', pattern: /\$[\d,.]+[BMK]?(?:\s*(?:million|billion|thousand))?/gi, description: 'Dollar amounts' },
  { type: 'financial', pattern: /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:employees?|people|staff|headcount)\b/gi, description: 'Employee counts' },
  { type: 'financial', pattern: /\b\d{1,3}(?:\.\d+)?\s*%\b/g, description: 'Percentages' },
  { type: 'financial', pattern: /\b(?:Series\s+[A-Z]|Seed|Pre-Seed|IPO|VC|ARR|MRR)\b/gi, description: 'Funding terms' },
  // Technology patterns
  { type: 'technology', pattern: /\b(?:AWS|Azure|GCP|Google Cloud|Oracle Cloud|Kubernetes|Docker|React|Python|Java|Node\.js|Go|Rust|TypeScript|GraphQL|Terraform|Kafka|Redis|PostgreSQL|MongoDB|Snowflake|Databricks|Spark)\b/g, description: 'Technology names' },
  { type: 'technology', pattern: /\b(?:cloud computing|cloud infrastructure|cloud platform|cloud services|cloud migration|cloud security|cloud native)\b/gi, description: 'Cloud terms' },
  { type: 'technology', pattern: /\b(?:AI|ML|machine learning|deep learning|NLP|computer vision|LLM|GPT|transformer|neural network)\b/gi, description: 'AI/ML terms' },
  // Role patterns
  { type: 'role', pattern: /\b(?:CEO|CTO|CIO|CFO|CMO|COO|VP|SVP|EVP|Director|Head|Chief|Lead|Senior|Staff|Principal|Manager|Architect)\b/gi, description: 'Job titles' },
  // Location patterns
  { type: 'location', pattern: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\b/g, description: 'US city, state' },
  { type: 'location', pattern: /\b(?:San Francisco|New York|London|Berlin|Tokyo|Singapore|Sydney|Toronto|Austin|Seattle|Boston|Chicago|Denver|Atlanta|Miami|Los Angeles|Palo Alto|Cambridge)\b/g, description: 'Known cities' },
  // Industry patterns
  { type: 'industry', pattern: /\b(?:Healthcare|FinTech|SaaS|B2B|B2C|EdTech|PropTech|InsurTech|HRTech|MarTech|Retail|Manufacturing|Logistics|Energy|Automotive|Aerospace|Defense|Media|Telecom|Pharmaceutical|Biotech|Semiconductor|Cloud|Security|Cybersecurity|IoT|Blockchain|Quantum|Robotics)\b/g, description: 'Industries' },
  // Event patterns
  { type: 'event', pattern: /\b(?:acquired|merged|launched|announced|hired|fired|laid off|raised|funded|went public|IPO|downsized|expanded|opened|closed|migrated|deployed|implemented|released)\b/gi, description: 'Business events' },
];

// ── In-Memory Hybrid Index ──────────────────────────────────────────────────

const hybridIndex = new Map<string, HybridIndexEntry>();
const indexTimestamps = new Map<string, number>();
let hybridIndexLoaded = false;

/** In-memory IDF for keyword search. */
const documentFrequency = new Map<string, number>();
let totalDocuments = 0;

// ── Utility Functions ─────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Classify source tier from a source string. */
export function classifySourceTier(source: string | null): SourceTier {
  if (!source) return 'unknown';
  const lower = source.toLowerCase();

  for (const premium of PREMIUM_SOURCES) {
    if (lower.includes(premium)) return 'premium';
  }
  for (const standard of STANDARD_SOURCES) {
    if (lower.includes(standard)) return 'standard';
  }
  return 'low';
}

/** Calculate recency score based on date. 1.0 = today, decays over time. */
export function calculateRecencyScore(dateStr: string | null, referenceDate: Date = new Date()): number {
  if (!dateStr) return 0.5; // No date → neutral score

  try {
    const sourceDate = new Date(dateStr);
    if (isNaN(sourceDate.getTime())) return 0.5;

    const daysDiff = (referenceDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 0) return 1.0; // Future date → fresh

    // Exponential decay with half-life
    const score = Math.pow(0.5, daysDiff / RECENCY_HALF_LIFE_DAYS);
    return Math.max(0, Math.min(1, score));
  } catch {
    return 0.5;
  }
}

/** Evict oldest entries when index exceeds max size. */
function evictOldestIfNeeded(): void {
  while (hybridIndex.size >= MAX_HYBRID_INDEX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, ts] of indexTimestamps) {
      if (ts < oldestTime) {
        oldestTime = ts;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      hybridIndex.delete(oldestKey);
      indexTimestamps.delete(oldestKey);
    }
  }
}

/** Compute term frequencies for a document. */
function computeTermFrequencies(text: string): Map<string, number> {
  const tokens = tokenizeWithBigrams(text);
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

// ── Query Understanding ─────────────────────────────────────────────────────

/**
 * Analyze the user query to extract entities, intent, key terms, and expansions.
 * This is the first step before multi-signal retrieval.
 */
export function understandQuery(query: string): QueryUnderstanding {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // 1. Extract entities from query
  const entities = extractEntities(trimmed);

  // 2. Extract key terms
  const keyTerms = tokenize(trimmed);

  // 3. Generate bigrams
  const bigrams = tokenizeWithBigrams(trimmed).filter(t => t.includes('_'));

  // 4. Generate expanded terms (synonyms, related terms)
  const expandedTerms = generateExpandedTerms(keyTerms, entities);

  // 5. Classify intent
  const intent = classifyIntent(lower, entities);

  // 6. Classify query type
  const queryType = classifyQueryType(lower);

  return {
    original: trimmed,
    entities,
    expandedTerms,
    intent,
    keyTerms,
    bigrams,
    queryType,
  };
}

/**
 * Extract named entities from text using pattern matching.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const { type, pattern } of ENTITY_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const normalized = match[0].trim().toLowerCase();
      const key = `${normalized}:${type}:${match.index}`;
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({
          text: match[0],
          type,
          position: match.index,
          normalized,
        });
      }
    }
  }

  // Also extract capitalized multi-word terms as potential company/person names
  const capitalPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  capitalPattern.lastIndex = 0;
  let capMatch;
  const genericTerms = new Set(['The', 'This', 'That', 'These', 'Those', 'Based', 'Using', 'With', 'For', 'From', 'About']);
  while ((capMatch = capitalPattern.exec(text)) !== null) {
    const term = capMatch[0];
    const words = term.split(/\s+/);
    if (!words.some(w => genericTerms.has(w))) {
      const key = `${term.toLowerCase()}:generic:${capMatch.index}`;
      if (!seen.has(key) && term.length > 4) {
        seen.add(key);
        // Determine if likely a company or person
        const likelyCompany = words.length <= 3 && !['the', 'a', 'an'].includes(words[0]?.toLowerCase());
        entities.push({
          text: term,
          type: likelyCompany ? 'company' : 'generic',
          position: capMatch.index,
          normalized: term.toLowerCase(),
        });
      }
    }
  }

  return entities;
}

/**
 * Generate expanded query terms from key terms and entities.
 */
function generateExpandedTerms(keyTerms: string[], entities: ExtractedEntity[]): string[] {
  const expanded: string[] = [];

  // Add entity-based expansions
  for (const entity of entities) {
    if (entity.type === 'technology') {
      // Add common abbreviations and related terms
      const techMap: Record<string, string[]> = {
        'aws': ['amazon web services', 'cloud computing'],
        'gcp': ['google cloud platform', 'cloud'],
        'azure': ['microsoft cloud', 'cloud services'],
        'kubernetes': ['k8s', 'container orchestration', 'containers'],
        'docker': ['containerization', 'containers'],
        'ai': ['artificial intelligence', 'machine learning'],
        'ml': ['machine learning', 'deep learning'],
      };
      const norm = entity.normalized.toLowerCase();
      if (techMap[norm]) {
        expanded.push(...techMap[norm]);
      }
    }

    if (entity.type === 'industry') {
      const industryMap: Record<string, string[]> = {
        'fintech': ['financial technology', 'financial services technology'],
        'saas': ['software as a service', 'cloud software', 'subscription software'],
        'b2b': ['business to business', 'enterprise'],
        'cybersecurity': ['security', 'information security', 'infosec'],
      };
      const norm = entity.normalized.toLowerCase();
      if (industryMap[norm]) {
        expanded.push(...industryMap[norm]);
      }
    }
  }

  // Add bigram expansions
  for (const term of keyTerms) {
    expanded.push(term);
  }

  return [...new Set(expanded)].filter(t => t.length > 2);
}

/**
 * Classify the user's intent from the query.
 */
function classifyIntent(lowerQuery: string, entities: ExtractedEntity[]): QueryUnderstanding['intent'] {
  const hasCompany = entities.some(e => e.type === 'company');
  const hasPerson = entities.some(e => e.type === 'person' || e.type === 'role');
  const hasTechnology = entities.some(e => e.type === 'technology');
  const hasFinancial = entities.some(e => e.type === 'financial');

  if (hasCompany && hasFinancial) return 'opportunity_assessment';
  if (hasCompany && hasTechnology) return 'company_lookup';
  if (hasCompany && hasPerson) return 'contact_search';
  if (hasTechnology && hasPerson) return 'capability_match';
  if (lowerQuery.includes('signal') || lowerQuery.includes('trigger') || lowerQuery.includes('indicator')) return 'signal_analysis';
  return 'general_knowledge';
}

/**
 * Classify the query type.
 */
function classifyQueryType(lowerQuery: string): QueryUnderstanding['queryType'] {
  if (lowerQuery.startsWith('what') || lowerQuery.startsWith('who') || lowerQuery.startsWith('where')) return 'factual';
  if (lowerQuery.startsWith('how') || lowerQuery.startsWith('why') || lowerQuery.startsWith('analyze')) return 'analytical';
  if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest') || lowerQuery.includes('should')) return 'action';
  if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) return 'comparison';
  return 'exploratory';
}

// ── Signal Retrieval Functions ──────────────────────────────────────────────

/**
 * Signal 1: Vector Search (semantic similarity)
 * Uses the existing embedding infrastructure.
 */
function vectorSearch(
  query: string,
  entries: HybridIndexEntry[],
  topK: number,
): SignalResult[] {
  if (entries.length === 0) return [];

  // Use TF-IDF embedding for query (same as existing fallback)
  const queryVec = tfidfEmbedForSearch(query);

  const scored: Array<{ entry: HybridIndexEntry; score: number }> = [];

  for (const entry of entries) {
    if (!entry.vector) continue;

    const score = cosineSimilarity(
      Array.from(queryVec) as unknown as Float64Array,
      entry.vector,
    );

    if (score > 0.05) {
      scored.push({ entry, score: Math.max(0, Math.min(1, score)) });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK * 2).map(({ entry, score }) => ({
    id: entry.id,
    entityId: entry.entityId,
    entityType: entry.entityType,
    content: entry.content,
    snippet: entry.snippet,
    rawScore: score,
    signal: 'vector',
    source: entry.source,
    sourceDate: entry.sourceDate,
    sourceTier: entry.sourceTier,
    entities: entry.entities,
  }));
}

/**
 * TF-IDF embedding for vector search (same approach as existing RetrievalEngine fallback).
 */
function tfidfEmbedForSearch(text: string): Float64Array {
  const EMBEDDING_DIM = 384;
  const vec = new Float64Array(EMBEDDING_DIM);
  const tokens = text.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (h << 5) - h + token.charCodeAt(i);
      h |= 0;
    }
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vec[idx] += 1;
  }
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

/**
 * Signal 2: Keyword Search (BM25-style)
 * Term frequency / inverse document frequency scoring.
 */
function keywordSearch(
  queryUnderstanding: QueryUnderstanding,
  entries: HybridIndexEntry[],
  topK: number,
): SignalResult[] {
  if (entries.length === 0 || totalDocuments === 0) return [];

  const queryTerms = [
    ...queryUnderstanding.keyTerms,
    ...queryUnderstanding.bigrams,
    ...queryUnderstanding.expandedTerms,
  ];

  const scored: Array<{ entry: HybridIndexEntry; score: number }> = [];

  for (const entry of entries) {
    let bm25Score = 0;

    for (const term of queryTerms) {
      const tf = entry.termFrequencies.get(term) || 0;
      if (tf === 0) continue;

      const df = documentFrequency.get(term) || 0;
      const idf = Math.log((totalDocuments - df + 0.5) / (df + 0.5) + 1);

      // BM25 TF normalization (k1=1.2, b=0.75)
      const k1 = 1.2;
      const b = 0.75;
      const docLen = entry.content.length;
      const avgDocLen = 200; // approximate average document length
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen));

      bm25Score += idf * tfNorm;
    }

    if (bm25Score > 0.1) {
      scored.push({ entry, score: Math.min(1, bm25Score / 10) }); // Normalize to 0-1
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK * 2).map(({ entry, score }) => ({
    id: entry.id,
    entityId: entry.entityId,
    entityType: entry.entityType,
    content: entry.content,
    snippet: entry.snippet,
    rawScore: score,
    signal: 'keyword',
    source: entry.source,
    sourceDate: entry.sourceDate,
    sourceTier: entry.sourceTier,
    entities: entry.entities,
  }));
}

/**
 * Signal 3: Entity Matching
 * Exact and partial entity matching between query and indexed content.
 */
function entitySearch(
  queryUnderstanding: QueryUnderstanding,
  entries: HybridIndexEntry[],
  topK: number,
): SignalResult[] {
  const queryEntities = queryUnderstanding.entities;
  if (queryEntities.length === 0) return [];

  const scored: Array<{ entry: HybridIndexEntry; score: number }> = [];

  for (const entry of entries) {
    let matchScore = 0;
    let matchedTypes = new Set<EntityType>();

    for (const qEntity of queryEntities) {
      for (const eEntity of entry.entities) {
        if (eEntity.type === qEntity.type || qEntity.type === 'generic' || eEntity.type === 'generic') {
          // Exact match
          if (eEntity.normalized === qEntity.normalized) {
            matchScore += 1.0;
            matchedTypes.add(eEntity.type);
          }
          // Partial match (one contains the other)
          else if (eEntity.normalized.includes(qEntity.normalized) || qEntity.normalized.includes(eEntity.normalized)) {
            matchScore += 0.5;
            matchedTypes.add(eEntity.type);
          }
          // Type-only match (same entity type, different value)
          else if (eEntity.type === qEntity.type) {
            matchScore += 0.2;
            matchedTypes.add(eEntity.type);
          }
        }
      }

      // Also check if query entity appears in the content text
      if (entry.content.toLowerCase().includes(qEntity.normalized)) {
        matchScore += 0.3;
      }
    }

    if (matchScore > 0) {
      // Normalize by number of query entities
      const normalizedScore = Math.min(1, matchScore / Math.max(queryEntities.length, 1));
      scored.push({ entry, score: normalizedScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK * 2).map(({ entry, score }) => ({
    id: entry.id,
    entityId: entry.entityId,
    entityType: entry.entityType,
    content: entry.content,
    snippet: entry.snippet,
    rawScore: score,
    signal: 'entity',
    source: entry.source,
    sourceDate: entry.sourceDate,
    sourceTier: entry.sourceTier,
    entities: entry.entities,
  }));
}

/**
 * Signal 4: Knowledge Graph Traversal
 * Explores entity relationships to find related content.
 *
 * For a company query, this finds:
 *   company → signals → related companies
 *   company → people → their companies
 *   company → technology → other companies using same tech
 *
 * Currently operates on the in-memory index; future integration with
 * a persistent knowledge graph (WI-16G) will enhance this.
 */
function knowledgeGraphSearch(
  queryUnderstanding: QueryUnderstanding,
  entries: HybridIndexEntry[],
  topK: number,
): SignalResult[] {
  const queryEntities = queryUnderstanding.entities;
  const results: SignalResult[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.entityId)) continue;

    // Find entries that share entities with the query
    let relationshipScore = 0;

    for (const qEntity of queryEntities) {
      for (const eEntity of entry.entities) {
        // Same entity type creates a knowledge graph edge
        if (eEntity.type === qEntity.type) {
          relationshipScore += 0.3;

          // Different entity value but same type = related node
          if (eEntity.normalized !== qEntity.normalized) {
            relationshipScore += 0.5;
          }
        }

        // Cross-type relationships (company → technology, person → company)
        const crossTypeEdges: Array<[EntityType, EntityType]> = [
          ['company', 'technology'],
          ['company', 'industry'],
          ['company', 'person'],
          ['technology', 'industry'],
          ['person', 'role'],
          ['company', 'financial'],
        ];
        for (const [t1, t2] of crossTypeEdges) {
          if ((eEntity.type === t1 && qEntity.type === t2) || (eEntity.type === t2 && qEntity.type === t1)) {
            relationshipScore += 0.4;
          }
        }
      }
    }

    if (relationshipScore > 0.5) {
      seen.add(entry.entityId);
      results.push({
        id: entry.id,
        entityId: entry.entityId,
        entityType: entry.entityType,
        content: entry.content,
        snippet: entry.snippet,
        rawScore: Math.min(1, relationshipScore / 3),
        signal: 'knowledge_graph',
        source: entry.source,
        sourceDate: entry.sourceDate,
        sourceTier: entry.sourceTier,
        entities: entry.entities,
        metadata: { relationshipScore: Math.round(relationshipScore * 100) / 100 },
      });
    }
  }

  results.sort((a, b) => b.rawScore - a.rawScore);
  return results.slice(0, topK);
}

/**
 * Signal 5 & 6: Recency and Source Reliability Weighting
 * These don't produce new results but modify existing scores.
 */
function applyRecencyAndSourceWeights(
  results: SignalResult[],
): void {
  const now = new Date();

  for (const result of results) {
    // Recency weighting
    const recencyScore = calculateRecencyScore(result.sourceDate, now);
    result.rawScore = result.rawScore * (0.7 + 0.3 * recencyScore);

    // Source reliability weighting
    const sourceWeight = SOURCE_TIER_SCORES[result.sourceTier] || 0.5;
    result.rawScore = result.rawScore * (0.8 + 0.2 * sourceWeight);
  }
}

// ── Score Fusion (Reciprocal Rank Fusion) ─────────────────────────────────

/**
 * Combine results from multiple signals using Reciprocal Rank Fusion.
 *
 * RRF Formula: score(d) = Σ (weight_i / (k + rank_i(d)))
 *
 * Where k=60 (smoothing constant), rank_i(d) is the rank of document d
 * in signal i, and weight_i is the weight for signal i.
 */
function fuseScores(
  signalResults: Map<RetrievalSignal, SignalResult[]>,
  weights: SignalWeights,
): Map<string, { fusedScore: number; signalScores: Record<string, number>; activeSignals: RetrievalSignal[] }> {
  const fusedMap = new Map<string, { fusedScore: number; signalScores: Record<string, number>; activeSignals: RetrievalSignal[] }>();

  for (const [signal, results] of signalResults) {
    const weight = weights[signal] || 0.5;

    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = weight / (RRF_K + rank + 1);

      const existing = fusedMap.get(result.id);
      if (existing) {
        existing.fusedScore += rrfScore;
        existing.signalScores[signal] = result.rawScore;
        if (!existing.activeSignals.includes(signal)) {
          existing.activeSignals.push(signal);
        }
      } else {
        fusedMap.set(result.id, {
          fusedScore: rrfScore,
          signalScores: { [signal]: result.rawScore },
          activeSignals: [signal],
        });
      }
    }
  }

  return fusedMap;
}

// ── Re-ranking Engine ────────────────────────────────────────────────────

/**
 * Re-rank fused results using multi-factor scoring.
 *
 * Final score = fused_score * recency_bonus * source_bonus * diversity_bonus
 */
function rerank(
  fusedResults: Map<string, { fusedScore: number; signalScores: Record<string, number>; activeSignals: RetrievalSignal[] }>,
  allSignalResults: SignalResult[],
): HybridResult[] {
  const now = new Date();
  const results: HybridResult[] = [];

  // Build a lookup for original signal results
  const resultLookup = new Map<string, SignalResult>();
  for (const sr of allSignalResults) {
    if (!resultLookup.has(sr.id)) {
      resultLookup.set(sr.id, sr);
    }
  }

  // Normalize fused scores to 0-1
  let maxFused = 0;
  for (const { fusedScore } of fusedResults.values()) {
    if (fusedScore > maxFused) maxFused = fusedScore;
  }

  for (const [id, fused] of fusedResults.entries()) {
    const original = resultLookup.get(id);
    if (!original) continue;

    // Normalize fused score
    const normalizedFused = maxFused > 0 ? fused.fusedScore / maxFused : 0;

    // Recency bonus
    const recencyScore = calculateRecencyScore(original.sourceDate, now);
    const recencyBonus = 0.7 + 0.3 * recencyScore;

    // Source reliability bonus
    const sourceBonus = 0.85 + 0.15 * (SOURCE_TIER_SCORES[original.sourceTier] || 0.5);

    // Signal diversity bonus (more signals = better)
    const diversityBonus = 0.8 + 0.2 * Math.min(fused.activeSignals.length / 4, 1);

    // Final score
    const finalScore = Math.max(0, Math.min(1, normalizedFused * recencyBonus * sourceBonus * diversityBonus));

    // Build re-ranking explanation
    const explanations: string[] = [];
    if (recencyScore < 0.3) explanations.push('older source');
    if (original.sourceTier === 'premium') explanations.push('premium source');
    if (fused.activeSignals.length >= 3) explanations.push(`${fused.activeSignals.length}-signal match`);

    results.push({
      id,
      entityId: original.entityId,
      entityType: original.entityType,
      content: original.content,
      snippet: original.snippet,
      fusedScore: Math.round(normalizedFused * 1000) / 1000,
      finalScore: Math.round(finalScore * 1000) / 1000,
      signalScores: fused.signalScores as Record<RetrievalSignal, number>,
      activeSignals: fused.activeSignals,
      sourceTier: original.sourceTier,
      source: original.source,
      sourceDate: original.sourceDate,
      entities: original.entities,
      rerankExplanation: explanations.length > 0 ? explanations.join(', ') : 'standard match',
    });
  }

  results.sort((a, b) => b.finalScore - a.finalScore);
  return results;
}

// ── Index Management ───────────────────────────────────────────────────────

/**
 * Add an entry to the hybrid retrieval index.
 */
export function addToIndex(entry: Omit<HybridIndexEntry, 'termFrequencies' | 'indexedAt' | 'entities'>): void {
  const termFreqs = computeTermFrequencies(entry.content);
  const entities = extractEntities(entry.content);

  // Update document frequency counts
  for (const [term] of termFreqs) {
    documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  }
  totalDocuments++;

  const indexEntry: HybridIndexEntry = {
    ...entry,
    entities,
    termFrequencies: termFreqs,
    indexedAt: Date.now(),
  };

  evictOldestIfNeeded();
  hybridIndex.set(entry.id, indexEntry);
  indexTimestamps.set(entry.id, Date.now());
}

/**
 * Remove an entry from the hybrid retrieval index.
 */
export function removeFromIndex(id: string): boolean {
  const entry = hybridIndex.get(id);
  if (!entry) return false;

  // Update document frequency counts
  for (const [term] of entry.termFrequencies) {
    const current = documentFrequency.get(term) || 0;
    if (current <= 1) {
      documentFrequency.delete(term);
    } else {
      documentFrequency.set(term, current - 1);
    }
  }
  totalDocuments = Math.max(0, totalDocuments - 1);

  hybridIndex.delete(id);
  indexTimestamps.delete(id);
  return true;
}

/**
 * Get all entries from the hybrid index.
 */
export function getIndexEntries(): HybridIndexEntry[] {
  return Array.from(hybridIndex.values());
}

/**
 * Get hybrid index statistics.
 */
export function getHybridStats(): {
  totalEntries: number;
  totalDocuments: number;
  vocabularySize: number;
  byEntityType: Record<string, number>;
  bySourceTier: Record<string, number>;
  byEntityExtracted: Record<string, number>;
} {
  const byEntityType: Record<string, number> = {};
  const bySourceTier: Record<string, number> = {};
  const byEntityExtracted: Record<string, number> = {};

  for (const entry of hybridIndex.values()) {
    byEntityType[entry.entityType] = (byEntityType[entry.entityType] || 0) + 1;
    bySourceTier[entry.sourceTier] = (bySourceTier[entry.sourceTier] || 0) + 1;
    for (const entity of entry.entities) {
      byEntityExtracted[entity.type] = (byEntityExtracted[entity.type] || 0) + 1;
    }
  }

  return {
    totalEntries: hybridIndex.size,
    totalDocuments,
    vocabularySize: documentFrequency.size,
    byEntityType,
    bySourceTier,
    byEntityExtracted,
  };
}

/**
 * Clear the hybrid index.
 */
export function clearHybridIndex(): void {
  hybridIndex.clear();
  indexTimestamps.clear();
  documentFrequency.clear();
  totalDocuments = 0;
  hybridIndexLoaded = false;
}

// ── Main Hybrid Search ───────────────────────────────────────────────────

/**
 * Execute hybrid retrieval search across all signals.
 *
 * This is the primary entry point for the Hybrid Retrieval Engine.
 * It replaces the single-signal search with multi-signal fusion + re-ranking.
 */
export function hybridSearch(input: HybridSearchInput): EvidencePackage {
  const startTime = Date.now();
  const packageId = generateId('pkg');

  // Step 1: Query Understanding
  const queryUnderstanding = understandQuery(input.query);

  // Step 2: Get all index entries (with optional type filter)
  let entries = Array.from(hybridIndex.values());
  if (input.filterType) {
    entries = entries.filter(e => e.entityType === input.filterType);
  }

  // Step 3: Run retrieval signals in parallel (conceptually)
  const topK = input.topK || 10;
  const signalResults = new Map<RetrievalSignal, SignalResult[]>();

  // Signal 1: Vector Search
  const vectorResults = vectorSearch(input.query, entries, topK);
  signalResults.set('vector', vectorResults);

  // Signal 2: Keyword Search
  const keywordResults = keywordSearch(queryUnderstanding, entries, topK);
  signalResults.set('keyword', keywordResults);

  // Signal 3: Entity Matching
  const entityResults = entitySearch(queryUnderstanding, entries, topK);
  signalResults.set('entity', entityResults);

  // Signal 4: Knowledge Graph
  if (input.includeKnowledgeGraph !== false) {
    const kgResults = knowledgeGraphSearch(queryUnderstanding, entries, topK);
    signalResults.set('knowledge_graph', kgResults);
  }

  // Combine all signal results for recency/source weighting
  const allResults = [...vectorResults, ...keywordResults, ...entityResults, ...(signalResults.get('knowledge_graph') || [])];
  applyRecencyAndSourceWeights(allResults);

  // Re-split weighted results back into signals for fusion
  const weightedSignalResults = new Map<RetrievalSignal, SignalResult[]>();
  weightedSignalResults.set('vector', vectorResults);
  weightedSignalResults.set('keyword', keywordResults);
  weightedSignalResults.set('entity', entityResults);
  if (signalResults.has('knowledge_graph')) {
    weightedSignalResults.set('knowledge_graph', signalResults.get('knowledge_graph')!);
  }

  // Step 4: Score Fusion (RRF)
  const weights: SignalWeights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const fusedResults = fuseScores(weightedSignalResults, weights);

  // Step 5: Re-ranking
  const reranked = rerank(fusedResults, allResults);

  // Step 6: Apply minimum relevance filter
  const minRelevance = input.minRelevance ?? 0.1;
  const filtered = reranked.filter(r => r.finalScore >= minRelevance).slice(0, topK);

  // Step 7: Build quality indicators
  const avgConfidence = filtered.length > 0
    ? filtered.reduce((a, r) => a + r.finalScore, 0) / filtered.length
    : 0;
  const premiumCount = filtered.filter(r => r.sourceTier === 'premium').length;
  const avgRecency = filtered.length > 0
    ? filtered.reduce((a, r) => a + calculateRecencyScore(r.sourceDate), 0) / filtered.length
    : 0;
  const uniqueSignals = new Set(filtered.flatMap(r => r.activeSignals));

  const latencyMs = Date.now() - startTime;

  const result: EvidencePackage = {
    packageId,
    query: input.query,
    queryUnderstanding,
    activeSignalCount: uniqueSignals.size,
    results: filtered,
    totalRetrieved: entries.length,
    latencyMs,
    quality: {
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      premiumSourceCount: premiumCount,
      averageRecencyScore: Math.round(avgRecency * 1000) / 1000,
      signalDiversity: uniqueSignals.size / 4, // Normalize by max 4 signals
    },
    timestamp: new Date().toISOString(),
  };

  logger.info('Hybrid retrieval completed', {
    packageId,
    query: input.query.slice(0, 100),
    intent: queryUnderstanding.intent,
    resultCount: filtered.length,
    activeSignals: [...uniqueSignals],
    avgConfidence: result.quality.averageConfidence,
    latencyMs,
  });

  return result;
}

// ── Convenience: Quick Search ──────────────────────────────────────────────

/**
 * Quick hybrid search with sensible defaults.
 * Drop-in replacement for RetrievalEngine.search().
 */
export function quickSearch(
  query: string,
  topK = 5,
  filterType?: string,
): HybridResult[] {
  const pkg = hybridSearch({
    query,
    topK,
    filterType,
  });
  return pkg.results;
}
