/**
 * Quality Scorer — Data Intelligence Engine
 *
 * Calculates a data quality score (0-100) for each row based on:
 * - Data completeness (how many fields are filled)
 * - Validation health (no errors, few warnings)
 * - Data richness (email, phone, LinkedIn, etc.)
 * - Normalization success (values were normalizable)
 *
 * The weights are loaded from ScoringWeight config in DB.
 * Falls back to sensible defaults if no config exists yet.
 */

import { getScoringByDimension, type ScoringWeightConfig } from './config-store';
import type { ValidationIssue } from './validator';

interface QualityDimensions {
  completeness: number;  // 0-40: how many fields are present
  validity: number;      // 0-30: no errors, minimal warnings
  richness: number;      // 0-30: quality of available data
}

export interface QualityScore {
  total: number;         // 0-100
  dimensions: QualityDimensions;
  details: string[];     // human-readable explanations
}

// Default weights if DB config not yet seeded
const DEFAULT_WEIGHTS: QualityDimensions = {
  completeness: 40,
  validity: 30,
  richness: 30,
};

interface MappedRow {
  [key: string]: unknown;
}

/**
 * Calculate quality score for a single row.
 */
export async function scoreRowQuality(
  row: MappedRow,
  issues: ValidationIssue[],
  normalizationChanges: number
): Promise<QualityScore> {
  const weights = await loadQualityWeights();

  // 1. Completeness (0-100, weighted to max 40)
  const completeness = calculateCompleteness(row);

  // 2. Validity (0-100, weighted to max 30)
  const validity = calculateValidity(issues);

  // 3. Richness (0-100, weighted to max 30)
  const richness = calculateRichness(row, normalizationChanges);

  const total = Math.round(
    (completeness / 100) * weights.completeness +
    (validity / 100) * weights.validity +
    (richness / 100) * weights.richness
  );

  const details = buildDetails(completeness, validity, richness, issues, row);

  return {
    total,
    dimensions: {
      completeness,
      validity,
      richness,
    },
    details,
  };
}

/**
 * Calculate aggregate quality score for an entire upload.
 */
export function calculateAggregateScore(
  rowScores: number[]
): { score: number; distribution: { excellent: number; good: number; fair: number; poor: number } } {
  if (rowScores.length === 0) return { score: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } };

  const avg = rowScores.reduce((a, b) => a + b, 0) / rowScores.length;

  const distribution = {
    excellent: rowScores.filter(s => s >= 80).length,
    good: rowScores.filter(s => s >= 60 && s < 80).length,
    fair: rowScores.filter(s => s >= 40 && s < 60).length,
    poor: rowScores.filter(s => s < 40).length,
  };

  return {
    score: Math.round(avg),
    distribution,
  };
}

// ── Dimension Calculators ──

function calculateCompleteness(row: MappedRow): number {
  // Key fields and their importance
  const keyFields = [
    { field: 'name', weight: 15 },
    { field: 'email', weight: 20 },
    { field: 'company', weight: 15 },
    { field: 'title', weight: 10 },
    { field: 'phone', weight: 8 },
    { field: 'linkedin', weight: 8 },
    { field: 'location', weight: 5 },
    { field: 'industry', weight: 8 },
    { field: 'size', weight: 5 },
    { field: 'domain', weight: 6 },
  ];

  let score = 0;
  let maxPossible = 0;

  for (const { field, weight } of keyFields) {
    const value = row[field];
    maxPossible += weight;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      score += weight;
    }
  }

  return maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 0;
}

function calculateValidity(issues: ValidationIssue[]): number {
  if (issues.length === 0) return 100;

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;

  // Each error costs 30 points, each warning costs 10 points
  const penalty = errors * 30 + warnings * 10;
  return Math.max(0, 100 - penalty);
}

function calculateRichness(row: MappedRow, normalizationChanges: number): number {
  let score = 0;

  // Email quality: has proper format (not free provider)
  const email = String(row.email || '').trim().toLowerCase();
  if (email) {
    if (!isFreeEmailProvider(email)) score += 15;
    else score += 5;
  }

  // Has both first and last name (name has a space)
  const name = String(row.name || '').trim();
  if (name && name.includes(' ')) score += 10;

  // Has LinkedIn URL
  if (row.linkedin && String(row.linkedin).trim()) score += 15;

  // Has phone
  if (row.phone && String(row.phone).trim()) score += 10;

  // Normalization worked (data was cleanable)
  if (normalizationChanges > 0) score += Math.min(15, normalizationChanges * 5);

  // Has industry (data enrichment potential)
  if (row.industry && String(row.industry).trim()) score += 15;

  // Has company size (segmentation potential)
  if (row.size && String(row.size).trim()) score += 10;

  return Math.min(100, score);
}

// ── Helpers ──

async function loadQualityWeights(): Promise<QualityDimensions> {
  try {
    const weights = await getScoringByDimension('data_quality');
    if (weights.length > 0) {
      return {
        completeness: weights.find(w => w.key === 'completeness')?.weight ?? 40,
        validity: weights.find(w => w.key === 'validity')?.weight ?? 30,
        richness: weights.find(w => w.key === 'richness')?.weight ?? 30,
      };
    }
  } catch {
    // DB not ready yet — use defaults
  }
  return DEFAULT_WEIGHTS;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'gmail.co.in', 'yahoo.co.in', 'rediffmail.com',
]);

function isFreeEmailProvider(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? FREE_EMAIL_DOMAINS.has(domain) : true;
}

function buildDetails(
  completeness: number,
  validity: number,
  richness: number,
  issues: ValidationIssue[],
  row: MappedRow
): string[] {
  const details: string[] = [];

  if (completeness >= 80) details.push('High data completeness');
  else if (completeness < 40) details.push('Low data completeness — many fields missing');

  if (validity < 100) {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warnCount = issues.filter(i => i.severity === 'warning').length;
    if (errorCount > 0) details.push(`${errorCount} validation error(s)`);
    if (warnCount > 0) details.push(`${warnCount} warning(s)`);
  }

  const email = String(row.email || '').trim();
  if (email && isFreeEmailProvider(email)) details.push('Uses free email provider');

  const name = String(row.name || '').trim();
  if (name && !name.includes(' ')) details.push('Name may be incomplete (single word)');

  return details;
}