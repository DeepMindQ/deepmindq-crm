/**
 * Phase 7.6: Signal Detection Patterns
 *
 * Configurable keyword maps for detecting buying signals
 * from intelligence content. Rule-based, no ML/NLP.
 *
 * Future: Load from DB for admin customization.
 */

export type SignalCategory = 'growth' | 'technology' | 'leadership' | 'partnership' | 'pain';

export interface SignalPattern {
  category: SignalCategory;
  keywords: string[];
  importance: number; // 1-10, higher = more important signal
}

export const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    category: 'technology',
    importance: 9,
    keywords: [
      'artificial intelligence', 'AI', 'machine learning', 'cloud migration',
      'automation', 'digital transformation', 'data platform', 'data engineering',
      'cloud native', 'kubernetes', 'microservices', 'API platform',
      'generative AI', 'LLM', 'large language model', 'copilot',
      'data lake', 'data warehouse', 'real-time analytics',
    ],
  },
  {
    category: 'growth',
    importance: 7,
    keywords: [
      'hiring', 'expansion', 'new market', 'investment', 'funding',
      'grew revenue', 'growth rate', 'new office', 'new location',
      'IPO', 'acquisition', 'scale', 'scaling', 'headcount',
      'new product launch', 'market share', 'customer growth',
    ],
  },
  {
    category: 'leadership',
    importance: 8,
    keywords: [
      'CIO', 'CTO', 'CEO', 'chief information', 'chief technology',
      'chief digital', 'leadership change', 'new executive', 'appointed',
      'strategy announced', 'transformation initiative', 'digital officer',
      'VP of engineering', 'head of data', 'chief data officer',
    ],
  },
  {
    category: 'partnership',
    importance: 7,
    keywords: [
      'partner', 'partnership', 'strategic alliance', 'collaboration',
      'joint venture', 'integration', 'technology partner', 'vendor',
      'supplier', 'ecosystem', 'consortium', 'coalition',
    ],
  },
  {
    category: 'pain',
    importance: 8,
    keywords: [
      'layoff', 'outdated', 'legacy', 'challenge', 'delay',
      'security breach', 'data loss', 'compliance', 'regulation',
      'technical debt', 'migration challenge', 'skills gap',
      'budget cut', 'cost reduction', 'downsizing', 'restructuring',
      'platform limitation', 'scalability issue',
    ],
  },
];

/** Build a lookup map for fast matching */
export const KEYWORD_TO_CATEGORY: Map<string, { category: SignalCategory; importance: number }> = new Map();
for (const pattern of SIGNAL_PATTERNS) {
  for (const kw of pattern.keywords) {
    KEYWORD_TO_CATEGORY.set(kw.toLowerCase(), { category: pattern.category, importance: pattern.importance });
  }
}

/** Importance thresholds for scoring */
export const IMPORTANCE_WEIGHTS: Record<number, number> = {
  10: 1.0,
  9: 0.9,
  8: 0.8,
  7: 0.7,
  6: 0.6,
  5: 0.5,
  4: 0.4,
  3: 0.3,
  2: 0.2,
  1: 0.1,
};

/** Signal scoring weights (from spec) */
export const SIGNAL_SCORING_WEIGHTS = {
  freshness: 0.25,
  sourceConfidence: 0.25,
  signalImportance: 0.30,
  signalFrequency: 0.20,
} as const;

/** Account score weights (from spec) */
export const ACCOUNT_SCORING_WEIGHTS = {
  intelligenceCoverage: 0.20,
  opportunitySignals: 0.30,
  freshness: 0.20,
  strategicFit: 0.20,
  engagementHistory: 0.10,
} as const;

/** Account category thresholds */
export const ACCOUNT_CATEGORY_THRESHOLDS = {
  HOT_ACCOUNT: 70,
  WARM_ACCOUNT: 40,
  NURTURE: 0,   // everything below 40
  AT_RISK: -1,  // never auto-assigned; only via explicit logic
} as const;

export type AccountCategory = 'HOT_ACCOUNT' | 'WARM_ACCOUNT' | 'NURTURE' | 'AT_RISK';