/**
 * Hallucination Prevention Module
 * ════════════════════════════════════════════════════
 *
 * Lightweight, keyword-based hallucination detection layer for
 * KnowledgeAnswer objects from the Enterprise Knowledge Intelligence
 * engine (M5 WOW #4).
 *
 * No LLM calls — all verification is done via keyword matching
 * against the evidence that was retrieved alongside the answer.
 *
 * Three capabilities:
 *   1. Claim Verifier  — cross-references claims against evidence
 *   2. Answer Safety Scorer — computes a 0–100 safety score
 *   3. Hallucination Guard  — modifies answer text when risk is high
 */

import type { EvidenceDatum } from '@/lib/m5-wow4-knowledge-intelligence';

// ── Public Types ──────────────────────────────────────────────────────────────

export interface ClaimVerification {
  claim: string;
  status: 'verified' | 'partially_supported' | 'unsupported' | 'contradicted';
  supportingEvidence: string[]; // evidence IDs (indices) that support this claim
  confidence: number;
}

export interface AnswerSafetyReport {
  safetyScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  verifiedClaims: number;
  unsupportedClaims: number;
  contradictedClaims: number;
  recommendations: string[];
  safeToDisplay: boolean;
}

/** Extended KnowledgeAnswer type with safety fields (returned by guard). */
export interface SafetyAnnotatedAnswer {
  safetyReport: AnswerSafetyReport;
  hallucinationRisk: 'negligible' | 'low' | 'medium' | 'high';
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/** Common stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its',
  'their', 'they', 'them', 'we', 'our', 'us', 'you', 'your', 'he', 'she',
  'him', 'her', 'his', 'i', 'my', 'me', 'about', 'up', 'also',
]);

/** Negation words that signal contradiction. */
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nor', 'none', 'nothing',
  'nobody', 'nowhere', 'cannot', "can't", "don't", "doesn't",
  "didn't", "won't", "wouldn't", "shouldn't", "couldn't",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't",
  'failed', 'unsuccessful', 'incorrect', 'wrong', 'false',
]);

/**
 * Tokenize text into lowercase words, stripping punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Extract meaningful keywords from text by removing stop words.
 */
function extractKeywords(text: string): string[] {
  return tokenize(text).filter(w => !STOP_WORDS.has(w) && w.length > 1);
}

/**
 * Extract factual-sounding claims from answer text.
 *
 * Strategy: split by sentence boundaries, then keep sentences that contain
 * numbers, proper-noun-like terms (multi-word capitalized phrases),
 * or definitive statement patterns.
 */
export function extractClaims(answerText: string): string[] {
  // Split on sentence boundaries (period, exclamation, question mark)
  const sentences = answerText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // skip trivial fragments

  const claims: string[] = [];

  for (const sentence of sentences) {
    // Skip sentences that are meta-commentary or guidance (not factual claims)
    if (isMetaSentence(sentence)) continue;

    // Keep sentences that look factual:
    //  - Contain numbers (dates, percentages, counts)
    //  - Contain proper-noun-like multi-word terms (e.g., "OpenAI", "Healthcare AI")
    //  - Use definitive verbs followed by specifics
    if (isFactualSentence(sentence)) {
      claims.push(sentence);
    }
  }

  return claims;
}

/**
 * Detect sentences that are meta-commentary, guidance, or non-factual.
 */
function isMetaSentence(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  const metaPatterns = [
    /^based on \d+ evidence/i,
    /^no specific knowledge was found/i,
    /^the knowledge base /i,
    /^try a more specific query/i,
    /^available entity types/i,
    /^the knowledge base is currently empty/i,
    /^however, \d+ memory item/i,
    /organizational memory item\(s\) support this assessment/i,
    /^insufficient verified knowledge/i,
    /^\u26a0\ufe0f/i, // warning emoji
    /^\[hallucination risk/i,
  ];
  return metaPatterns.some(p => p.test(sentence));
}

/**
 * Determine if a sentence sounds like a factual claim rather than
 * a question, greeting, or vague statement.
 */
function isFactualSentence(sentence: string): boolean {
  // Contains a number → likely factual
  if (/\d/.test(sentence)) return true;

  // Contains multi-word capitalized phrase (proper noun)
  if (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)/.test(sentence)) return true;

  // Contains quoted entity name
  if (/"[^"]{3,}"/.test(sentence)) return true;

  // Contains definitive assertion patterns
  const definitivePatterns = [
    /(?:is|are|was|were)\s+(?:a|an|the|one of|among|known|considered|regarded|classified|recognized)/i,
    /(?:has|have|had)\s+(?:been|established|developed|achieved|implemented|adopted|deployed)/i,
    /(?:operates|provides|delivers|offers|produces|generates|manages|supports|enables)\s+/i,
    /(?:according to|based on|reported|found|shown|indicated|estimated|projected)/i,
    /(?:market|industry|sector|company|technology|platform|system)\s+\w+/i,
    /\$\d+|\d+%|\d+\s+(?:million|billion|thousand|units|employees)/i,
  ];

  return definitivePatterns.some(p => p.test(sentence));
}

// ── 1. Claim Verifier ──────────────────────────────────────────────────────────

/**
 * Cross-reference each claim against the available evidence.
 *
 * Returns a verification status per claim using keyword overlap.
 * This is intentionally lightweight — no LLM calls, just token matching.
 */
export function verifyClaims(
  claims: string[],
  evidence: EvidenceDatum[],
): ClaimVerification[] {
  // Pre-compute evidence keyword sets for efficiency
  const evidenceEntries = evidence.map((ev, idx) => ({
    idx,
    keywords: new Set(extractKeywords(ev.snippet + ' ' + ev.claim)),
    lowerSnippet: ev.snippet.toLowerCase(),
    lowerClaim: ev.claim.toLowerCase(),
    hasNegation: hasNegation(ev.snippet) || hasNegation(ev.claim),
  }));

  return claims.map(claim => {
    const claimKeywords = extractKeywords(claim);
    if (claimKeywords.length === 0) {
      return {
        claim,
        status: 'unsupported' as const,
        supportingEvidence: [],
        confidence: 0,
      };
    }

    const supportingIndices: string[] = [];
    let maxOverlap = 0;
    let totalOverlap = 0;
    let matchedEvidenceCount = 0;
    let contradicted = false;

    for (const ev of evidenceEntries) {
      let overlap = 0;
      for (const kw of claimKeywords) {
        if (ev.keywords.has(kw)) overlap++;
      }

      if (overlap > 0) {
        matchedEvidenceCount++;
        totalOverlap += overlap;
        maxOverlap = Math.max(maxOverlap, overlap);
        supportingIndices.push(`evidence_${ev.idx}`);

        // Check for contradiction: claim asserts something positive,
        // but evidence contains negation words near the shared keywords
        if (ev.hasNegation && overlap >= 2) {
          contradicted = true;
        }
      }
    }

    // Determine status
    const overlapRatio = claimKeywords.length > 0 ? maxOverlap / claimKeywords.length : 0;

    let status: ClaimVerification['status'];
    let confidence: number;

    if (contradicted) {
      status = 'contradicted';
      confidence = Math.round(Math.max(0, (1 - overlapRatio) * 100));
    } else if (matchedEvidenceCount === 0) {
      status = 'unsupported';
      confidence = 0;
    } else if (overlapRatio >= 0.5 && matchedEvidenceCount >= 2) {
      status = 'verified';
      confidence = Math.min(100, Math.round(overlapRatio * 80 + matchedEvidenceCount * 5));
    } else if (overlapRatio >= 0.3) {
      status = 'partially_supported';
      confidence = Math.round(overlapRatio * 60 + matchedEvidenceCount * 3);
    } else {
      status = 'partially_supported';
      confidence = Math.round(overlapRatio * 40 + matchedEvidenceCount * 2);
    }

    return {
      claim,
      status,
      supportingEvidence: supportingIndices,
      confidence: Math.min(100, Math.max(0, confidence)),
    };
  });
}

/**
 * Check if text contains negation words.
 */
function hasNegation(text: string): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  return words.some(w => NEGATION_WORDS.has(w));
}

// ── 2. Answer Safety Scorer ────────────────────────────────────────────────────

/**
 * Compute a 0–100 safety score for a KnowledgeAnswer.
 *
 * Checks:
 *   a. knowledgeFound flag
 *   b. Evidence count
 *   c. Verified/unsupported claim ratio
 *   d. Confidence score from the answer
 *   e. Evidence count threshold
 */
export function scoreAnswerSafety(answer: {
  knowledgeFound: boolean;
  evidence: EvidenceDatum[];
  confidence: { score: number };
  answer: string;
}): AnswerSafetyReport {
  // a. If no knowledge found → safety 0
  if (!answer.knowledgeFound) {
    return {
      safetyScore: 0,
      riskLevel: 'danger',
      verifiedClaims: 0,
      unsupportedClaims: 0,
      contradictedClaims: 0,
      recommendations: [
        'No knowledge was found for this query — the answer should not be treated as factual.',
        'Verify this information independently before making any decisions.',
      ],
      safeToDisplay: false,
    };
  }

  // b. If no evidence → safety 0
  if (answer.evidence.length === 0) {
    return {
      safetyScore: 0,
      riskLevel: 'danger',
      verifiedClaims: 0,
      unsupportedClaims: 0,
      contradictedClaims: 0,
      recommendations: [
        'This answer has no supporting evidence — verify independently.',
        'The knowledge base may not contain relevant data for this query.',
      ],
      safeToDisplay: false,
    };
  }

  // c. Extract claims and verify them
  const claims = extractClaims(answer.answer);
  const verifications = verifyClaims(claims, answer.evidence);

  const verifiedCount = verifications.filter(v => v.status === 'verified').length;
  const unsupportedCount = verifications.filter(v => v.status === 'unsupported').length;
  const contradictedCount = verifications.filter(v => v.status === 'contradicted').length;
  const partiallySupportedCount = verifications.filter(v => v.status === 'partially_supported').length;
  const totalClaims = verifications.length;

  // Compute score components
  let score = 0;

  // Component 1: Claim verification ratio (0–40 points)
  if (totalClaims > 0) {
    const verificationRatio = (verifiedCount + partiallySupportedCount * 0.5) / totalClaims;
    score += Math.round(verificationRatio * 40);
  } else {
    // No claims extracted — the answer is likely meta/guidance text
    score += 25; // neutral mid-ground
  }

  // Component 2: Confidence score (0–30 points)
  score += Math.round((answer.confidence.score / 100) * 30);

  // Component 3: Evidence count threshold (0–20 points)
  // At least 3 evidence items for full marks
  const evidenceScore = Math.min(1, answer.evidence.length / 3);
  score += Math.round(evidenceScore * 20);

  // Component 4: Contradiction penalty (-20 points)
  if (contradictedCount > 0) {
    score = Math.max(0, score - Math.min(20, contradictedCount * 10));
  }

  // Component 5: Unsupported claim penalty (-10 points)
  if (totalClaims > 0 && unsupportedCount > 0) {
    const unsupportedRatio = unsupportedCount / totalClaims;
    score = Math.max(0, score - Math.round(unsupportedRatio * 10));
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let riskLevel: AnswerSafetyReport['riskLevel'];
  if (score >= 70) riskLevel = 'safe';
  else if (score >= 50) riskLevel = 'caution';
  else if (score >= 30) riskLevel = 'warning';
  else riskLevel = 'danger';

  // Build recommendations
  const recommendations: string[] = [];

  if (contradictedCount > 0) {
    recommendations.push(
      `${contradictedCount} claim(s) are contradicted by available evidence — review carefully.`,
    );
  }
  if (unsupportedCount > 0) {
    recommendations.push(
      `${unsupportedCount} claim(s) lack supporting evidence in the knowledge base.`,
    );
  }
  if (partiallySupportedCount > 0 && verifiedCount === 0 && totalClaims > 0) {
    recommendations.push(
      'All claims are only partially supported — seek additional corroboration.',
    );
  }
  if (answer.evidence.length < 3) {
    recommendations.push(
      'Limited evidence available — the answer may be incomplete.',
    );
  }
  if (answer.confidence.score < 40) {
    recommendations.push(
      `Low confidence score (${answer.confidence.score}/100) — treat with caution.`,
    );
  }
  if (riskLevel === 'safe' && recommendations.length === 0) {
    recommendations.push('Answer passes all safety checks.');
  }

  return {
    safetyScore: score,
    riskLevel,
    verifiedClaims: verifiedCount,
    unsupportedClaims: unsupportedCount,
    contradictedClaims: contradictedCount,
    recommendations,
    safeToDisplay: score >= 50,
  };
}

// ── 3. Hallucination Guard ────────────────────────────────────────────────────

/**
 * Apply hallucination prevention guard to a KnowledgeAnswer.
 *
 * - Score < 10: Replace answer text entirely with a safety message.
 * - Score < 30: Prepend a clear warning to the answer text.
 * - Score >= 30: Pass through unchanged.
 *
 * Adds `_safetyReport` and `hallucinationRisk` to the returned object.
 */
export function guardAgainstHallucination<T extends {
  answer: string;
  knowledgeFound: boolean;
  evidence: EvidenceDatum[];
  confidence: { score: number };
}>(answer: T): T & SafetyAnnotatedAnswer {
  const safetyReport = scoreAnswerSafety(answer);

  let hallucinationRisk: SafetyAnnotatedAnswer['hallucinationRisk'];
  let modifiedAnswer = answer.answer;

  if (safetyReport.safetyScore >= 70) {
    hallucinationRisk = 'negligible';
  } else if (safetyReport.safetyScore >= 50) {
    hallucinationRisk = 'low';
  } else if (safetyReport.safetyScore >= 30) {
    hallucinationRisk = 'medium';
  } else {
    hallucinationRisk = 'high';
  }

  if (safetyReport.safetyScore < 10) {
    // Full replacement — answer is too risky to display
    modifiedAnswer =
      'Insufficient verified knowledge to answer this question. ' +
      'The knowledge base does not contain reliable evidence for this query.';
  } else if (safetyReport.safetyScore < 30) {
    // Prepend warning
    const warning =
      '⚠️ [Hallucination Risk: ' +
      hallucinationRisk.toUpperCase() +
      '] This answer has limited supporting evidence and may contain ' +
      'unverified claims. Verify independently before relying on this information.\n\n';
    modifiedAnswer = warning + answer.answer;
  }

  return {
    ...answer,
    answer: modifiedAnswer,
    safetyReport,
    hallucinationRisk,
  };
}
