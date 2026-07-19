/**
 * Correction Suggester — Data Intelligence Engine
 *
 * Suggests corrections for rows with validation warnings.
 * Uses pattern matching and normalization mappings to propose
 * fixes that the user can approve or reject from the UI.
 *
 * This is what makes the "review screen" intelligent —
 * instead of just flagging problems, the system proposes solutions.
 */

import { getNormalizedValue } from './config-store';
import type { ValidationIssue } from './validator';

export interface SuggestedCorrection {
  field: string;
  original: string;
  suggested: string;
  ruleId?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface MappedRow {
  [key: string]: unknown;
}

/**
 * Generate correction suggestions for a row with validation issues.
 */
export async function suggestCorrections(
  row: MappedRow,
  issues: ValidationIssue[]
): Promise<SuggestedCorrection[]> {
  const suggestions: SuggestedCorrection[] = [];

  for (const issue of issues) {
    // Only suggest corrections for warnings (errors are usually unrecoverable)
    const value = String(row[issue.field] || '').trim();
    if (!value) continue;

    const fieldSuggestions = await suggestForField(issue.field, value, issue);
    suggestions.push(...fieldSuggestions);
  }

  return suggestions;
}

async function suggestForField(
  field: string,
  value: string,
  issue: ValidationIssue
): Promise<SuggestedCorrection[]> {
  const suggestions: SuggestedCorrection[] = [];

  switch (field) {
    case 'email':
      suggestions.push(...suggestEmailCorrections(value, issue));
      break;

    case 'domain':
      suggestions.push(...suggestDomainCorrections(value, issue));
      break;

    case 'industry':
      suggestions.push(...await suggestIndustryCorrections(value, issue));
      break;

    case 'country':
      suggestions.push(...await suggestCountryCorrections(value, issue));
      break;

    case 'size':
      suggestions.push(...await suggestSizeCorrections(value, issue));
      break;

    case 'website':
      suggestions.push(...suggestWebsiteCorrections(value, issue));
      break;

    case 'name':
      suggestions.push(...suggestNameCorrections(value, issue));
      break;
  }

  return suggestions;
}

function suggestEmailCorrections(value: string, issue: ValidationIssue): SuggestedCorrection[] {
  const suggestions: SuggestedCorrection[] = [];
  const lower = value.toLowerCase();

  // Common typos
  if (lower.includes('@gamil.com')) {
    suggestions.push({
      field: 'email', original: value,
      suggested: value.replace(/@gamil\.com/i, '@gmail.com'),
      confidence: 'high', reason: 'Common typo: "gamil" → "gmail"',
    });
  }
  if (lower.includes('@gmial.com')) {
    suggestions.push({
      field: 'email', original: value,
      suggested: value.replace(/@gmial\.com/i, '@gmail.com'),
      confidence: 'high', reason: 'Common typo: "gmial" → "gmail"',
    });
  }
  if (lower.includes('@yahoo.co')) {
    suggestions.push({
      field: 'email', original: value,
      suggested: value.replace(/@yahoo\.co$/i, '@yahoo.com'),
      confidence: 'medium', reason: 'Incomplete domain: "yahoo.co" → "yahoo.com"',
    });
  }

  // Double dots
  if (lower.includes('..')) {
    suggestions.push({
      field: 'email', original: value,
      suggested: value.replace(/\.\./g, '.'),
      confidence: 'high', reason: 'Remove double dots',
    });
  }

  // Trailing/leading whitespace
  if (value !== value.trim()) {
    suggestions.push({
      field: 'email', original: value,
      suggested: value.trim(),
      confidence: 'high', reason: 'Remove leading/trailing whitespace',
    });
  }

  return suggestions;
}

function suggestDomainCorrections(value: string, issue: ValidationIssue): SuggestedCorrection[] {
  const suggestions: SuggestedCorrection[] = [];
  const lower = value.toLowerCase().trim();

  // Remove common prefixes
  if (lower.startsWith('www.')) {
    suggestions.push({
      field: 'domain', original: value,
      suggested: lower.replace('www.', ''),
      confidence: 'high', reason: 'Remove "www." prefix',
    });
  }

  // Remove protocol
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    suggestions.push({
      field: 'domain', original: value,
      suggested: lower.replace(/^https?:\/\//, '').split('/')[0],
      confidence: 'high', reason: 'Remove protocol prefix',
    });
  }

  // Remove trailing slash
  if (lower.endsWith('/')) {
    suggestions.push({
      field: 'domain', original: value,
      suggested: lower.replace(/\/+$/, ''),
      confidence: 'high', reason: 'Remove trailing slash',
    });
  }

  return suggestions;
}

async function suggestIndustryCorrections(value: string, issue: ValidationIssue): Promise<SuggestedCorrection[]> {
  const suggestions: SuggestedCorrection[] = [];

  // Try DB normalization mapping
  const normalized = await getNormalizedValue('industry', value);
  if (normalized !== value) {
    suggestions.push({
      field: 'industry', original: value, suggested: normalized,
      confidence: 'high', reason: 'Standard industry name from normalization rules',
    });
    return suggestions;
  }

  // Try case-insensitive match
  const normalizedLower = await getNormalizedValue('industry', value.toLowerCase());
  if (normalizedLower !== value.toLowerCase()) {
    suggestions.push({
      field: 'industry', original: value, suggested: normalizedLower,
      confidence: 'medium', reason: 'Case-insensitive industry normalization',
    });
  }

  return suggestions;
}

async function suggestCountryCorrections(value: string, issue: ValidationIssue): Promise<SuggestedCorrection[]> {
  const suggestions: SuggestedCorrection[] = [];

  const normalized = await getNormalizedValue('country', value);
  if (normalized !== value) {
    suggestions.push({
      field: 'country', original: value, suggested: normalized,
      confidence: 'high', reason: 'Standard country name from normalization rules',
    });
    return suggestions;
  }

  const normalizedLower = await getNormalizedValue('country', value.toLowerCase());
  if (normalizedLower !== value.toLowerCase()) {
    suggestions.push({
      field: 'country', original: value, suggested: normalizedLower,
      confidence: 'medium', reason: 'Case-insensitive country normalization',
    });
  }

  return suggestions;
}

async function suggestSizeCorrections(value: string, issue: ValidationIssue): Promise<SuggestedCorrection[]> {
  const suggestions: SuggestedCorrection[] = [];

  const normalized = await getNormalizedValue('employee_size', value);
  if (normalized !== value) {
    suggestions.push({
      field: 'size', original: value, suggested: normalized,
      confidence: 'high', reason: 'Standard employee size range',
    });
  }

  // If it looks like a raw number, suggest range
  const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  if (!isNaN(num) && num > 0 && !normalized) {
    let range: string;
    if (num <= 10) range = '1-10';
    else if (num <= 50) range = '11-50';
    else if (num <= 200) range = '51-200';
    else if (num <= 500) range = '201-500';
    else if (num <= 1000) range = '501-1,000';
    else if (num <= 5000) range = '1,001-5,000';
    else if (num <= 10000) range = '5,001-10,000';
    else range = '10,001+';

    suggestions.push({
      field: 'size', original: value, suggested: range,
      confidence: 'high', reason: `Convert "${num}" to standard range`,
    });
  }

  return suggestions;
}

function suggestWebsiteCorrections(value: string, issue: ValidationIssue): SuggestedCorrection[] {
  const suggestions: SuggestedCorrection[] = [];

  if (value && !value.startsWith('http')) {
    suggestions.push({
      field: 'website', original: value,
      suggested: `https://${value}`,
      confidence: 'high', reason: 'Add HTTPS protocol',
    });
  }

  return suggestions;
}

function suggestNameCorrections(value: string, issue: ValidationIssue): SuggestedCorrection[] {
  const suggestions: SuggestedCorrection[] = [];

  // Clean up special characters
  const cleaned = value
    .replace(/[|,;]\s*$/g, '')
    .replace(/^\s*[|,;]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned !== value) {
    suggestions.push({
      field: 'name', original: value, suggested: cleaned,
      confidence: 'medium', reason: 'Clean up special characters',
    });
  }

  // If name contains email-like pattern, suggest extracting just the name
  const emailMatch = value.match(/^([^<\s]+)\s*[<(]([^>)>]+)[>)]?$/);
  if (emailMatch) {
    suggestions.push({
      field: 'name', original: value, suggested: emailMatch[1].trim(),
      confidence: 'high', reason: 'Extract name from "Name <email>" format',
    });
  }

  return suggestions;
}