/**
 * Sprint 1 — Signal Taxonomy Normalization
 *
 * Problem: Old DB signals use legacy types (business, technology, external, relationship, mention, signal).
 * New engines (correlation, prediction, cross-account) operate on the 10-type taxonomy
 * (hiring, funding, tech_change, leadership_change, people_change, technology_adoption, partnership, expansion, acquisition, news).
 *
 * Solution: Bidirectional type mapping that operates at the signal level.
 * New types pass through unchanged. Legacy types are contextually mapped using
 * keyword analysis on the signal's title and description.
 *
 * Architecture principle:
 *   - This is a mapping LAYER, not a migration. Zero DB changes. Zero data loss.
 *   - Every downstream engine calls normalizeSignalType() before type comparison.
 *   - The mapping is deterministic and traceable — you can always ask "why was this signal mapped to X?"
 *
 * The mapping chain:
 *   1. Check if type is already a new taxonomy type → pass through
 *   2. Check direct legacy → new mapping table
 *   3. Fall back to contextual keyword analysis on title + description
 *   4. Final fallback: 'news' (lowest specificity but never crashes)
 */

// ─── Canonical Taxonomy (Sprint 1, 10 types) ────────────────────

/** All valid signal types in the Sprint 1 taxonomy */
export const CANONICAL_SIGNAL_TYPES = [
  'funding',
  'hiring',
  'leadership_change',
  'people_change',
  'expansion',
  'tech_change',
  'technology_adoption',
  'partnership',
  'acquisition',
  'news',
] as const;

export type CanonicalSignalType = (typeof CANONICAL_SIGNAL_TYPES)[number];

/** Check if a signal type is already in the canonical taxonomy */
export function isCanonicalType(type: string): type is CanonicalSignalType {
  return CANONICAL_SIGNAL_TYPES.includes(type as CanonicalSignalType);
}

// ─── Legacy Type Detection ──────────────────────────────────────

/** All known legacy/DB signal types that need mapping */
const LEGACY_TYPES = new Set([
  'business', 'technology', 'external', 'relationship', 'mention', 'signal',
  'unknown', 'other', 'general', 'info', 'alert', 'enrichment', 'research',
  'web_search', 'api', 'integration', 'insight', 'market', 'financial',
]);

export function isLegacyType(type: string): boolean {
  return LEGACY_TYPES.has(type.toLowerCase().trim());
}

// ─── Direct Mapping Table ────────────────────────────────────────

/** One-to-one legacy → canonical mappings where we're confident without context */
const DIRECT_MAPPINGS: Record<string, CanonicalSignalType> = {
  // Obvious mappings
  relationship: 'partnership',
  mention: 'news',
  signal: 'news',
  general: 'news',
  info: 'news',
  alert: 'news',
  market: 'news',
  financial: 'news',

  // Technology cluster → default to tech_change (more specific than technology_adoption)
  technology: 'tech_change',

  // Research/intelligence → news (found via search)
  research: 'news',
  web_search: 'news',
  enrichment: 'news',

  // Default fallback
  unknown: 'news',
  other: 'news',
};

// ─── Keyword-to-Type Contextual Mapping ──────────────────────────

/**
 * Keyword patterns for contextual classification of legacy types.
 * Used when direct mapping is ambiguous (e.g., 'business' could be anything).
 * These mirror the evidence-classifier patterns but operate on signal titles/descriptions.
 */
interface ContextualRule {
  type: CanonicalSignalType;
  keywords: string[];
  weight: number; // Higher = stronger match
}

const CONTEXTUAL_RULES: ContextualRule[] = [
  {
    type: 'acquisition',
    keywords: ['acquires', 'acquired', 'acquisition', 'buyout', 'merger', 'takes over', 'purchase', 'buys'],
    weight: 10,
  },
  {
    type: 'funding',
    keywords: ['funding', 'funded', 'investment', 'raised', 'raise', 'series a', 'series b', 'series c', 'venture', 'valuation', 'ipo', 'seed round', 'seed funding', 'fundraise'],
    weight: 9,
  },
  {
    type: 'leadership_change',
    keywords: ['ceo', 'cto', 'cio', 'cfo', 'coo', 'chief', 'appointed', 'promoted', 'named', 'joins as', 'steps down', 'succeeds', 'new leader', 'executive', 'president'],
    weight: 9,
  },
  {
    type: 'people_change',
    keywords: ['vp', 'vice president', 'director', 'head of', 'senior director', 'managing director', 'department head', 'appointed', 'promoted to', 'joined', 'left', 'departed', 'hired as'],
    weight: 8,
  },
  {
    type: 'expansion',
    keywords: ['expansion', 'expanding', 'new office', 'opens office', 'entering', 'launches in', 'new market', 'geographic', 'global', 'international', 'new location', 'new facility'],
    weight: 8,
  },
  {
    type: 'technology_adoption',
    keywords: ['implements', 'adopting', 'deploying', 'standardizes on', 'chooses', 'selects', 'partners with', 'integrates', 'cloud-native', 'kubernetes', 'snowflake', 'databricks', 'terraform', 'servicenow', 'salesforce', 'workday', 'sap', 'oracle cloud'],
    weight: 9,
  },
  {
    type: 'tech_change',
    keywords: ['migration', 'cloud', 'ai', 'artificial intelligence', 'machine learning', 'digital transformation', 'moderniz', 'platform', 'infrastructure', 'technology', 'deploying', 'implementing', 'upgrading', 'devops', 'microservice', 'saas', 'erp', 'crm', 'data platform'],
    weight: 7,
  },
  {
    type: 'hiring',
    keywords: ['hiring', 'job', 'jobs', 'career', 'opening', 'openings', 'recruiting', 'looking for', 'seeking', 'joining', 'hire', 'talent', 'position', 'roles', 'engineer', 'architect'],
    weight: 8,
  },
  {
    type: 'partnership',
    keywords: ['partnership', 'partner', 'collaboration', 'collaborate', 'joint venture', 'alliance', 'integrates with', 'strategic partner', 'channel partner', 'co-sell'],
    weight: 9,
  },
  {
    type: 'news',
    keywords: ['announce', 'announced', 'launches', 'launched', 'release', 'released', 'unveils', 'unveiled', 'introduces', 'report', 'quarterly', 'earnings', 'revenue'],
    weight: 5,
  },
];

// ─── Core Mapping Functions ─────────────────────────────────────

export interface TypeMappingResult {
  /** The normalized canonical signal type */
  normalizedType: CanonicalSignalType;
  /** Whether the type was already canonical (passed through) */
  wasCanonical: boolean;
  /** Whether a direct mapping was used */
  usedDirectMapping: boolean;
  /** Whether contextual keyword analysis was used */
  useContextualAnalysis: boolean;
  /** The original type before normalization */
  originalType: string;
}

/**
 * Normalize a signal type to the canonical 10-type taxonomy.
 *
 * This is the PRIMARY function that all downstream engines should call
 * before performing any type-based analysis.
 *
 * @param signalType - The raw signal type from DB or classification
 * @param title - Signal title (used for contextual analysis of legacy types)
 * @param description - Signal description (used for contextual analysis)
 * @returns Mapping result with normalized type and mapping metadata
 */
export function normalizeSignalType(
  signalType: string,
  title?: string,
  description?: string
): TypeMappingResult {
  const originalType = signalType;
  const trimmed = signalType.toLowerCase().trim();

  // 1. Already canonical → pass through
  if (isCanonicalType(trimmed)) {
    return {
      normalizedType: trimmed,
      wasCanonical: true,
      usedDirectMapping: false,
      useContextualAnalysis: false,
      originalType,
    };
  }

  // 2. Direct legacy mapping
  const directMap = DIRECT_MAPPINGS[trimmed];
  if (directMap) {
    // But check if we can do better with contextual analysis for ambiguous ones
    // 'business' and 'external' are too broad — always use contextual analysis
    if (trimmed === 'business' || trimmed === 'external' || trimmed === 'unknown' || trimmed === 'other') {
      const contextual = contextualClassify(title || '', description || '');
      if (contextual) {
        return {
          normalizedType: contextual,
          wasCanonical: false,
          usedDirectMapping: false,
          useContextualAnalysis: true,
          originalType,
        };
      }
    }
    return {
      normalizedType: directMap,
      wasCanonical: false,
      usedDirectMapping: true,
      useContextualAnalysis: false,
      originalType,
    };
  }

  // 3. Contextual keyword analysis (for any unrecognized type)
  const contextual = contextualClassify(title || '', description || '');
  if (contextual) {
    return {
      normalizedType: contextual,
      wasCanonical: false,
      usedDirectMapping: false,
      useContextualAnalysis: true,
      originalType,
    };
  }

  // 4. Final fallback: 'news'
  return {
    normalizedType: 'news',
    wasCanonical: false,
    usedDirectMapping: false,
    useContextualAnalysis: false,
    originalType,
  };
}

/**
 * Quick normalization — returns just the canonical type string.
 * Use this when you don't need mapping metadata.
 */
export function normalizeType(signalType: string, title?: string, description?: string): CanonicalSignalType {
  return normalizeSignalType(signalType, title, description).normalizedType;
}

// ─── Contextual Classification ──────────────────────────────────

function contextualClassify(title: string, description: string): CanonicalSignalType | null {
  const text = `${title} ${description}`.toLowerCase();
  if (!text.trim()) return null;

  let bestMatch: CanonicalSignalType | null = null;
  let bestScore = 0;

  for (const rule of CONTEXTUAL_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        // Title hits count more than description hits
        const inTitle = title.toLowerCase().includes(keyword);
        score += inTitle ? rule.weight * 2 : rule.weight;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule.type;
    }
  }

  // Minimum threshold to avoid false positives
  return bestScore >= 5 ? bestMatch : null;
}

// ─── Batch Normalization ──────────────────────────────────────

/**
 * Normalize signal types for an array of signals.
 * Returns a map of signal ID → canonical type.
 */
export function normalizeSignalTypes(
  signals: Array<{ id: string; signalType: string; title?: string; description?: string }>
): Map<string, CanonicalSignalType> {
  const result = new Map<string, CanonicalSignalType>();
  for (const signal of signals) {
    result.set(signal.id, normalizeType(signal.signalType, signal.title, signal.description));
  }
  return result;
}

/**
 * Group signals by normalized type.
 * Returns a map of canonical type → array of (normalized) signals.
 */
export function groupByCanonicalType<T extends { signalType: string; title?: string; description?: string }>(
  signals: T[]
): Map<CanonicalSignalType, T[]> {
  const groups = new Map<CanonicalSignalType, T[]>();
  for (const signal of signals) {
    const canonical = normalizeType(signal.signalType, signal.title, signal.description);
    const list = groups.get(canonical) || [];
    list.push(signal);
    groups.set(canonical, list);
  }
  return groups;
}

// ─── Normalized Signal Wrapper ──────────────────────────────────

/**
 * Wrap a signal with its normalized type. Use this when passing signals
 * to correlation/prediction/cross-account engines.
 */
export function normalizedSignal<T extends { id: string; signalType: string; title?: string; description?: string }>(
  signal: T
): T & { normalizedType: CanonicalSignalType } {
  const mapping = normalizeSignalType(signal.signalType, signal.title, signal.description);
  return {
    ...signal,
    normalizedType: mapping.normalizedType,
  };
}

/**
 * Normalize an array of signals for downstream engine consumption.
 */
export function normalizeSignals<T extends { id: string; signalType: string; title?: string; description?: string }>(
  signals: T[]
): Array<T & { normalizedType: CanonicalSignalType }> {
  return signals.map(normalizedSignal);
}
