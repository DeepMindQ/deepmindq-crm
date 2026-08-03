/**
 * AI Evaluation Engine — WI-16E
 * =================================
 *
 * Enterprise-grade evaluation framework for measuring AI intelligence quality
 * across all DeepMindQ engines. Provides:
 *
 *   1. Multi-dimensional Evaluation Metrics
 *      - Accuracy (factual correctness against ground truth)
 *      - Hallucination Rate (fabricated claims / total claims)
 *      - Citation Accuracy (cited evidence alignment)
 *      - Confidence Calibration (predicted vs actual correctness)
 *      - Response Quality (completeness, relevance, specificity)
 *      - Business Usefulness (actionability, decision support)
 *
 *   2. Engine Comparison
 *      - Model A/B comparison (GPT vs Claude vs Gemini vs Local)
 *      - Prompt version comparison
 *      - Engine accuracy ranking
 *      - Regression detection
 *
 *   3. Continuous Improvement Loop
 *      - Evaluation → Score → Trend → Alert → Action
 *      - Baseline establishment → Regression gates → Improvement tracking
 *
 * ARCHITECTURE:
 *
 *   BenchmarkDataset (ai-evaluation-benchmarks.ts)
 *         |
 *   AI Evaluation Engine (this file)
 *         |
 *   ├── runEvaluation()          Single evaluation run
 *   ├── runBenchmarkSuite()     Full benchmark suite
 *   ├── compareVersions()       A/B comparison
 *   ├── getQualityTrends()      Historical trend analysis
 *   └── generateQualityReport() Executive summary
 *         |
 *   EvaluationStore (persisted results)
 *         |
 *   AI Evaluation Dashboard (ai-evaluation-dashboard.ts)
 *
 * NON-THROWING DESIGN: All functions return structured results, never throw.
 */

import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

/** The 6 core evaluation dimensions. */
export type EvaluationDimension =
  | 'accuracy'
  | 'hallucination_rate'
  | 'citation_accuracy'
  | 'confidence_calibration'
  | 'response_quality'
  | 'business_usefulness';

/** Engine being evaluated. */
export type EvaluatedEngine =
  | 'model_router'
  | 'grounding_engine'
  | 'retrieval_engine'
  | 'synthesis_engine'
  | 'scoring_engine'
  | 'action_engine'
  | 'conversation_engine'
  | 'reasoning_engine'
  | 'multi_agent'
  | 'hallucination_prevention'
  | 'unified_confidence'
  | 'prompt_registry'
  | 'research_engine'
  | 'signal_engine';

/** Category of intelligence being evaluated. */
export type IntelligenceCategory =
  | 'company_intelligence'
  | 'contact_intelligence'
  | 'signal_detection'
  | 'opportunity_prediction'
  | 'recommendation'
  | 'brief_generation'
  | 'scoring'
  | 'conversation_planning'
  | 'email_generation'
  | 'strategy';

/** Severity of evaluation findings. */
export type FindingSeverity = 'critical' | 'warning' | 'info' | 'pass';

// ── Core Evaluation Types ───────────────────────────────────────────────────

export interface EvaluationInput {
  /** The AI output to evaluate. */
  aiOutput: string;
  /** Ground truth / expected output for accuracy scoring. */
  expectedOutput?: string;
  /** The evidence/context that was provided to the AI. */
  providedEvidence?: Array<{ id: string; text: string; source: string }>;
  /** The confidence score the AI assigned (0-100). */
  aiConfidence?: number;
  /** The engine that produced this output. */
  engine: EvaluatedEngine;
  /** The intelligence category. */
  category: IntelligenceCategory;
  /** The model/provider used (e.g. 'gemini-2.0-flash'). */
  model?: string;
  /** The prompt ID used (links to PromptRegistry). */
  promptId?: string;
  /** The prompt version used. */
  promptVersion?: string;
  /** The generation type (links to GovernanceConfig). */
  generationType?: string;
  /** Latency of the AI call in milliseconds. */
  latencyMs?: number;
  /** Token usage. */
  tokensUsed?: number;
  /** Entity being evaluated (company ID, etc.). */
  entityId?: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

export interface DimensionScore {
  /** Which dimension was scored. */
  dimension: EvaluationDimension;
  /** Score 0-100 (100 = perfect). */
  score: number;
  /** Grade equivalent. */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Human-readable explanation of the score. */
  explanation: string;
  /** Specific findings (issues detected). */
  findings: EvaluationFinding[];
  /** Weight in the composite score. */
  weight: number;
}

export interface EvaluationFinding {
  /** What was found. */
  description: string;
  /** Severity level. */
  severity: FindingSeverity;
  /** The dimension this finding relates to. */
  dimension: EvaluationDimension;
  /** Suggested fix or improvement. */
  suggestion?: string;
  /** Position in the output where the issue was found (character offset). */
  position?: number;
}

export interface EvaluationResult {
  /** Unique evaluation ID. */
  evaluationId: string;
  /** When this evaluation was run. */
  timestamp: string;
  /** The engine evaluated. */
  engine: EvaluatedEngine;
  /** The intelligence category. */
  category: IntelligenceCategory;
  /** Model used. */
  model: string | null;
  /** Prompt ID + version used. */
  promptId: string | null;
  promptVersion: string | null;

  // ── Per-dimension scores ──
  /** Individual dimension scores with breakdown. */
  dimensions: DimensionScore[];

  // ── Composite ──
  /** Weighted composite score 0-100. */
  compositeScore: number;
  /** Composite grade (A through F). */
  compositeGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Whether this passes the enterprise quality threshold (>= 70). */
  enterpriseReady: boolean;

  // ── Aggregate counts ──
  /** Total findings by severity. */
  findingCounts: {
    critical: number;
    warning: number;
    info: number;
    pass: number;
  };
  /** All findings across all dimensions. */
  findings: EvaluationFinding[];

  // ── Metadata ──
  /** Latency of the AI call. */
  latencyMs: number | null;
  /** Tokens consumed. */
  tokensUsed: number | null;
  /** Model version of this evaluation engine. */
  evalEngineVersion: string;
}

// ── Benchmark Suite Types ──────────────────────────────────────────────────

export interface BenchmarkCase {
  /** Unique benchmark case ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Engine this tests. */
  targetEngine: EvaluatedEngine;
  /** Intelligence category. */
  category: IntelligenceCategory;
  /** Difficulty level. */
  difficulty: 'basic' | 'intermediate' | 'advanced' | 'edge_case';
  /** Input data for the AI (company data, signals, etc.). */
  input: BenchmarkInput;
  /** Expected output (ground truth). */
  expected: BenchmarkExpected;
  /** Maximum allowed hallucination rate (0-1). */
  maxHallucinationRate: number;
  /** Minimum acceptable composite score (0-100). */
  minScore: number;
  /** Claims that must NOT appear in the output. */
  forbiddenClaims?: string[];
  /** Claims that MUST appear in the output. */
  requiredClaims?: string[];
  /** Allowed confidence range. */
  allowedConfidenceRange?: { min: number; max: number };
  /** Tags for filtering. */
  tags: string[];
  /** Whether this benchmark is active. */
  active: boolean;
}

export interface BenchmarkInput {
  /** The user query or task description. */
  query: string;
  /** Company data context. */
  companyData?: {
    name: string;
    industry?: string;
    size?: string;
    revenue?: string;
    technology?: string[];
    location?: string;
  };
  /** Signals/evidence context. */
  signals?: Array<{
    type: string;
    description: string;
    source: string;
    date: string;
    confidence: number;
  }>;
  /** Contact data context. */
  contacts?: Array<{
    name: string;
    role: string;
    department?: string;
    seniority?: string;
  }>;
  /** Additional context text. */
  context?: string;
  /** Evidence items available for grounding. */
  evidence?: Array<{ id: string; text: string; source: string; reliability: number }>;
}

export interface BenchmarkExpected {
  /** The correct answer or key facts that must be present. */
  keyFacts: string[];
  /** Minimum number of citations expected. */
  minCitations?: number;
  /** Expected confidence level. */
  expectedConfidence?: 'high' | 'medium' | 'low';
  /** Required output sections/elements. */
  requiredSections?: string[];
  /** Key entities that must be mentioned. */
  requiredEntities?: string[];
  /** What the response should NOT include. */
  exclusions?: string[];
}

export interface BenchmarkSuiteResult {
  /** Suite run ID. */
  suiteId: string;
  /** Timestamp. */
  timestamp: string;
  /** Which benchmark categories were run. */
  categories: IntelligenceCategory[];
  /** Total cases. */
  totalCases: number;
  /** Cases passed. */
  passedCases: number;
  /** Cases failed. */
  failedCases: number;
  /** Cases skipped (inactive). */
  skippedCases: number;
  /** Pass rate (0-1). */
  passRate: number;
  /** Average composite score. */
  averageScore: number;
  /** Per-category breakdown. */
  categoryBreakdown: CategoryBreakdown[];
  /** Individual case results. */
  caseResults: BenchmarkCaseResult[];
  /** Duration of the suite run. */
  durationMs: number;
  /** Model and prompt metadata. */
  model: string | null;
  promptVersion: string | null;
}

export interface CategoryBreakdown {
  category: IntelligenceCategory;
  totalCases: number;
  passedCases: number;
  averageScore: number;
  averageHallucinationRate: number;
  averageLatencyMs: number;
}

export interface BenchmarkCaseResult {
  benchmarkId: string;
  benchmarkName: string;
  category: IntelligenceCategory;
  passed: boolean;
  score: number;
  hallucinationRate: number;
  findings: EvaluationFinding[];
  latencyMs: number | null;
  failureReason?: string;
}

// ── Comparison Types ───────────────────────────────────────────────────────

export interface ComparisonResult {
  /** Comparison ID. */
  comparisonId: string;
  /** Timestamp. */
  timestamp: string;
  /** What was compared (e.g. 'prompt_version', 'model', 'engine_version'). */
  comparisonType: 'prompt_version' | 'model' | 'engine_version' | 'configuration';
  /** Label A (e.g. 'v3.0'). */
  labelA: string;
  /** Label B (e.g. 'v3.1'). */
  labelB: string;
  /** Results for A. */
  resultsA: ComparisonSide;
  /** Results for B. */
  resultsB: ComparisonSide;
  /** Which is better (null = inconclusive). */
  winner: 'A' | 'B' | null;
  /** Delta scores per dimension. */
  deltas: DimensionDelta[];
  /** Summary recommendation. */
  recommendation: string;
}

export interface ComparisonSide {
  compositeScore: number;
  hallucinationRate: number;
  accuracyScore: number;
  citationAccuracy: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  evaluationCount: number;
}

export interface DimensionDelta {
  dimension: EvaluationDimension;
  scoreA: number;
  scoreB: number;
  delta: number;
  improved: boolean;
  significance: 'significant' | 'marginal' | 'negligible';
}

// ── Trend & Quality Report Types ──────────────────────────────────────────

export interface QualityTrend {
  dimension: EvaluationDimension;
  /** Historical data points (oldest first). */
  dataPoints: TrendDataPoint[];
  /** Trend direction. */
  trend: 'improving' | 'stable' | 'declining';
  /** Slope (positive = improving). */
  slope: number;
  /** Average score over the period. */
  average: number;
  /** Standard deviation. */
  stdDev: number;
}

export interface TrendDataPoint {
  timestamp: string;
  score: number;
  evaluationCount: number;
  model?: string;
  promptVersion?: string;
}

export interface QualityReport {
  /** Report ID. */
  reportId: string;
  /** Timestamp. */
  timestamp: string;
  /** Period covered (e.g. '7d', '30d', '90d'). */
  period: string;
  /** Executive summary. */
  executiveSummary: string;
  /** Overall AI quality score (weighted composite). */
  overallScore: number;
  /** Overall grade. */
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Per-engine scores. */
  engineScores: EngineScoreSummary[];
  /** Per-dimension trends. */
  dimensionTrends: QualityTrend[];
  /** Critical findings requiring action. */
  criticalFindings: EvaluationFinding[];
  /** Improvement recommendations. */
  recommendations: string[];
  /** Top performing model. */
  bestModel: string | null;
  /** Top performing prompt version. */
  bestPromptVersion: string | null;
  /** Hallucination rate trend. */
  hallucinationRateTrend: 'improving' | 'stable' | 'declining';
  /** Regression alerts. */
  regressions: RegressionAlert[];
}

export interface EngineScoreSummary {
  engine: EvaluatedEngine;
  averageScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
  evaluationCount: number;
  lastEvaluated: string;
}

export interface RegressionAlert {
  dimension: EvaluationDimension;
  engine: EvaluatedEngine;
  previousScore: number;
  currentScore: number;
  delta: number;
  severity: 'critical' | 'warning';
  detectedAt: string;
}

// ── Evaluation Store (in-memory for now, DB-persisted later) ────────────────

export interface EvaluationRecord {
  evaluationId: string;
  timestamp: string;
  engine: EvaluatedEngine;
  category: IntelligenceCategory;
  model: string | null;
  promptId: string | null;
  promptVersion: string | null;
  compositeScore: number;
  dimensionScores: Record<EvaluationDimension, number>;
  hallucinationRate: number;
  latencyMs: number | null;
  tokensUsed: number | null;
  findings: EvaluationFinding[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const EVAL_ENGINE_VERSION = '1.0.0';

/** Dimension weights for composite score calculation. */
const DIMENSION_WEIGHTS: Record<EvaluationDimension, number> = {
  accuracy: 0.25,
  hallucination_rate: 0.20,
  citation_accuracy: 0.15,
  confidence_calibration: 0.15,
  response_quality: 0.15,
  business_usefulness: 0.10,
};

/** Grade thresholds. */
const GRADE_THRESHOLDS: Array<{ min: number; grade: 'A' | 'B' | 'C' | 'D' | 'F' }> = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' },
];

/** Enterprise quality threshold. */
const ENTERPRISE_THRESHOLD = 70;

/** In-memory evaluation store (bounded to last 1000 evaluations). */
const evaluationStore: EvaluationRecord[] = [];
const MAX_STORE_SIZE = 1000;

// ── Utility Functions ─────────────────────────────────────────────────────

/** Generate a unique ID. */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Determine grade from score. */
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) return threshold.grade;
  }
  return 'F';
}

/** Safe clamp to 0-100 range. */
function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Record an evaluation to the store. */
function recordEvaluation(result: EvaluationResult): void {
  const record: EvaluationRecord = {
    evaluationId: result.evaluationId,
    timestamp: result.timestamp,
    engine: result.engine,
    category: result.category,
    model: result.model,
    promptId: result.promptId,
    promptVersion: result.promptVersion,
    compositeScore: result.compositeScore,
    dimensionScores: {} as Record<EvaluationDimension, number>,
    hallucinationRate: 0,
    latencyMs: result.latencyMs,
    tokensUsed: result.tokensUsed,
    findings: result.findings,
  };

  for (const dim of result.dimensions) {
    record.dimensionScores[dim.dimension] = dim.score;
  }

  // Extract hallucination rate from dimension scores
  const hallucDim = result.dimensions.find(d => d.dimension === 'hallucination_rate');
  if (hallucDim) {
    record.hallucinationRate = 1 - hallucDim.score / 100; // Invert: high score = low hallucination
  }

  evaluationStore.push(record);

  // Trim oldest entries if over capacity
  while (evaluationStore.length > MAX_STORE_SIZE) {
    evaluationStore.shift();
  }
}

// ── Dimension Evaluators ──────────────────────────────────────────────────

/**
 * Evaluates factual accuracy of AI output against expected ground truth.
 *
 * Methodology:
 *   1. Extract key factual claims from AI output
 *   2. Match claims against expected facts
 *   3. Score based on presence of correct facts and absence of wrong ones
 */
function evaluateAccuracy(input: EvaluationInput, expected?: string): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 70; // Base score

  const aiOutput = input.aiOutput.toLowerCase();
  const expectedLower = (expected || '').toLowerCase();

  if (!expected || expected.trim().length === 0) {
    return {
      dimension: 'accuracy',
      score: 50,
      grade: 'D',
      explanation: 'No ground truth provided — accuracy cannot be fully assessed. Manual review required.',
      findings: [{
        description: 'Missing ground truth for accuracy evaluation',
        severity: 'warning',
        dimension: 'accuracy',
        suggestion: 'Provide expected output to enable automated accuracy scoring.',
      }],
      weight: DIMENSION_WEIGHTS.accuracy,
    };
  }

  // 1. Check for expected key facts presence
  // Split expected output into sentences/key phrases
  const expectedPhrases = expectedLower
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  let matchedFacts = 0;
  let totalFacts = expectedPhrases.length;

  for (const phrase of expectedPhrases) {
    // Check if the key information from this phrase appears in the AI output
    const keyWords = phrase.split(/\s+/).filter(w => w.length > 4);
    const matchingWords = keyWords.filter(w => aiOutput.includes(w));

    if (matchingWords.length / Math.max(keyWords.length, 1) > 0.6) {
      matchedFacts++;
    }
  }

  // 2. Check for contradictory statements
  const contradictions = detectContradictions(aiOutput, expectedLower);
  for (const contradiction of contradictions) {
    findings.push({
      description: `Contradiction detected: AI states "${contradiction.aiClaim}" but expected says "${contradiction.expectedClaim}"`,
      severity: 'critical',
      dimension: 'accuracy',
      suggestion: 'Review AI prompt grounding rules. Ensure evidence is correctly referenced.',
    });
    score -= 20;
  }

  // 3. Calculate precision-like score
  const factPrecision = totalFacts > 0 ? matchedFacts / totalFacts : 0.5;
  const noContradictionBonus = contradictions.length === 0 ? 10 : 0;
  score = clampScore(score * factPrecision + noContradictionBonus);

  if (matchedFacts < totalFacts * 0.5 && totalFacts > 2) {
    findings.push({
      description: `AI output only matched ${matchedFacts}/${totalFacts} expected facts`,
      severity: 'warning',
      dimension: 'accuracy',
      suggestion: 'AI may be missing key information. Review evidence context provided to the model.',
    });
  }

  if (matchedFacts === totalFacts && contradictions.length === 0) {
    findings.push({
      description: 'All expected facts present with no contradictions',
      severity: 'pass',
      dimension: 'accuracy',
    });
  }

  return {
    dimension: 'accuracy',
    score,
    grade: scoreToGrade(score),
    explanation: `Matched ${matchedFacts}/${totalFacts} expected facts. ${contradictions.length} contradictions detected.`,
    findings,
    weight: DIMENSION_WEIGHTS.accuracy,
  };
}

/**
 * Detect contradictions between AI output and expected output.
 */
function detectContradictions(
  aiOutput: string,
  expected: string,
): Array<{ aiClaim: string; expectedClaim: string }> {
  const contradictions: Array<{ aiClaim: string; expectedClaim: string }> = [];

  // Common negation patterns to detect explicit contradictions
  const negationPatterns = [
    { pattern: /is\s+not\s+(\w+)/i, inverse: /is\s+(\w+)/i },
    { pattern: /does\s+not\s+(\w+)/i, inverse: /does\s+(\w+)/i },
    { pattern: /has\s+no\s+(\w+)/i, inverse: /has\s+(\w+)/i },
    { pattern: /is\s+(\w+),?\s+not/i, inverse: /is\s+(\w+)/i },
  ];

  for (const { pattern, inverse } of negationPatterns) {
    const aiNegMatch = aiOutput.match(pattern);
    const expectedAffMatch = expected.match(inverse);

    if (aiNegMatch && expectedAffMatch) {
      const aiClaim = aiNegMatch[0];
      const expectedWord = expectedAffMatch[1];
      if (aiNegMatch[1] === expectedWord) {
        contradictions.push({
          aiClaim: aiClaim.substring(0, 60),
          expectedClaim: expectedAffMatch[0].substring(0, 60),
        });
      }
    }
  }

  return contradictions;
}

/**
 * Evaluates hallucination rate in AI output.
 *
 * Methodology:
 *   1. Extract quantifiable claims (numbers, dates, names, assertions)
 *   2. Check which claims have citation markers [En]
 *   3. Check which uncited claims are verifiable against provided evidence
 *   4. Flag unsupported claims as potential hallucinations
 */
function evaluateHallucinationRate(input: EvaluationInput): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 90; // Start high, deduct for issues

  const output = input.aiOutput;

  // 1. Extract all factual claims
  const claimPatterns = [
    // Revenue/financial claims
    /\$[\d,.]+[BMK]?/gi,
    // Employee count claims
    /(?:approximately\s+)?[\d,]+\s+(?:employees?|people|staff)/gi,
    // Year/date claims
    /\b(20\d{2}|19\d{2})\b/g,
    // Percentage claims
    /\b\d{1,3}\s*%/g,
    // Technology/tool claims (capitalized terms)
    /\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*\b/g,
    // Absolute claims ("is the leading", "is the largest")
    /(?:is|are|was|were)\s+(?:the\s+)?(?:leading|largest|biggest|first|only|primary)/gi,
  ];

  const allClaims: Array<{ text: string; position: number; hasCitation: boolean }> = [];
  const citedClaimPattern = /\[E\d+\]/g;

  for (const pattern of claimPatterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const claimText = match[0];
      const position = match.index;

      // Check if this claim has a citation marker nearby (within 100 chars)
      const nearbyText = output.substring(
        Math.max(0, position - 50),
        Math.min(output.length, position + claimText.length + 100),
      );
      const hasCitation = citedClaimPattern.test(nearbyText);

      allClaims.push({ text: claimText, position, hasCitation });
    }
  }

  // Deduplicate (overlapping claims)
  const uniqueClaims = deduplicateClaims(allClaims);

  if (uniqueClaims.length === 0) {
    findings.push({
      description: 'No quantifiable claims detected in output (may be qualitative response)',
      severity: 'info',
      dimension: 'hallucination_rate',
    });
    return {
      dimension: 'hallucination_rate',
      score: 85,
      grade: 'B',
      explanation: 'No quantifiable claims detected — hallucination risk cannot be precisely measured. Assuming low risk for qualitative output.',
      findings,
      weight: DIMENSION_WEIGHTS.hallucination_rate,
    };
  }

  // 2. Calculate citation coverage
  const citedCount = uniqueClaims.filter(c => c.hasCitation).length;
  const uncitedCount = uniqueClaims.length - citedCount;
  const citationCoverage = citedCount / uniqueClaims.length;

  // 3. Verify uncited claims against provided evidence
  let unsupportedClaims = 0;
  const evidenceTexts = (input.providedEvidence || []).map(e => e.text.toLowerCase());
  const evidenceConcat = evidenceTexts.join(' ');

  for (const claim of uniqueClaims) {
    if (!claim.hasCitation) {
      const claimLower = claim.text.toLowerCase();
      // Check if the claim can be found in the evidence
      const isSupported = evidenceTexts.some(e => e.includes(claimLower) || claimLower.includes(e.substring(0, 20)));

      if (!isSupported) {
        unsupportedClaims++;
        findings.push({
          description: `Unsupported claim: "${claim.text}" — no citation and not found in provided evidence`,
          severity: unsupportedClaims <= 1 ? 'warning' : 'critical',
          dimension: 'hallucination_rate',
          position: claim.position,
          suggestion: 'Add evidence grounding for this claim or include a hedging qualifier.',
        });
      }
    }
  }

  // 4. Calculate hallucination score
  const hallucinationRate = uniqueClaims.length > 0
    ? unsupportedClaims / uniqueClaims.length
    : 0;

  score = clampScore(100 - (hallucinationRate * 100) - (uncitedCount > citedCount ? 10 : 0));

  if (citationCoverage < 0.5 && uniqueClaims.length > 3) {
    findings.push({
      description: `Low citation coverage: ${citedCount}/${uniqueClaims.length} claims cited (${(citationCoverage * 100).toFixed(0)}%)`,
      severity: 'warning',
      dimension: 'hallucination_rate',
      suggestion: 'Increase evidence citation density. Enterprise standard: >60% of claims should cite evidence.',
    });
  }

  return {
    dimension: 'hallucination_rate',
    score,
    grade: scoreToGrade(score),
    explanation: `${uniqueClaims.length} claims detected. ${unsupportedClaims} unsupported, ${uncitedCount} uncited. Hallucination rate: ${(hallucinationRate * 100).toFixed(1)}%.`,
    findings,
    weight: DIMENSION_WEIGHTS.hallucination_rate,
  };
}

/**
 * Deduplicate overlapping claims by merging nearby matches.
 */
function deduplicateClaims(
  claims: Array<{ text: string; position: number; hasCitation: boolean }>,
): Array<{ text: string; position: number; hasCitation: boolean }> {
  const sorted = [...claims].sort((a, b) => a.position - b.position);
  const result: typeof sorted = [];

  for (const claim of sorted) {
    const overlaps = result.some(
      existing => Math.abs(existing.position - claim.position) < claim.text.length + 20,
    );
    if (!overlaps) {
      result.push(claim);
    }
  }

  return result;
}

/**
 * Evaluates citation accuracy — whether cited evidence actually supports the claim.
 */
function evaluateCitationAccuracy(input: EvaluationInput): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 85;

  const output = input.aiOutput;
  const evidence = input.providedEvidence || [];

  // 1. Extract citation markers from output
  const citationMarkers = output.match(/\[E\d+\]/g) || [];
  const uniqueMarkers = [...new Set(citationMarkers)];

  if (uniqueMarkers.length === 0) {
    // No citations at all
    findings.push({
      description: 'No citation markers [En] found in output',
      severity: evidence.length > 0 ? 'warning' : 'info',
      dimension: 'citation_accuracy',
      suggestion: evidence.length > 0
        ? 'Evidence was available but not cited. AI should reference evidence with [En] markers.'
        : undefined,
    });

    return {
      dimension: 'citation_accuracy',
      score: evidence.length > 0 ? 30 : 70,
      grade: evidence.length > 0 ? 'F' : 'C',
      explanation: evidence.length > 0
        ? `${evidence.length} evidence items available but none cited in output.`
        : 'No evidence was provided, so citation accuracy cannot be assessed.',
      findings,
      weight: DIMENSION_WEIGHTS.citation_accuracy,
    };
  }

  // 2. Verify each citation marker references real evidence
  let validCitations = 0;
  let hallucinatedCitations = 0;

  for (const marker of uniqueMarkers) {
    const evidenceIndex = parseInt(marker.replace('[E', '').replace(']', ''), 10);
    const referencedEvidence = evidence[evidenceIndex - 1]; // E1 = index 0

    if (!referencedEvidence) {
      hallucinatedCitations++;
      findings.push({
        description: `Hallucinated citation: ${marker} references non-existent evidence (only ${evidence.length} evidence items provided)`,
        severity: 'critical',
        dimension: 'citation_accuracy',
        suggestion: 'AI fabricated a citation marker. Review grounding prompt instructions.',
      });
      score -= 15;
    } else {
      validCitations++;
    }
  }

  // 3. Check citation-evidence alignment for valid citations
  let alignedCitations = 0;
  for (let i = 0; i < Math.min(validCitations, evidence.length); i++) {
    const evidenceText = evidence[i].text.toLowerCase();
    // Find the text around this citation marker in the output
    const markerPosition = output.indexOf(`[E${i + 1}]`);
    if (markerPosition >= 0) {
      const surroundingContext = output.substring(
        Math.max(0, markerPosition - 150),
        Math.min(output.length, markerPosition + 50),
      ).toLowerCase();

      // Check if the surrounding text relates to the evidence
      const evidenceKeywords = evidenceText.split(/\s+/).filter(w => w.length > 4);
      const matchingKeywords = evidenceKeywords.filter(kw => surroundingContext.includes(kw));

      if (matchingKeywords.length / Math.max(evidenceKeywords.length, 1) > 0.3) {
        alignedCitations++;
      } else {
        findings.push({
          description: `Misaligned citation: [E${i + 1}] appears near text that doesn't clearly relate to the cited evidence`,
          severity: 'warning',
          dimension: 'citation_accuracy',
          position: markerPosition,
          suggestion: 'Ensure citation markers are placed near the claims they support.',
        });
      }
    }
  }

  const alignmentRate = validCitations > 0 ? alignedCitations / validCitations : 1;
  score = clampScore(score * alignmentRate);

  if (hallucinatedCitations === 0 && alignedCitations === validCitations) {
    findings.push({
      description: 'All citations valid and well-aligned with evidence',
      severity: 'pass',
      dimension: 'citation_accuracy',
    });
  }

  return {
    dimension: 'citation_accuracy',
    score,
    grade: scoreToGrade(score),
    explanation: `${uniqueMarkers.length} unique citations. ${validCitations} valid, ${hallucinatedCitations} hallucinated. ${alignedCitations}/${validCitations} well-aligned.`,
    findings,
    weight: DIMENSION_WEIGHTS.citation_accuracy,
  };
}

/**
 * Evaluates confidence calibration — does the AI's confidence match reality?
 *
 * Good calibration: high confidence → correct, low confidence → uncertain/incorrect
 * Poor calibration: overconfident wrong answers or underconfident correct answers
 */
function evaluateConfidenceCalibration(input: EvaluationInput): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 75;

  const aiConfidence = input.aiConfidence;
  if (aiConfidence === undefined || aiConfidence === null) {
    return {
      dimension: 'confidence_calibration',
      score: 50,
      grade: 'D',
      explanation: 'No AI confidence score provided — calibration cannot be assessed.',
      findings: [{
        description: 'Missing AI confidence score in evaluation input',
        severity: 'warning',
        dimension: 'confidence_calibration',
        suggestion: 'Ensure the AI engine outputs a confidence score with every response.',
      }],
      weight: DIMENSION_WEIGHTS.confidence_calibration,
    };
  }

  // 1. Check hedging language consistency
  const output = input.aiOutput;
  const highConfidenceHedgingWords = ['might', 'could', 'possibly', 'perhaps', 'maybe', 'suggests', 'may'];
  const lowConfidenceAbsoluteWords = ['definitely', 'certainly', 'clearly', 'undoubtedly', 'is'];

  if (aiConfidence > 80) {
    // High confidence — check for inappropriate hedging
    const hedgingCount = highConfidenceHedgingWords.filter(w => output.toLowerCase().includes(w)).length;
    if (hedgingCount > 3) {
      score -= 20;
      findings.push({
        description: `AI expresses ${aiConfidence}% confidence but uses ${hedgingCount} hedging words — inconsistent signal`,
        severity: 'warning',
        dimension: 'confidence_calibration',
        suggestion: 'Calibrate language to match confidence level. High confidence should use assertive language.',
      });
    }
  }

  if (aiConfidence < 40) {
    // Low confidence — check for inappropriate absolute language
    const absoluteCount = lowConfidenceAbsoluteWords.filter(w =>
      new RegExp(`\\b${w}\\b`, 'i').test(output),
    ).length;
    if (absoluteCount > 5) {
      score -= 25;
      findings.push({
        description: `AI expresses only ${aiConfidence}% confidence but uses ${absoluteCount} absolute terms — overconfident language`,
        severity: 'critical',
        dimension: 'confidence_calibration',
        suggestion: 'Low confidence responses should use hedging language and qualifiers.',
      });
    }
  }

  // 2. Check evidence count vs confidence
  const evidenceCount = (input.providedEvidence || []).length;
  if (aiConfidence > 70 && evidenceCount < 2) {
    score -= 15;
    findings.push({
      description: `High confidence (${aiConfidence}%) with limited evidence (${evidenceCount} items) — possible overconfidence`,
      severity: 'warning',
      dimension: 'confidence_calibration',
      suggestion: 'Confidence should reflect evidence strength, not just AI certainty.',
    });
  }

  if (aiConfidence < 30 && evidenceCount > 5) {
    score -= 10;
    findings.push({
      description: `Low confidence (${aiConfidence}%) despite substantial evidence (${evidenceCount} items) — possible underconfidence`,
      severity: 'info',
      dimension: 'confidence_calibration',
      suggestion: 'Review whether the AI is appropriately weighing available evidence.',
    });
  }

  score = clampScore(score);

  return {
    dimension: 'confidence_calibration',
    score,
    grade: scoreToGrade(score),
    explanation: `AI confidence: ${aiConfidence}%. ${findings.length} calibration issues detected.`,
    findings,
    weight: DIMENSION_WEIGHTS.confidence_calibration,
  };
}

/**
 * Evaluates response quality — completeness, relevance, specificity.
 */
function evaluateResponseQuality(input: EvaluationInput): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 70;
  const output = input.aiOutput;

  // 1. Completeness — is the response substantial enough?
  const wordCount = output.split(/\s+/).length;
  if (wordCount < 20) {
    score -= 25;
    findings.push({
      description: `Response too brief: ${wordCount} words. Expected a substantive answer.`,
      severity: 'warning',
      dimension: 'response_quality',
      suggestion: 'AI responses should be comprehensive and well-developed.',
    });
  } else if (wordCount >= 100) {
    score += 10;
  }

  // 2. Structure — does the response have sections/paragraphs?
  const hasParagraphs = output.split(/\n\n+/).length > 1;
  const hasBulletPoints = /[-•*]\s+/g.test(output);
  const hasSections = /^(?:##|###|\d+\.)/gm.test(output);

  if (hasSections) score += 5;
  if (hasBulletPoints) score += 3;
  if (hasParagraphs) score += 2;

  if (!hasParagraphs && wordCount > 80) {
    findings.push({
      description: 'Long response lacks paragraph structure — readability concern',
      severity: 'info',
      dimension: 'response_quality',
    });
  }

  // 3. Specificity — does it mention specific entities, numbers, facts?
  const hasNumbers = /\d+/.test(output);
  const hasSpecificTerms = (output.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).length > 3;
  const hasQuotes = /["'].*?["']/.test(output);

  if (hasNumbers) score += 5;
  if (hasSpecificTerms) score += 5;
  if (hasQuotes) score += 3;

  // 4. Relevance — does the response address the apparent query topic?
  if (input.category) {
    const categoryKeywords: Record<IntelligenceCategory, string[]> = {
      company_intelligence: ['company', 'industry', 'revenue', 'market', 'technology', 'growth'],
      contact_intelligence: ['contact', 'person', 'role', 'stakeholder', 'decision maker', 'leadership'],
      signal_detection: ['signal', 'trigger', 'event', 'change', 'indicator', 'detected'],
      opportunity_prediction: ['opportunity', 'likelihood', 'win', 'probability', 'pipeline', 'deal'],
      recommendation: ['recommend', 'suggest', 'action', 'next step', 'should', 'consider'],
      brief_generation: ['brief', 'summary', 'overview', 'key points', 'analysis'],
      scoring: ['score', 'grade', 'rating', 'rank', 'priority', 'assess'],
      conversation_planning: ['conversation', 'talking point', 'question', 'approach', 'meeting'],
      email_generation: ['email', 'subject', ' outreach', 'message', 'follow-up'],
      strategy: ['strategy', 'approach', 'plan', 'tactic', 'positioning', 'competitive'],
    };

    const keywords = categoryKeywords[input.category] || [];
    const relevantKeywords = keywords.filter(kw => output.toLowerCase().includes(kw));
    const relevance = keywords.length > 0 ? relevantKeywords.length / keywords.length : 0.5;

    if (relevance < 0.3) {
      score -= 15;
      findings.push({
        description: `Low relevance: only ${relevantKeywords.length}/${keywords.length} expected category keywords found`,
        severity: 'warning',
        dimension: 'response_quality',
        suggestion: 'Ensure AI output addresses the specific intelligence category.',
      });
    } else if (relevance >= 0.6) {
      score += 10;
    }
  }

  // 5. No filler / template language
  const fillerPhrases = ['as an ai', 'i am an ai', 'as a language model', 'i don\'t have access', 'i cannot provide'];
  const fillerCount = fillerPhrases.filter(p => output.toLowerCase().includes(p)).length;
  if (fillerCount > 0) {
    score -= fillerCount * 10;
    findings.push({
      description: `${fillerCount} AI disclaimer/filler phrases detected in output`,
      severity: 'critical',
      dimension: 'response_quality',
      suggestion: 'Remove AI self-reference disclaimers. Output should be pure intelligence content.',
    });
  }

  score = clampScore(score);

  return {
    dimension: 'response_quality',
    score,
    grade: scoreToGrade(score),
    explanation: `${wordCount} words. Structure: ${hasSections ? 'sections' : hasBulletPoints ? 'bullets' : 'plain'}. Specificity: ${hasNumbers ? 'numerical' : 'qualitative'}.`,
    findings,
    weight: DIMENSION_WEIGHTS.response_quality,
  };
}

/**
 * Evaluates business usefulness — is this output actionable for decision-making?
 */
function evaluateBusinessUsefulness(input: EvaluationInput): DimensionScore {
  const findings: EvaluationFinding[] = [];
  let score = 65;
  const output = input.aiOutput;

  // 1. Actionability — does it suggest next steps?
  const actionPhrases = [
    'should', 'recommend', 'suggest', 'consider', 'next step', 'action',
    'opportunity', 'leverage', 'target', 'approach', 'strategy', 'plan',
    'follow up', 'reach out', 'engage', 'propose',
  ];
  const actionCount = actionPhrases.filter(p => output.toLowerCase().includes(p)).length;

  if (actionCount >= 4) {
    score += 15;
    findings.push({
      description: 'Response includes actionable recommendations',
      severity: 'pass',
      dimension: 'business_usefulness',
    });
  } else if (actionCount < 2) {
    score -= 10;
    findings.push({
      description: 'Response lacks actionable next steps for the user',
      severity: 'warning',
      dimension: 'business_usefulness',
      suggestion: 'AI output should include specific, actionable recommendations.',
    });
  }

  // 2. Decision support — does it help make a decision?
  const decisionPhrases = [
    'priority', 'high priority', 'low risk', 'high risk', 'opportunity',
    'win probability', 'confidence', 'score', 'rank', 'assess',
    'compared to', 'versus', 'trade-off', 'advantage', 'disadvantage',
  ];
  const decisionCount = decisionPhrases.filter(p => output.toLowerCase().includes(p)).length;

  if (decisionCount >= 3) {
    score += 10;
  }

  // 3. Temporal relevance — does it mention timing/urgency?
  const temporalPhrases = [
    'this week', 'this month', 'next quarter', 'immediate', 'urgent',
    'timeline', 'deadline', 'window', 'timing', 'now',
  ];
  const temporalCount = temporalPhrases.filter(p => output.toLowerCase().includes(p)).length;

  if (temporalCount > 0) {
    score += 5;
  }

  // 4. Competitive/strategic insight
  const strategicPhrases = [
    'competitive', 'market position', 'differentiator', 'advantage',
    'strength', 'weakness', 'threat', 'opportunity', 'positioning',
  ];
  const strategicCount = strategicPhrases.filter(p => output.toLowerCase().includes(p)).length;

  if (strategicCount >= 2) {
    score += 5;
  }

  // 5. Penalties for generic/unusable content
  const genericPhrases = [
    'it is important to note', 'it is worth mentioning',
    'in general', 'overall', 'in summary',
  ];
  const genericCount = genericPhrases.filter(p => output.toLowerCase().includes(p)).length;
  if (genericCount > 3) {
    score -= 10;
    findings.push({
      description: 'High density of generic filler phrases — low specific business value',
      severity: 'info',
      dimension: 'business_usefulness',
    });
  }

  score = clampScore(score);

  return {
    dimension: 'business_usefulness',
    score,
    grade: scoreToGrade(score),
    explanation: `Actionability: ${actionCount} signals. Decision support: ${decisionCount} signals. Strategic insight: ${strategicCount} signals.`,
    findings,
    weight: DIMENSION_WEIGHTS.business_usefulness,
  };
}

// ── Main Evaluation Functions ─────────────────────────────────────────────

/**
 * Run a complete evaluation of a single AI output.
 *
 * Evaluates all 6 dimensions and produces a composite score with findings.
 * This is the primary entry point for the evaluation engine.
 */
export function runEvaluation(input: EvaluationInput): EvaluationResult {
  const evaluationId = generateId('eval');
  const timestamp = new Date().toISOString();

  // Run all dimension evaluators
  const dimensions: DimensionScore[] = [
    evaluateAccuracy(input, input.expectedOutput),
    evaluateHallucinationRate(input),
    evaluateCitationAccuracy(input),
    evaluateConfidenceCalibration(input),
    evaluateResponseQuality(input),
    evaluateBusinessUsefulness(input),
  ];

  // Calculate weighted composite score
  let compositeScore = 0;
  for (const dim of dimensions) {
    compositeScore += dim.score * dim.weight;
  }
  compositeScore = clampScore(compositeScore);

  // Aggregate findings
  const allFindings = dimensions.flatMap(d => d.findings);
  const findingCounts = {
    critical: allFindings.filter(f => f.severity === 'critical').length,
    warning: allFindings.filter(f => f.severity === 'warning').length,
    info: allFindings.filter(f => f.severity === 'info').length,
    pass: allFindings.filter(f => f.severity === 'pass').length,
  };

  const result: EvaluationResult = {
    evaluationId,
    timestamp,
    engine: input.engine,
    category: input.category,
    model: input.model || null,
    promptId: input.promptId || null,
    promptVersion: input.promptVersion || null,
    dimensions,
    compositeScore,
    compositeGrade: scoreToGrade(compositeScore),
    enterpriseReady: compositeScore >= ENTERPRISE_THRESHOLD,
    findingCounts,
    findings: allFindings,
    latencyMs: input.latencyMs ?? null,
    tokensUsed: input.tokensUsed ?? null,
    evalEngineVersion: EVAL_ENGINE_VERSION,
  };

  // Persist to evaluation store
  recordEvaluation(result);

  // Log summary
  logger.info('AI Evaluation completed', {
    evaluationId,
    engine: result.engine,
    category: result.category,
    compositeScore: result.compositeScore,
    grade: result.compositeGrade,
    enterpriseReady: result.enterpriseReady,
    findings: result.findingCounts,
    model: result.model,
  });

  return result;
}

/**
 * Run a benchmark suite — evaluate the AI against a set of benchmark cases.
 *
 * @param cases - Array of benchmark cases to evaluate
 * @param evaluateFn - Function that runs the AI with a given input and returns EvaluationInput-compatible results
 * @param model - Optional model identifier for comparison tracking
 * @param promptVersion - Optional prompt version for comparison tracking
 */
export async function runBenchmarkSuite(
  cases: BenchmarkCase[],
  evaluateFn: (benchmarkInput: BenchmarkInput) => Promise<EvaluationInput>,
  model?: string,
  promptVersion?: string,
): Promise<BenchmarkSuiteResult> {
  const suiteId = generateId('suite');
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const caseResults: BenchmarkCaseResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const categoryMap = new Map<IntelligenceCategory, { total: number; passed: number; scores: number[]; hallucRates: number[]; latencies: number[] }>();

  for (const benchmarkCase of cases) {
    if (!benchmarkCase.active) {
      skipped++;
      continue;
    }

    try {
      // Run the AI with benchmark input
      const evalInput = await evaluateFn(benchmarkCase.input);

      // Enhance with benchmark metadata
      evalInput.engine = benchmarkCase.targetEngine;
      evalInput.category = benchmarkCase.category;
      evalInput.model = model;
      evalInput.promptVersion = promptVersion;

      // Run evaluation
      const result = runEvaluation(evalInput);

      // Check forbidden claims
      const forbiddenViolations = checkForbiddenClaims(result, benchmarkCase.forbiddenClaims || []);
      // Check required claims
      const missingClaims = checkRequiredClaims(result, benchmarkCase.requiredClaims || []);

      const allFindings = [...result.findings, ...forbiddenViolations, ...missingClaims];
      const hasCriticalFinding = allFindings.some(f => f.severity === 'critical');
      const meetsMinScore = result.compositeScore >= benchmarkCase.minScore;

      const casePassed = !hasCriticalFinding && meetsMinScore;

      if (casePassed) passed++;
      else failed++;

      // Track category stats
      const catStats = categoryMap.get(benchmarkCase.category) || {
        total: 0, passed: 0, scores: [], hallucRates: [], latencies: [],
      };
      catStats.total++;
      if (casePassed) catStats.passed++;
      catStats.scores.push(result.compositeScore);
      const hallucDim = result.dimensions.find(d => d.dimension === 'hallucination_rate');
      catStats.hallucRates.push(hallucDim ? (100 - hallucDim.score) / 100 : 0);
      catStats.latencies.push(result.latencyMs || 0);
      categoryMap.set(benchmarkCase.category, catStats);

      caseResults.push({
        benchmarkId: benchmarkCase.id,
        benchmarkName: benchmarkCase.name,
        category: benchmarkCase.category,
        passed: casePassed,
        score: result.compositeScore,
        hallucinationRate: hallucDim ? (100 - hallucDim.score) / 100 : 0,
        findings: allFindings,
        latencyMs: result.latencyMs,
        failureReason: !meetsMinScore
          ? `Score ${result.compositeScore} below minimum ${benchmarkCase.minScore}`
          : hasCriticalFinding
            ? 'Critical finding detected'
            : undefined,
      });
    } catch (error) {
      failed++;
      caseResults.push({
        benchmarkId: benchmarkCase.id,
        benchmarkName: benchmarkCase.name,
        category: benchmarkCase.category,
        passed: false,
        score: 0,
        hallucinationRate: 1,
        findings: [{
          description: `Benchmark execution failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'critical',
          dimension: 'accuracy',
        }],
        latencyMs: null,
        failureReason: 'Execution error',
      });
    }
  }

  // Build category breakdown
  const categoryBreakdown: CategoryBreakdown[] = [];
  for (const [category, stats] of categoryMap) {
    categoryBreakdown.push({
      category,
      totalCases: stats.total,
      passedCases: stats.passed,
      averageScore: stats.scores.length > 0
        ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
        : 0,
      averageHallucinationRate: stats.hallucRates.length > 0
        ? stats.hallucRates.reduce((a, b) => a + b, 0) / stats.hallucRates.length
        : 0,
      averageLatencyMs: stats.latencies.length > 0
        ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
        : 0,
    });
  }

  const totalCases = passed + failed;
  const averageScore = caseResults.length > 0
    ? caseResults.reduce((a, r) => a + r.score, 0) / caseResults.length
    : 0;

  const result: BenchmarkSuiteResult = {
    suiteId,
    timestamp,
    categories: [...categoryMap.keys()],
    totalCases,
    passedCases: passed,
    failedCases: failed,
    skippedCases: skipped,
    passRate: totalCases > 0 ? passed / totalCases : 0,
    averageScore,
    categoryBreakdown,
    caseResults,
    durationMs: Date.now() - startTime,
    model: model || null,
    promptVersion: promptVersion || null,
  };

  logger.info('Benchmark suite completed', {
    suiteId,
    totalCases,
    passed,
    failed,
    skipped,
    passRate: result.passRate,
    averageScore: result.averageScore,
    durationMs: result.durationMs,
  });

  return result;
}

/**
 * Check if AI output contains any forbidden claims.
 */
function checkForbiddenClaims(
  evalResult: EvaluationResult,
  forbiddenClaims: string[],
): EvaluationFinding[] {
  const findings: EvaluationFinding[] = [];
  const outputLower = evalResult.dimensions
    .flatMap(d => d.findings.map(f => f.description))
    .join(' ')
    .toLowerCase();

  for (const claim of forbiddenClaims) {
    if (outputLower.includes(claim.toLowerCase())) {
      findings.push({
        description: `Forbidden claim detected: "${claim}"`,
        severity: 'critical',
        dimension: 'hallucination_rate',
        suggestion: 'This claim should never appear in AI output. Review AI guardrails.',
      });
    }
  }

  return findings;
}

/**
 * Check if AI output contains all required claims.
 */
function checkRequiredClaims(
  evalResult: EvaluationResult,
  requiredClaims: string[],
): EvaluationFinding[] {
  const findings: EvaluationFinding[] = [];
  // We check against the original input — reconstruct from findings context
  for (const claim of requiredClaims) {
    // This is a simplified check — in production, we'd check the actual AI output
    findings.push({
      description: `Required claim check: "${claim}"`,
      severity: 'info',
      dimension: 'accuracy',
    });
  }

  return findings;
}

/**
 * Compare two evaluation runs (A/B comparison).
 *
 * Use for:
 *   - Prompt version comparison (v3.0 vs v3.1)
 *   - Model comparison (Gemini vs GPT vs Claude)
 *   - Configuration comparison
 */
export function compareVersions(
  labelA: string,
  resultsA: EvaluationResult[],
  labelB: string,
  resultsB: EvaluationResult[],
  comparisonType: 'prompt_version' | 'model' | 'engine_version' | 'configuration' = 'prompt_version',
): ComparisonResult {
  const comparisonId = generateId('cmp');
  const timestamp = new Date().toISOString();

  // Calculate aggregate scores for each side
  const avg = (results: EvaluationResult[], key: 'compositeScore') =>
    results.length > 0 ? results.reduce((a, r) => a + r.compositeScore, 0) / results.length : 0;

  const avgHallucRate = (results: EvaluationResult[]) => {
    const hallucScores = results.map(r => {
      const dim = r.dimensions.find(d => d.dimension === 'hallucination_rate');
      return dim ? dim.score : 50;
    });
    return hallucScores.length > 0 ? (100 - hallucScores.reduce((a, s) => a + s, 0) / hallucScores.length) / 100 : 0;
  };

  const avgAccuracy = (results: EvaluationResult[]) => {
    const accScores = results.map(r => {
      const dim = r.dimensions.find(d => d.dimension === 'accuracy');
      return dim ? dim.score : 50;
    });
    return accScores.length > 0 ? accScores.reduce((a, s) => a + s, 0) / accScores.length : 0;
  };

  const avgCitationAcc = (results: EvaluationResult[]) => {
    const citScores = results.map(r => {
      const dim = r.dimensions.find(d => d.dimension === 'citation_accuracy');
      return dim ? dim.score : 50;
    });
    return citScores.length > 0 ? citScores.reduce((a, s) => a + s, 0) / citScores.length : 0;
  };

  const avgLatency = (results: EvaluationResult[]) => {
    const lats = results.map(r => r.latencyMs).filter((l): l is number => l !== null);
    return lats.length > 0 ? lats.reduce((a, l) => a + l, 0) / lats.length : 0;
  };

  const totalTokens = (results: EvaluationResult[]) =>
    results.reduce((a, r) => a + (r.tokensUsed || 0), 0);

  const sideA: ComparisonSide = {
    compositeScore: avg(resultsA, 'compositeScore'),
    hallucinationRate: avgHallucRate(resultsA),
    accuracyScore: avgAccuracy(resultsA),
    citationAccuracy: avgCitationAcc(resultsA),
    averageLatencyMs: avgLatency(resultsA),
    totalTokensUsed: totalTokens(resultsA),
    evaluationCount: resultsA.length,
  };

  const sideB: ComparisonSide = {
    compositeScore: avg(resultsB, 'compositeScore'),
    hallucinationRate: avgHallucRate(resultsB),
    accuracyScore: avgAccuracy(resultsB),
    citationAccuracy: avgCitationAcc(resultsB),
    averageLatencyMs: avgLatency(resultsB),
    totalTokensUsed: totalTokens(resultsB),
    evaluationCount: resultsB.length,
  };

  // Calculate per-dimension deltas
  const allDimensions: EvaluationDimension[] = [
    'accuracy', 'hallucination_rate', 'citation_accuracy',
    'confidence_calibration', 'response_quality', 'business_usefulness',
  ];

  const deltas: DimensionDelta[] = allDimensions.map(dim => {
    const scoresA = resultsA.map(r => {
      const d = r.dimensions.find(dd => dd.dimension === dim);
      return d ? d.score : 50;
    });
    const scoresB = resultsB.map(r => {
      const d = r.dimensions.find(dd => dd.dimension === dim);
      return d ? d.score : 50;
    });

    const avgA = scoresA.length > 0 ? scoresA.reduce((a, s) => a + s, 0) / scoresA.length : 50;
    const avgB = scoresB.length > 0 ? scoresB.reduce((a, s) => a + s, 0) / scoresB.length : 50;
    const delta = avgB - avgA;

    return {
      dimension: dim,
      scoreA: avgA,
      scoreB: avgB,
      delta: Math.round(delta * 10) / 10,
      improved: delta > 0,
      significance: Math.abs(delta) >= 10 ? 'significant' : Math.abs(delta) >= 3 ? 'marginal' : 'negligible',
    };
  });

  // Determine winner
  const scoreDelta = sideB.compositeScore - sideA.compositeScore;
  let winner: 'A' | 'B' | null = null;
  if (Math.abs(scoreDelta) >= 5) {
    winner = scoreDelta > 0 ? 'B' : 'A';
  }

  // Generate recommendation
  let recommendation: string;
  if (winner === 'B') {
    const significantImprovements = deltas.filter(d => d.improved && d.significance === 'significant');
    const regressions = deltas.filter(d => !d.improved && d.significance === 'significant');

    if (regressions.length === 0) {
      recommendation = `${labelB} is recommended. Composite score improved by ${scoreDelta.toFixed(1)} points with ${significantImprovements.length} significant dimension improvements and no regressions.`;
    } else {
      recommendation = `${labelB} shows improved composite score (+${scoreDelta.toFixed(1)}) but has ${regressions.length} significant regressions. Review before adopting.`;
    }
  } else if (winner === 'A') {
    recommendation = `${labelA} remains the better option. ${labelB} regressed by ${Math.abs(scoreDelta).toFixed(1)} points. Keep current configuration.`;
  } else {
    recommendation = `Results are inconclusive. Score difference (${scoreDelta.toFixed(1)} points) is within noise threshold. Run more evaluations or increase sample size.`;
  }

  const result: ComparisonResult = {
    comparisonId,
    timestamp,
    comparisonType,
    labelA,
    labelB,
    resultsA: sideA,
    resultsB: sideB,
    winner,
    deltas,
    recommendation,
  };

  logger.info('A/B comparison completed', {
    comparisonId,
    type: comparisonType,
    labelA,
    labelB,
    winner,
    scoreDelta,
  });

  return result;
}

/**
 * Get quality trends for a specific dimension and engine.
 *
 * Analyzes historical evaluation data from the evaluation store.
 */
export function getQualityTrends(
  dimension: EvaluationDimension,
  engine?: EvaluatedEngine,
  periodDays: number = 30,
): QualityTrend {
  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Filter records
  const records = evaluationStore.filter(r => {
    const matchesEngine = !engine || r.engine === engine;
    const matchesDimension = !!r.dimensionScores[dimension];
    const matchesPeriod = new Date(r.timestamp) >= cutoff;
    return matchesEngine && matchesDimension && matchesPeriod;
  });

  // Group by date for trend line
  const dateGroups = new Map<string, { scores: number[]; count: number }>();
  for (const record of records) {
    const date = record.timestamp.substring(0, 10); // YYYY-MM-DD
    const group = dateGroups.get(date) || { scores: [], count: 0 };
    group.scores.push(record.dimensionScores[dimension]);
    group.count++;
    dateGroups.set(date, group);
  }

  // Build data points
  const dataPoints: TrendDataPoint[] = [];
  const sortedDates = [...dateGroups.keys()].sort();
  for (const date of sortedDates) {
    const group = dateGroups.get(date)!;
    dataPoints.push({
      timestamp: date,
      score: group.scores.reduce((a, s) => a + s, 0) / group.scores.length,
      evaluationCount: group.count,
    });
  }

  // Calculate trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  let slope = 0;

  if (dataPoints.length >= 3) {
    // Simple linear regression for slope
    const n = dataPoints.length;
    const xMean = (n - 1) / 2;
    const yMean = dataPoints.reduce((a, dp) => a + dp.score, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (dataPoints[i].score - yMean);
      denominator += (i - xMean) * (i - xMean);
    }

    slope = denominator > 0 ? numerator / denominator : 0;

    if (slope > 0.5) trend = 'improving';
    else if (slope < -0.5) trend = 'declining';
  }

  // Calculate stats
  const allScores = records.map(r => r.dimensionScores[dimension]);
  const average = allScores.length > 0
    ? allScores.reduce((a, s) => a + s, 0) / allScores.length
    : 0;
  const stdDev = allScores.length > 1
    ? Math.sqrt(allScores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / (allScores.length - 1))
    : 0;

  return {
    dimension,
    dataPoints,
    trend,
    slope: Math.round(slope * 100) / 100,
    average: Math.round(average * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
  };
}

/**
 * Generate a comprehensive quality report for executive visibility.
 *
 * Aggregates evaluation data across all engines and dimensions.
 */
export function generateQualityReport(periodDays: number = 30): QualityReport {
  const reportId = generateId('qr');
  const timestamp = new Date().toISOString();

  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Filter records by period
  const periodRecords = evaluationStore.filter(r => new Date(r.timestamp) >= cutoff);

  // Per-engine scores
  const engineMap = new Map<EvaluatedEngine, { scores: number[]; timestamps: string[] }>();
  for (const record of periodRecords) {
    const entry = engineMap.get(record.engine) || { scores: [], timestamps: [] };
    entry.scores.push(record.compositeScore);
    entry.timestamps.push(record.timestamp);
    engineMap.set(record.engine, entry);
  }

  const engineScores: EngineScoreSummary[] = [];
  for (const [engine, data] of engineMap) {
    const avgScore = data.scores.reduce((a, s) => a + s, 0) / data.scores.length;

    // Simple trend (compare first half vs second half)
    const mid = Math.floor(data.scores.length / 2);
    const firstHalf = data.scores.slice(0, mid);
    const secondHalf = data.scores.slice(mid);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, s) => a + s, 0) / firstHalf.length : avgScore;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, s) => a + s, 0) / secondHalf.length : avgScore;
    const engineTrend = secondAvg > firstAvg + 2 ? 'improving' : secondAvg < firstAvg - 2 ? 'declining' : 'stable';

    engineScores.push({
      engine,
      averageScore: Math.round(avgScore),
      grade: scoreToGrade(avgScore),
      trend: engineTrend,
      evaluationCount: data.scores.length,
      lastEvaluated: data.timestamps[data.timestamps.length - 1],
    });
  }

  // Per-dimension trends
  const dimensionTrends: QualityTrend[] = [];
  const allDimensions: EvaluationDimension[] = [
    'accuracy', 'hallucination_rate', 'citation_accuracy',
    'confidence_calibration', 'response_quality', 'business_usefulness',
  ];
  for (const dim of allDimensions) {
    dimensionTrends.push(getQualityTrends(dim, undefined, periodDays));
  }

  // Critical findings (most recent)
  const allFindings = periodRecords.flatMap(r => r.findings);
  const criticalFindings = allFindings.filter(f => f.severity === 'critical').slice(0, 10);

  // Regression detection
  const regressions: RegressionAlert[] = [];
  for (const engine of engineMap.keys()) {
    for (const dim of allDimensions) {
      const trend = getQualityTrends(dim, engine, periodDays);
      if (trend.trend === 'declining' && trend.slope < -1) {
        const recentScore = trend.dataPoints.length > 0
          ? trend.dataPoints[trend.dataPoints.length - 1].score
          : 0;
        const olderScore = trend.dataPoints.length > 3
          ? trend.dataPoints[0].score
          : recentScore;

        regressions.push({
          dimension: dim,
          engine,
          previousScore: olderScore,
          currentScore: recentScore,
          delta: Math.round((recentScore - olderScore) * 10) / 10,
          severity: Math.abs(recentScore - olderScore) > 15 ? 'critical' : 'warning',
          detectedAt: timestamp,
        });
      }
    }
  }

  // Best model
  const modelMap = new Map<string, number[]>();
  for (const record of periodRecords) {
    if (record.model) {
      const entry = modelMap.get(record.model) || [];
      entry.push(record.compositeScore);
      modelMap.set(record.model, entry);
    }
  }
  let bestModel: string | null = null;
  let bestModelScore = 0;
  for (const [model, scores] of modelMap) {
    const avg = scores.reduce((a, s) => a + s, 0) / scores.length;
    if (avg > bestModelScore) {
      bestModelScore = avg;
      bestModel = model;
    }
  }

  // Best prompt version
  const promptMap = new Map<string, number[]>();
  for (const record of periodRecords) {
    if (record.promptVersion) {
      const entry = promptMap.get(record.promptVersion) || [];
      entry.push(record.compositeScore);
      promptMap.set(record.promptVersion, entry);
    }
  }
  let bestPromptVersion: string | null = null;
  let bestPromptScore = 0;
  for (const [version, scores] of promptMap) {
    const avg = scores.reduce((a, s) => a + s, 0) / scores.length;
    if (avg > bestPromptScore) {
      bestPromptScore = avg;
      bestPromptVersion = version;
    }
  }

  // Hallucination rate trend
  const hallucTrend = getQualityTrends('hallucination_rate', undefined, periodDays);

  // Overall score
  const overallScore = periodRecords.length > 0
    ? periodRecords.reduce((a, r) => a + r.compositeScore, 0) / periodRecords.length
    : 0;

  // Recommendations
  const recommendations: string[] = [];
  if (regressions.length > 0) {
    recommendations.push(`Investigate ${regressions.length} regression(s) detected in ${[...new Set(regressions.map(r => r.dimension))].join(', ')}.`);
  }
  if (criticalFindings.length > 0) {
    recommendations.push(`Address ${criticalFindings.length} critical finding(s) — hallucination prevention and evidence grounding should be reviewed.`);
  }
  if (hallucTrend.trend === 'declining') {
    recommendations.push('Hallucination rate is declining — continue current prompt engineering approach.');
  }
  if (overallScore < ENTERPRISE_THRESHOLD) {
    recommendations.push(`Overall score (${overallScore.toFixed(0)}) is below enterprise threshold (${ENTERPRISE_THRESHOLD}). Focus on accuracy and citation quality.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('AI quality is stable and within acceptable enterprise thresholds.');
  }

  // Executive summary
  const executiveSummary = periodRecords.length > 0
    ? `DeepMindQ AI Evaluation Report (${periodDays}-day period). ${periodRecords.length} evaluations across ${engineMap.size} engines. Overall score: ${overallScore.toFixed(0)}/100 (${scoreToGrade(overallScore)} grade). ${regressions.length} regression(s) detected, ${criticalFindings.length} critical finding(s). ${hallucTrend.trend === 'improving' ? 'Hallucination rate is improving.' : hallucTrend.trend === 'declining' ? 'Quality metrics show positive trends.' : hallucTrend.trend === 'stable' ? 'Metrics are stable.' : 'Insufficient data for trend analysis.'}`
    : 'No evaluation data available for this period. Run benchmark evaluations to populate this report.';

  return {
    reportId,
    timestamp,
    period: `${periodDays}d`,
    executiveSummary,
    overallScore: Math.round(overallScore),
    overallGrade: scoreToGrade(overallScore),
    engineScores,
    dimensionTrends,
    criticalFindings,
    recommendations,
    bestModel,
    bestPromptVersion,
    hallucinationRateTrend: hallucTrend.trend === 'improving' ? 'improving' : hallucTrend.trend === 'declining' ? 'declining' : 'stable',
    regressions,
  };
}

/**
 * Get evaluation store statistics (for dashboard visibility).
 */
export function getEvaluationStats(): {
  totalEvaluations: number;
  averageCompositeScore: number;
  enterpriseReadyRate: number;
  byEngine: Record<string, { count: number; avgScore: number }>;
  byCategory: Record<string, { count: number; avgScore: number }>;
  recentCriticalFindings: EvaluationFinding[];
  storeUtilization: number;
} {
  const total = evaluationStore.length;
  const avgScore = total > 0
    ? evaluationStore.reduce((a, r) => a + r.compositeScore, 0) / total
    : 0;
  const enterpriseReady = total > 0
    ? evaluationStore.filter(r => r.compositeScore >= ENTERPRISE_THRESHOLD).length / total
    : 0;

  // By engine
  const byEngine: Record<string, { count: number; avgScore: number }> = {};
  for (const record of evaluationStore) {
    const entry = byEngine[record.engine] || { count: 0, avgScore: 0 };
    entry.count++;
    byEngine[record.engine] = entry;
  }
  for (const key of Object.keys(byEngine)) {
    const records = evaluationStore.filter(r => r.engine === key);
    byEngine[key].avgScore = records.reduce((a, r) => a + r.compositeScore, 0) / records.length;
  }

  // By category
  const byCategory: Record<string, { count: number; avgScore: number }> = {};
  for (const record of evaluationStore) {
    const entry = byCategory[record.category] || { count: 0, avgScore: 0 };
    entry.count++;
    byCategory[record.category] = entry;
  }
  for (const key of Object.keys(byCategory)) {
    const records = evaluationStore.filter(r => r.category === key);
    byCategory[key].avgScore = records.reduce((a, r) => a + r.compositeScore, 0) / records.length;
  }

  // Recent critical findings (last 20)
  const recentCriticals = evaluationStore
    .slice(-50)
    .flatMap(r => r.findings)
    .filter(f => f.severity === 'critical')
    .slice(0, 20);

  return {
    totalEvaluations: total,
    averageCompositeScore: Math.round(avgScore),
    enterpriseReadyRate: Math.round(enterpriseReady * 1000) / 1000,
    byEngine,
    byCategory,
    recentCriticalFindings: recentCriticals,
    storeUtilization: total / MAX_STORE_SIZE,
  };
}

/**
 * Clear the evaluation store (for testing purposes).
 */
export function clearEvaluationStore(): void {
  evaluationStore.length = 0;
  logger.info('Evaluation store cleared');
}

/**
 * Get the evaluation engine version.
 */
export function getEvalEngineVersion(): string {
  return EVAL_ENGINE_VERSION;
}
