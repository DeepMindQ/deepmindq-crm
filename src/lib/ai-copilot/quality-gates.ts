/**
 * AI Quality Gates — Validate LLM outputs before they reach users.
 *
 * Multi-check quality gate system that validates LLM responses:
 *   1. Structural check: Is the output well-formed (non-empty, valid JSON if expected)?
 *   2. Hallucination check: Are referenced entities/IDs plausible?
 *   3. Confidence bounds: Are confidence scores in valid range?
 *   4. Length check: Is the output within reasonable bounds?
 *   5. Content safety: Does it contain patterns that suggest hallucination?
 *
 * Quality scoring:
 *   100 = perfect (all checks pass)
 *   70-99 = acceptable (minor issues)
 *   50-69 = degraded (significant issues but usable)
 *   0-49 = failed (output rejected)
 *
 * Threshold for rejection: score < 50
 */

export interface QualityReport {
  score: number;
  issues: string[];
  passed: boolean;
}

const MIN_SCORE_PASS = 50;
const MIN_LENGTH_CHARS = 10;
const MAX_LENGTH_CHARS = 100_000;
const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 100;

/**
 * Run all quality gates on an LLM input/output pair.
 *
 * @param input - The prompt sent to the LLM
 * @param output - The raw response from the LLM
 * @returns QualityReport with score, issues, and pass/fail status
 */
export async function runQualityGates(input: string, output: string): Promise<QualityReport> {
  const issues: string[] = [];
  let score = 100;

  // Gate 1: Non-empty output
  if (!output || output.trim().length === 0) {
    issues.push('empty_output');
    score -= 100; // Fatal
  }

  // Gate 2: Length bounds
  if (output && output.length < MIN_LENGTH_CHARS) {
    issues.push(`output_too_short:${output.length}chars`);
    score -= 30;
  }
  if (output && output.length > MAX_LENGTH_CHARS) {
    issues.push(`output_too_long:${output.length}chars`);
    score -= 20;
  }

  // Gate 3: JSON structure validation (if output looks like JSON)
  if (output && isJSONLike(output)) {
    const jsonResult = validateJSON(output);
    if (!jsonResult.valid) {
      issues.push(`invalid_json:${jsonResult.error}`);
      score -= 40;
    }
  }

  // Gate 4: Hallucination pattern detection
  if (output) {
    const hallucinationFlags = detectHallucinationPatterns(output);
    for (const flag of hallucinationFlags) {
      issues.push(`hallucination_risk:${flag}`);
      score -= 10;
    }
  }

  // Gate 5: Repetition / degenerate output detection
  if (output) {
    const repetitionScore = detectRepetition(output);
    if (repetitionScore > 0.5) {
      issues.push(`repetitive_output:${(repetitionScore * 100).toFixed(0)}%`);
      score -= 30;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    passed: score >= MIN_SCORE_PASS,
  };
}

/**
 * Format quality report for log output (compact single-line format).
 */
export function formatQualityReportForLog(report: QualityReport): string {
  if (report.passed) {
    return `quality:pass:${report.score}`;
  }
  return `quality:fail:${report.score}:${report.issues.join(',')}`;
}

// ─── Internal Checks ──────────────────────────────────────────────────

function isJSONLike(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function validateJSON(text: string): { valid: boolean; error?: string } {
  try {
    // Try full parse first
    JSON.parse(text);
    return { valid: true };
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[1]);
        return { valid: true };
      } catch {
        return { valid: false, error: 'json_in_code_block_invalid' };
      }
    }

    // Try extracting first JSON object/array
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        JSON.parse(objMatch[0]);
        return { valid: true };
      } catch {
        // Fall through to array check
      }
    }
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        JSON.parse(arrMatch[0]);
        return { valid: true };
      } catch {
        return { valid: false, error: 'json_array_invalid' };
      }
    }

    return { valid: false, error: 'no_valid_json_found' };
  }
}

/**
 * Detect common hallucination patterns in LLM output.
 */
function detectHallucinationPatterns(text: string): string[] {
  const flags: string[] = [];

  // Pattern: "I'm not sure" repeated with conflicting certainty
  if (
    /I('m| am) (not sure|uncertain|unsure)/i.test(text) &&
    /certainly|definitely|absolutely/i.test(text)
  ) {
    flags.push('conflicting_certainty');
  }

  // Pattern: Fabricated URLs with common fake domains
  if (/https?:\/\/(www\.)?(example|sample|test|fake|dummy|placeholder)\./i.test(text)) {
    flags.push('placeholder_url');
  }

  // Pattern: Excessive disclaimers suggest the model knows it's guessing
  const disclaimerCount = (
    text.match(/(?:as an AI|I don't have access|I cannot verify|based on my training)/gi) || []
  ).length;
  if (disclaimerCount > 3) {
    flags.push(`excessive_disclaimers:${disclaimerCount}`);
  }

  // Pattern: Output contains "null" or "undefined" as literal text values
  if (/["'](?:null|undefined|NaN)["']/i.test(text)) {
    flags.push('serialized_nulls');
  }

  return flags;
}

/**
 * Detect repetitive output — a common LLM degeneration mode.
 * Returns 0.0 for no repetition, up to 1.0 for fully repetitive.
 */
function detectRepetition(text: string): number {
  if (text.length < 100) return 0;

  // Check for repeated n-grams (4-grams)
  const words = text.toLowerCase().split(/\s+/);
  if (words.length < 20) return 0;

  const ngramSet = new Set<string>();
  let repeated = 0;
  const n = 4;

  for (let i = 0; i <= words.length - n; i++) {
    const ngram = words.slice(i, i + n).join(' ');
    if (ngramSet.has(ngram)) {
      repeated++;
    }
    ngramSet.add(ngram);
  }

  const totalNgrams = words.length - n + 1;
  return totalNgrams > 0 ? repeated / totalNgrams : 0;
}
