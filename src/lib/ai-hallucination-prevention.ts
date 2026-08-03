/**
 * AI Hallucination Prevention Framework — WI-16B
 * ==================================================
 *
 * Post-generation hallucination detection and citation verification.
 * This complements the existing prompt-injection approach in ai-governance.ts
 * by validating AI OUTPUT after generation, not just instructing the LLM.
 *
 * Architecture:
 *
 *   Pre-Generation (existing): ai-governance.ts
 *     - 15 hallucination prevention rules injected into prompts
 *     - Confidence gates prevent low-quality generation
 *     - Evidence grounding notes injected
 *
 *   Post-Generation (this module — NEW):
 *     - Claim extraction from AI output
 *     - Citation verification against actual evidence
 *     - Factual consistency checking
 *     - Confidence calibration validation
 *     - Hallucination scoring with explainability
 *
 * NON-THROWING DESIGN: All functions return structured results, never throw.
 */

import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedClaim {
  /** The claim text extracted from AI output. */
  text: string;
  /** What type of claim this is. */
  type: 'revenue' | 'employee_count' | 'technology' | 'funding' | 'partnership' | 'leadership' | 'product' | 'hiring' | 'expansion' | 'general';
  /** The entity this claim is about (company name, person, etc.). */
  entity: string;
  /** The value/assertion in the claim. */
  value: string;
  /** Citation marker found near this claim (e.g. [E1], [E3]). */
  citationMarker: string | null;
  /** Confidence expressed in the claim text (e.g. "likely", "confirmed"). */
  expressedConfidence: 'high' | 'medium' | 'low' | 'hedged' | 'uncertain';
  /** Position in the original text (character offset). */
  position: number;
}

export interface CitationVerification {
  /** The citation marker (e.g. [E1]). */
  marker: string;
  /** Whether the evidence cited actually exists. */
  evidenceExists: boolean;
  /** Whether the claim aligns with the cited evidence. */
  claimAligns: boolean;
  /** How well the claim matches the evidence (0-1). */
  alignmentScore: number;
  /** The evidence text that was cited. */
  evidenceText: string | null;
  /** The source of the evidence. */
  evidenceSource: string | null;
  /** Explanation of why alignment passed or failed. */
  explanation: string;
}

export interface HallucinationCheckResult {
  /** Overall hallucination risk score (0-100, where 0 = no risk, 100 = high risk). */
  hallucinationRiskScore: number;
  /** Risk level classification. */
  riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  /** All claims extracted from the AI output. */
  claims: ExtractedClaim[];
  /** All citation verifications. */
  citationVerifications: CitationVerification[];
  /** Number of verified claims (aligned with evidence). */
  verifiedClaims: number;
  /** Number of unverified claims (no evidence or misaligned). */
  unverifiedClaims: number;
  /** Number of uncited claims (assertions without [En] markers). */
  uncitedClaims: number;
  /** Number of hallucinated citations (markers that don't map to real evidence). */
  hallucinatedCitations: number;
  /** Hedging language detected. */
  hedgingPatterns: string[];
  /** Specificity analysis. */
  specificityScore: number;
  /** Recommendations for improvement. */
  recommendations: string[];
  /** Whether the output passes the enterprise trust threshold. */
  passesTrustThreshold: boolean;
  /** Timestamp of the check. */
  timestamp: string;
}

export interface EvidenceContext {
  /** Map of citation marker → evidence text. */
  evidenceMap: Record<string, { text: string; source: string; url: string | null; confidence: number }>;
  /** Known facts about the entity (for factual consistency checking). */
  knownFacts?: Record<string, string>;
  /** Field confidence scores from the research context. */
  fieldConfidence?: Record<string, number>;
}

// ── Claim Extraction ────────────────────────────────────────────────────────

/**
 * Patterns for extracting verifiable claims from AI output.
 * Each pattern captures a claim type that can be fact-checked.
 */
const CLAIM_PATTERNS: Array<{
  type: ExtractedClaim['type'];
  pattern: RegExp;
  entityGroup: number;
  valueGroup: number;
}> = [
  // Revenue claims: "$50M revenue", "revenue of $50 million"
  { type: 'revenue', pattern: /\$[\d,.]+(?:\s*(?:million|billion|M|B))?|\d+(?:\.\d+)?\s*(?:million|billion)\s*(?:in\s+)?revenue/i, entityGroup: 0, valueGroup: 0 },
  // Employee count: "500 employees", "employs ~2,000"
  { type: 'employee_count', pattern: /(?:about|approximately|around|~)?\s*\d[\d,]*(?:\s*-\s*\d[\d,]*)?\s*(?:employees?|people|staff|workforce)/i, entityGroup: 0, valueGroup: 0 },
  // Technology usage: "uses AWS", "built on Kubernetes", "adopted React"
  { type: 'technology', pattern: /(?:uses?|uses?d|built\s+on|adopted?|deployed?|runs?\s+on|powered\s+by|leverages?|relies?\s+on)\s+(?:[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*|AWS|GCP|Azure|Kubernetes|Docker|React|Node\.js|Python|Java|PostgreSQL|MongoDB|Redis|Snowflake|Databricks|Salesforce|SAP|Oracle|Terraform)/i, entityGroup: 0, valueGroup: 0 },
  // Funding: "raised $100M", "Series C funding of $50M"
  { type: 'funding', pattern: /(?:raised|secured|received|announced)\s+(?:\$[\d,.]+(?:\s*(?:million|billion|M|B))?|a\s+)?(?:Series\s+[A-Z]|funding|investment|round)/i, entityGroup: 0, valueGroup: 0 },
  // Partnership: "partners with", "partnered with", "in partnership with"
  { type: 'partnership', pattern: /(?:partner(?:ed|s)?\s+with|in\s+partnership\s+with|joint\s+venture\s+with|collaborat(?:es?|ed|ion)\s+with)\s+[A-Z][a-zA-Z]+/i, entityGroup: 0, valueGroup: 0 },
  // Leadership: "CEO is", "led by", "appointed as", "named as"
  { type: 'leadership', pattern: /(?:CEO|CTO|CFO|COO|VP|Chief|Head|Director|President|Founder|Co-Founder)\s+(?:is|was|has\s+been)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/i, entityGroup: 0, valueGroup: 0 },
  // Hiring: "hiring for", "looking for", "recruiting", "job openings"
  { type: 'hiring', pattern: /(?:hiring|recruiting|looking\s+for|seeking|job\s+openings?|positions?\s+available)\s+(?:for\s+)?\d*/i, entityGroup: 0, valueGroup: 0 },
  // Expansion: "expanding into", "opened office in", "expanding to"
  { type: 'expansion', pattern: /(?:expand(?:ing|ed)?\s+(?:into|to|in)|open(?:ed|ing)?\s+(?:a\s+)?(?:new\s+)?office|launched\s+in)/i, entityGroup: 0, valueGroup: 0 },
];

/**
 * Extract verifiable claims from AI output text.
 */
export function extractClaims(text: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];

  for (const { type, pattern } of CLAIM_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const claimText = match[0];
      const position = match.index;

      // Detect citation marker near the claim (within 100 chars)
      const nearbyText = text.substring(Math.max(0, position - 50), Math.min(text.length, position + claimText.length + 50));
      const citationMatch = nearbyText.match(/\[(E\d+)\]/);
      const citationMarker = citationMatch ? citationMatch[1] : null;

      // Detect expressed confidence
      const expressedConfidence = detectClaimConfidence(claimText, nearbyText);

      // Extract entity (company name) from surrounding context
      const entity = extractEntity(text, position) || 'unknown';

      claims.push({
        text: claimText,
        type,
        entity,
        value: claimText,
        citationMarker,
        expressedConfidence,
        position,
      });
    }
  }

  return claims;
}

/**
 * Detect the confidence level expressed in a claim.
 */
function detectClaimConfidence(claimText: string, nearbyText: string): ExtractedClaim['expressedConfidence'] {
  const combined = `${claimText} ${nearbyText}`.toLowerCase();

  const uncertainPatterns = [
    /\bmay\b/, /\bmight\b/, /\bpossibly\b/, /\bpotentially\b/,
    /\bit appears?\b/, /\bseems?\b/, /\bcould\b/, /\bperhaps\b/,
    /\bsuggests?\b/, /\bindicates?\b/, /\bright be\b/, /\bspeculated?\b/,
    /\bunconfirmed\b/, /\balleged(?:ly)?\b/, /\brumor(?:ed|s)?\b/,
  ];

  const highConfidencePatterns = [
    /\bconfirm(?:ed|s)\b/, /\bannounced?\b/, /\bverified?\b/,
    /\bdefinite(?:ly|ly)\b/, /\bcertain(?:ly)?\b/, /\bclearly\b/,
  ];

  if (highConfidencePatterns.some(p => p.test(combined))) return 'high';
  if (uncertainPatterns.some(p => p.test(combined))) {
    // Count hedging patterns
    const hedgingCount = uncertainPatterns.filter(p => p.test(combined)).length;
    return hedgingCount >= 2 ? 'uncertain' : 'hedged';
  }

  return 'medium';
}

/**
 * Extract the entity (company name) from text near a claim.
 */
function extractEntity(text: string, position: number): string | null {
  // Look backward for capitalized multi-word phrase
  const before = text.substring(Math.max(0, position - 200), position);
  const entityMatch = before.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b(?!\s+(?:is|has|was|are|had|have|been|will|can|may|might))/);
  return entityMatch ? entityMatch[1] : null;
}

// ── Citation Verification ────────────────────────────────────────────────────

/**
 * Verify citations in AI output against actual evidence.
 * Checks:
 *   1. Does the citation marker reference real evidence?
 *   2. Does the claim align with what the evidence says?
 *   3. Is the alignment score above threshold?
 */
export function verifyCitations(
  claims: ExtractedClaim[],
  evidenceContext: EvidenceContext,
): CitationVerification[] {
  const verifications: CitationVerification[] = [];

  for (const claim of claims) {
    if (!claim.citationMarker) {
      // Uncited claim — no verification possible, but record it
      continue;
    }

    const marker = claim.citationMarker;
    const evidence = evidenceContext.evidenceMap[marker];

    if (!evidence) {
      // Citation marker doesn't map to any evidence — hallucinated citation
      verifications.push({
        marker,
        evidenceExists: false,
        claimAligns: false,
        alignmentScore: 0,
        evidenceText: null,
        evidenceSource: null,
        explanation: `Citation marker ${marker} does not reference any known evidence. This is a hallucinated citation.`,
      });
      continue;
    }

    // Evidence exists — check if claim aligns with evidence
    const alignmentScore = computeAlignment(claim.text, evidence.text);
    const threshold = 0.3; // Minimum alignment to be considered "aligned"

    verifications.push({
      marker,
      evidenceExists: true,
      claimAligns: alignmentScore >= threshold,
      alignmentScore,
      evidenceText: evidence.text.substring(0, 200),
      evidenceSource: evidence.source,
      explanation: alignmentScore >= threshold
        ? `Claim is supported by evidence (score: ${(alignmentScore * 100).toFixed(0)}%). Source: ${evidence.source}.`
        : `Claim may not be supported by evidence (score: ${(alignmentScore * 100).toFixed(0)}%). Evidence discusses: "${evidence.text.substring(0, 100)}..."`,
    });
  }

  return verifications;
}

/**
 * Compute alignment between a claim and evidence text.
 * Uses keyword overlap and semantic proximity heuristics.
 * (Future upgrade: use embedding cosine similarity for true semantic alignment)
 */
function computeAlignment(claim: string, evidence: string): number {
  // Extract key terms from claim (lowercased, filtered)
  const claimTerms = extractKeyTerms(claim);
  if (claimTerms.length === 0) return 0.5; // Default moderate alignment

  const evidenceLower = evidence.toLowerCase();

  // Count how many claim terms appear in evidence
  let matches = 0;
  let partialMatches = 0;

  for (const term of claimTerms) {
    if (evidenceLower.includes(term)) {
      matches++;
    } else {
      // Check for partial matches (stem overlap)
      const stem = term.substring(0, Math.min(term.length, 5));
      if (stem.length >= 3 && evidenceLower.includes(stem)) {
        partialMatches++;
      }
    }
  }

  const fullMatchScore = claimTerms.length > 0 ? matches / claimTerms.length : 0;
  const partialMatchScore = claimTerms.length > 0 ? partialMatches / (claimTerms.length * 2) : 0;

  return Math.min(1, fullMatchScore + partialMatchScore);
}

/**
 * Extract key terms from a claim for alignment checking.
 * Filters out common stop words and keeps meaningful terms.
 */
function extractKeyTerms(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
    'through', 'during', 'before', 'after', 'above', 'below', 'and', 'but',
    'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
    'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'it', 'its', 'their', 'they', 'them', 'we',
    'our', 'us', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'also',
    'recently', 'reportedly', 'according', 'approximately', 'around',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !stopWords.has(word));
}

// ── Hedging Detection ────────────────────────────────────────────────────────

/**
 * Detect hedging language patterns in AI output.
 * Excessive hedging may indicate uncertainty or fabricated claims.
 */
export function detectHedgingPatterns(text: string): string[] {
  const patterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bmay\b/gi, label: '"may" — uncertain possibility' },
    { pattern: /\bmight\b/gi, label: '"might" — speculative' },
    { pattern: /\bpossibly\b/gi, label: '"possibly" — uncertain' },
    { pattern: /\bpotentially\b/gi, label: '"potentially" — conditional' },
    { pattern: /\bit appears?\b/gi, label: '"it appears" — observational uncertainty' },
    { pattern: /\bseems?\s+to\b/gi, label: '"seems to" — impression-based' },
    { pattern: /\bcould\b/gi, label: '"could" — hypothetical' },
    { pattern: /\bperhaps\b/gi, label: '"perhaps" — speculative' },
    { pattern: /\bsuggests?\s+that\b/gi, label: '"suggests that" — indirect claim' },
    { pattern: /\bwe believe\b/gi, label: '"we believe" — opinion not fact' },
    { pattern: /\blikely\b/gi, label: '"likely" — probabilistic' },
    { pattern: /\bexpected\s+to\b/gi, label: '"expected to" — predictive' },
    { pattern: /\bit is possible\b/gi, label: '"it is possible" — possibility framing' },
    { pattern: /\bappears?\s+to\s+be\b/gi, label: '"appears to be" — observational' },
  ];

  const detected: string[] = [];

  for (const { pattern, label } of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detected.push(`${label} (${matches.length}x)`);
    }
  }

  return detected;
}

// ── Specificity Analysis ─────────────────────────────────────────────────────

/**
 * Score the specificity of AI output based on named entities.
 * Higher specificity = more grounded, less likely to be hallucinated.
 */
export function scoreSpecificity(text: string): number {
  let score = 0;
  const maxScore = 100;

  // Technology names (0-20 points)
  const techKeywords = [
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Python', 'Java', 'React',
    'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Redis', 'Terraform',
    'Snowflake', 'Databricks', 'Salesforce', 'HubSpot', 'SAP', 'Oracle',
    'Machine Learning', 'AI', 'Cloud', 'API', 'microservices', 'DevOps',
    'GraphQL', 'REST', 'GitLab', 'Jenkins', 'Apache', 'Spark',
  ];
  const techCount = techKeywords.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(text)).length;
  score += Math.min(20, techCount * 4);

  // Monetary values (0-20 points)
  const moneyMatches = text.match(/\$[\d,.]+(?:million|billion|M|B)?/gi);
  score += Math.min(20, (moneyMatches?.length ?? 0) * 10);

  // Percentage values (0-10 points)
  const percentMatches = text.match(/\d+(?:\.\d+)?%/g);
  score += Math.min(10, (percentMatches?.length ?? 0) * 5);

  // Named entities — capitalized multi-word (0-30 points)
  const namedMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
  const uniqueNames = new Set(namedMatches || []);
  score += Math.min(30, uniqueNames.size * 5);

  // Citations present (0-20 points)
  const citationMatches = text.match(/\[E\d+\]/g);
  const uniqueCitations = new Set(citationMatches || []);
  score += Math.min(20, uniqueCitations.size * 5);

  return Math.min(maxScore, score);
}

// ── Composite Hallucination Check ────────────────────────────────────────────

/**
 * Enterprise Trust Thresholds
 */
const HALLUCINATION_THRESHOLDS = {
  minimal: 15,   // 0-15: minimal risk
  low: 30,       // 16-30: low risk
  medium: 50,    // 31-50: medium risk
  high: 70,      // 51-70: high risk
  critical: 71,  // 71+: critical risk
} as const;

/**
 * Enterprise trust pass threshold — outputs above this score are flagged.
 */
const ENTERPRISE_TRUST_THRESHOLD = 60;

/**
 * Run a comprehensive post-generation hallucination check on AI output.
 *
 * This is the main entry point for WI-16B hallucination prevention.
 * Call this AFTER LLM generation to validate the output.
 *
 * @param aiOutput - The raw AI output text to check
 * @param evidenceContext - The evidence that was provided to the LLM
 * @returns Comprehensive hallucination analysis
 */
export function runHallucinationCheck(
  aiOutput: string,
  evidenceContext: EvidenceContext,
): HallucinationCheckResult {
  const timestamp = new Date().toISOString();

  // Step 1: Extract verifiable claims
  const claims = extractClaims(aiOutput);

  // Step 2: Verify citations
  const citationVerifications = verifyCitations(claims, evidenceContext);

  // Step 3: Detect hedging patterns
  const hedgingPatterns = detectHedgingPatterns(aiOutput);

  // Step 4: Score specificity
  const specificityScore = scoreSpecificity(aiOutput);

  // Step 5: Compute hallucination risk score
  let riskScore = 0;

  // Factor 1: Uncited claims (each adds risk)
  const citedClaims = claims.filter(c => c.citationMarker !== null);
  const uncitedClaims = claims.filter(c => c.citationMarker === null);
  riskScore += uncitedClaims.length * 8;

  // Factor 2: Hallucinated citations (very high risk)
  const hallucinatedCitations = citationVerifications.filter(v => !v.evidenceExists);
  riskScore += hallucinatedCitations.length * 25;

  // Factor 3: Misaligned citations (medium-high risk)
  const misalignedCitations = citationVerifications.filter(v => v.evidenceExists && !v.claimAligns);
  riskScore += misalignedCitations.length * 15;

  // Factor 4: Excessive hedging (indicates uncertainty)
  riskScore += Math.min(20, hedgingPatterns.length * 3);

  // Factor 5: Low specificity (generic output is suspicious)
  if (specificityScore < 20) riskScore += 15;
  else if (specificityScore < 40) riskScore += 8;

  // Factor 6: Claims with high expressed confidence but no citations (red flag)
  const highConfidenceUncited = claims.filter(c => c.expressedConfidence === 'high' && !c.citationMarker);
  riskScore += highConfidenceUncited.length * 10;

  // Factor 7: Ratio of claims to evidence available
  const evidenceCount = Object.keys(evidenceContext.evidenceMap).length;
  if (evidenceCount > 0 && claims.length > evidenceCount * 2) {
    riskScore += 10; // More claims than evidence can support
  }

  // Clamp to 0-100
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Determine risk level
  let riskLevel: HallucinationCheckResult['riskLevel'];
  if (riskScore <= HALLUCINATION_THRESHOLDS.minimal) riskLevel = 'minimal';
  else if (riskScore <= HALLUCINATION_THRESHOLDS.low) riskLevel = 'low';
  else if (riskScore <= HALLUCINATION_THRESHOLDS.medium) riskLevel = 'medium';
  else if (riskScore <= HALLUCINATION_THRESHOLDS.high) riskLevel = 'high';
  else riskLevel = 'critical';

  // Compute verified vs unverified counts
  const verifiedClaims = citationVerifications.filter(v => v.evidenceExists && v.claimAligns).length;
  const unverifiedClaims = claims.length - verifiedClaims - hallucinatedCitations.length;

  // Generate recommendations
  const recommendations = generateRecommendations({
    riskScore,
    claims,
    uncitedClaims,
    hallucinatedCitations,
    misalignedCitations,
    hedgingPatterns,
    specificityScore,
    evidenceCount,
  });

  return {
    hallucinationRiskScore: riskScore,
    riskLevel,
    claims,
    citationVerifications,
    verifiedClaims,
    unverifiedClaims,
    uncitedClaims: uncitedClaims.length,
    hallucinatedCitations: hallucinatedCitations.length,
    hedgingPatterns,
    specificityScore,
    recommendations,
    passesTrustThreshold: riskScore <= ENTERPRISE_TRUST_THRESHOLD,
    timestamp,
  };
}

/**
 * Generate actionable recommendations based on hallucination check results.
 */
function generateRecommendations(params: {
  riskScore: number;
  claims: ExtractedClaim[];
  uncitedClaims: ExtractedClaim[];
  hallucinatedCitations: CitationVerification[];
  misalignedCitations: CitationVerification[];
  hedgingPatterns: string[];
  specificityScore: number;
  evidenceCount: number;
}): string[] {
  const recs: string[] = [];

  if (params.hallucinatedCitations.length > 0) {
    recs.push(`CRITICAL: ${params.hallucinatedCitations.length} citation(s) reference non-existent evidence (${params.hallucinatedCitations.map(c => c.marker).join(', ')}). LLM fabricated these references.`);
  }

  if (params.uncitedClaims.length > 2) {
    recs.push(`${params.uncitedClaims.length} claims lack citation markers. Add [En] references to ground assertions in evidence.`);
  }

  if (params.misalignedCitations.length > 0) {
    recs.push(`${params.misalignedCitations.length} claim(s) may not align with cited evidence. Review for accuracy.`);
  }

  if (params.hedgingPatterns.length > 5) {
    recs.push(`Excessive hedging language detected (${params.hedgingPatterns.length} patterns). Consider whether claims are sufficiently grounded.`);
  }

  if (params.specificityScore < 20) {
    recs.push('Output lacks specific named entities, monetary values, or percentages. Generic output may indicate insufficient grounding context.');
  }

  if (params.evidenceCount > 0 && params.claims.length > params.evidenceCount * 2) {
    recs.push(`High claim-to-evidence ratio (${params.claims.length} claims, ${params.evidenceCount} evidence items). Consider providing more evidence context.`);
  }

  if (params.riskScore > ENTERPRISE_TRUST_THRESHOLD) {
    recs.push(`Overall hallucination risk (${params.riskScore}/100) exceeds enterprise trust threshold (${ENTERPRISE_TRUST_THRESHOLD}). Consider regenerating with stronger evidence context.`);
  }

  if (recs.length === 0) {
    recs.push('Output passes hallucination checks. No significant issues detected.');
  }

  return recs;
}

// ── Evidence Context Builder ──────────────────────────────────────────────────

/**
 * Build an EvidenceContext from GroundingEngine output.
 * Converts the evidence chain into the format expected by hallucination detection.
 */
export function buildEvidenceContextFromChain(params: {
  evidences: Array<{
    id: string;
    source: string;
    url: string | null;
    snippet: string;
    content: string;
    reliability: number;
    confidence: number;
  }>;
  fieldConfidence?: Record<string, number>;
}): EvidenceContext {
  const evidenceMap: EvidenceContext['evidenceMap'] = {};

  // Map evidence to citation markers [E1], [E2], etc.
  params.evidences.forEach((evidence, index) => {
    const marker = `E${index + 1}`;
    evidenceMap[marker] = {
      text: evidence.content || evidence.snippet,
      source: evidence.source,
      url: evidence.url,
      confidence: evidence.confidence,
    };
  });

  return {
    evidenceMap,
    fieldConfidence: params.fieldConfidence,
  };
}

/**
 * Build a minimal evidence context from a list of evidence items
 * when the full GroundingEngine chain is not available.
 */
export function buildMinimalEvidenceContext(evidences: Array<{
  marker: string;
  text: string;
  source: string;
  url?: string | null;
  confidence?: number;
}>): EvidenceContext {
  const evidenceMap: EvidenceContext['evidenceMap'] = {};

  for (const e of evidences) {
    evidenceMap[e.marker] = {
      text: e.text,
      source: e.source,
      url: e.url ?? null,
      confidence: e.confidence ?? 0.5,
    };
  }

  return { evidenceMap };
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format hallucination check results for audit logging.
 */
export function formatHallucinationReportForLog(result: HallucinationCheckResult): string {
  const lines = [
    `[HallucinationCheck] Risk: ${result.riskLevel} (${result.hallucinationRiskScore}/100) | Trust: ${result.passesTrustThreshold ? 'PASS' : 'FAIL'}`,
    `  Claims: ${result.claims.length} total | ${result.verifiedClaims} verified | ${result.uncitedClaims} uncited | ${result.hallucinatedCitations} hallucinated citations`,
    `  Specificity: ${result.specificityScore}/100 | Hedging: ${result.hedgingPatterns.length} patterns`,
  ];

  if (result.hallucinatedCitations > 0) {
    lines.push(`  ⚠ HALLUCINATED CITATIONS: ${result.citationVerifications.filter(v => !v.evidenceExists).map(v => v.marker).join(', ')}`);
  }

  if (result.recommendations.length > 0) {
    lines.push('  Recommendations:');
    for (const rec of result.recommendations) {
      lines.push(`    - ${rec}`);
    }
  }

  return lines.join('\n');
}
