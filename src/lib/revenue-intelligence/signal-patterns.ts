// ── Phase 7.6: Signal Patterns ──
// Configurable keyword-to-signal-type mapping.
// Pure keyword matching — no ML/NLP.
// Each category has keywords that, when found in signal text, classify the signal.

export type SignalCategory = 'TECHNOLOGY' | 'GROWTH' | 'PARTNERSHIP' | 'PAIN' | 'LEADERSHIP';

export interface SignalPattern {
  category: SignalCategory;
  keywords: string[];
  weight: number; // 0.1–1.0; higher = stronger signal contribution
  label: string;  // human-readable label for this pattern
}

// ── Default patterns (configurable via SystemSetting key "revenue-intelligence:signal-patterns") ──
export const DEFAULT_SIGNAL_PATTERNS: SignalPattern[] = [
  {
    category: 'TECHNOLOGY',
    keywords: [
      'cloud', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'microservice',
      'migrate', 'migration', 'modernize', 'modernization', 'saas', 'platform',
      'api', 'data lake', 'data warehouse', 'snowflake', 'databricks', 'spark',
      'machine learning', 'artificial intelligence', 'ai-powered', 'genai',
      'llm', 'openai', 'tensorflow', 'pytorch', 'infrastructure', 'devops',
      'ci/cd', 'terraform', 'serverless', 'edge computing', 'iot',
    ],
    weight: 0.9,
    label: 'Technology adoption & infrastructure changes',
  },
  {
    category: 'GROWTH',
    keywords: [
      'expansion', 'growing', 'growth', 'scale', 'scaling', 'new market',
      'international', 'global', 'headcount', 'hiring', 'new office',
      'revenue growth', 'series a', 'series b', 'series c', 'series d',
      'funding round', 'raised', 'valuation', 'ipo', 'acquire', 'acquisition',
      'merger', 'customer growth', 'user growth', 'tripled', 'doubled',
    ],
    weight: 0.85,
    label: 'Growth indicators & expansion signals',
  },
  {
    category: 'PARTNERSHIP',
    keywords: [
      'partner', 'partnership', 'alliance', 'joint venture', 'strategic alliance',
      'collaboration', 'integration', 'ecosystem', 'channel partner', 'reseller',
      'technology partner', 'co-sell', 'co-market', 'oem', 'white label',
      'certified', 'integration partner', 'marketplace',
    ],
    weight: 0.75,
    label: 'Partnership & alliance signals',
  },
  {
    category: 'PAIN',
    keywords: [
      'challenge', 'pain point', 'struggle', 'difficulty', 'problem',
      'outdated', 'legacy', 'technical debt', 'downtime', 'outage',
      'security breach', 'data breach', 'compliance', 'regulatory',
      'gdpr', 'hipaa', 'soc 2', 'inefficient', 'manual process',
      'bottleneck', 'cost overrun', 'budget cut', 'layoff', 'restructuring',
      'attrition', 'turnover', 'talent shortage', 'skill gap',
    ],
    weight: 0.95,
    label: 'Pain points & business challenges',
  },
  {
    category: 'LEADERSHIP',
    keywords: [
      'ceo', 'cto', 'cfo', 'cio', 'cdo', 'vp', 'chief',
      'appointed', 'hired', 'joined', 'departed', 'left', 'stepped down',
      'promoted', 'new leadership', 'board', 'director', 'head of',
      'executive', 'leadership change', 'management', 'founder',
      'co-founder', 'president', 'svp',
    ],
    weight: 0.7,
    label: 'Leadership changes & organizational shifts',
  },
];

/**
 * Match text against signal patterns.
 * Returns all matching categories with their match details.
 */
export function matchSignalPatterns(text: string, patterns: SignalPattern[] = DEFAULT_SIGNAL_PATTERNS): PatternMatch[] {
  const normalizedText = text.toLowerCase();
  const matches: PatternMatch[] = [];

  for (const pattern of patterns) {
    const matchedKeywords: string[] = [];
    for (const kw of pattern.keywords) {
      if (normalizedText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      matches.push({
        category: pattern.category,
        label: pattern.label,
        matchedKeywords,
        matchCount: matchedKeywords.length,
        weight: pattern.weight,
        score: Math.min(100, matchedKeywords.length * (pattern.weight * 25)),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export interface PatternMatch {
  category: SignalCategory;
  label: string;
  matchedKeywords: string[];
  matchCount: number;
  weight: number;
  score: number;
}

/**
 * Get the primary (highest-scoring) category for a text.
 */
export function getPrimaryCategory(text: string, patterns: SignalPattern[] = DEFAULT_SIGNAL_PATTERNS): PatternMatch | null {
  const matches = matchSignalPatterns(text, patterns);
  return matches.length > 0 ? matches[0] : null;
}
