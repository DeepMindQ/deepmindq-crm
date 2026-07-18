/**
 * Normalizer — Data Intelligence Engine
 *
 * Normalizes field values using DB-stored NormalizationMappings.
 * Handles: industry names, country names, employee sizes,
 * company name cleanup, and other value standardization.
 *
 * All normalization rules are in the database — admin can
 * add new mappings (e.g., "Fintech" → "Financial Technology")
 * without any code changes.
 */

import { getNormalizedValue, getNormalizationByCategory } from './config-store';

interface MappedRow {
  [key: string]: unknown;
}

export interface NormalizationResult {
  normalized: MappedRow;
  changes: Array<{ field: string; original: string; normalized: string }>;
}

/**
 * Normalize a single mapped row.
 * Applies normalization mappings from DB for each known category.
 */
export async function normalizeRow(row: MappedRow): Promise<NormalizationResult> {
  const normalized: MappedRow = { ...row };
  const changes: NormalizationResult['changes'] = [];

  // Industry normalization
  if (row.industry && String(row.industry).trim()) {
    const result = await normalizeIndustry(String(row.industry).trim());
    if (result.changed) {
      normalized.industry = result.value;
      changes.push({ field: 'industry', original: String(row.industry), normalized: result.value });
    }
  }

  // Country normalization
  if (row.country && String(row.country).trim()) {
    const result = await normalizeCountry(String(row.country).trim());
    if (result.changed) {
      normalized.country = result.value;
      changes.push({ field: 'country', original: String(row.country), normalized: result.value });
    }
  }

  // Employee size normalization
  if (row.size && String(row.size).trim()) {
    const result = await normalizeEmployeeSize(String(row.size).trim());
    if (result.changed) {
      normalized.size = result.value;
      changes.push({ field: 'size', original: String(row.size), normalized: result.value });
    }
  }

  // Company name normalization
  if (row.company && String(row.company).trim()) {
    const result = normalizeCompanyName(String(row.company).trim());
    if (result.changed) {
      normalized.company = result.value;
      changes.push({ field: 'company', original: String(row.company), normalized: result.value });
    }
  }

  // Domain normalization (extract from email if domain is empty)
  if ((!row.domain || !String(row.domain).trim()) && row.email && String(row.email).includes('@')) {
    const emailDomain = String(row.email).split('@')[1]?.toLowerCase().trim();
    if (emailDomain) {
      normalized.domain = emailDomain;
      changes.push({ field: 'domain', original: '', normalized: emailDomain });
    }
  }

  // Website normalization (ensure has protocol)
  if (row.website && String(row.website).trim()) {
    const website = String(row.website).trim();
    if (website && !website.startsWith('http')) {
      normalized.website = `https://${website}`;
      changes.push({ field: 'website', original: website, normalized: normalized.website });
    }
  }

  // Name cleanup
  if (row.name && String(row.name).trim()) {
    const cleaned = normalizeName(String(row.name).trim());
    if (cleaned !== String(row.name).trim()) {
      normalized.name = cleaned;
      changes.push({ field: 'name', original: String(row.name), normalized: cleaned });
    }
  }

  // Title cleanup
  if (row.title && String(row.title).trim()) {
    const result = await normalizeTitle(String(row.title).trim());
    if (result.changed) {
      normalized.title = result.value;
      changes.push({ field: 'title', original: String(row.title), normalized: result.value });
    }
  }

  return { normalized, changes };
}

// ── Field-Specific Normalization ──

async function normalizeIndustry(value: string): Promise<{ value: string; changed: boolean }> {
  // First try exact DB mapping
  const dbResult = await getNormalizedValue('industry', value);
  if (dbResult !== value) {
    return { value: dbResult, changed: true };
  }

  // Fuzzy: try with common variations
  const variations = [
    value.toLowerCase(),
    value.replace(/&/g, 'and').trim(),
    value.replace(/\s+/g, ' ').trim(),
  ];
  for (const v of variations) {
    const result = await getNormalizedValue('industry', v);
    if (result !== v) {
      return { value: result, changed: true };
    }
  }

  // Title-case the industry if it's all lower or all upper
  if (value === value.toLowerCase() || value === value.toUpperCase()) {
    return { value: toTitleCase(value), changed: true };
  }

  return { value, changed: false };
}

async function normalizeCountry(value: string): Promise<{ value: string; changed: boolean }> {
  // Try exact DB mapping
  const dbResult = await getNormalizedValue('country', value);
  if (dbResult !== value) {
    return { value: dbResult, changed: true };
  }

  // Try lowercase
  const lowerResult = await getNormalizedValue('country', value.toLowerCase());
  if (lowerResult !== value.toLowerCase()) {
    return { value: lowerResult, changed: true };
  }

  return { value, changed: false };
}

async function normalizeEmployeeSize(value: string): Promise<{ value: string; changed: boolean }> {
  // Try exact DB mapping first
  const dbResult = await getNormalizedValue('employee_size', value);
  if (dbResult !== value) {
    return { value: dbResult, changed: true };
  }

  // Try to parse as a number and convert to range
  const VALID_RANGES = [
    '1-10', '11-50', '51-200', '201-500',
    '501-1,000', '1,001-5,000', '5,001-10,000', '10,001+'
  ];

  // Already a valid range?
  if (VALID_RANGES.includes(value)) {
    return { value, changed: false };
  }

  // Extract number from string
  const numStr = value.replace(/[^0-9]/g, '');
  const num = parseInt(numStr, 10);

  if (isNaN(num) || num <= 0) {
    return { value, changed: false };
  }

  let range: string;
  if (num <= 10) range = '1-10';
  else if (num <= 50) range = '11-50';
  else if (num <= 200) range = '51-200';
  else if (num <= 500) range = '201-500';
  else if (num <= 1000) range = '501-1,000';
  else if (num <= 5000) range = '1,001-5,000';
  else if (num <= 10000) range = '5,001-10,000';
  else range = '10,001+';

  return { value: range, changed: true };
}

function normalizeCompanyName(value: string): { value: string; changed: boolean } {
  let cleaned = value;

  // Remove common legal suffixes for matching purposes
  // But keep them in the raw name — we only normalize for comparison
  // Actually, let's clean up the display name:
  // - Remove extra whitespace
  // - Remove leading/trailing punctuation
  // - Standardize separators

  cleaned = cleaned
    .replace(/\s+/g, ' ')           // collapse multiple spaces
    .replace(/[|,;]\s*$/g, '')      // remove trailing separators
    .replace(/^\s*[|,;]\s*/g, '')   // remove leading separators
    .trim();

  return { value: cleaned, changed: cleaned !== value };
}

function normalizeName(value: string): string {
  return value
    .replace(/\s+/g, ' ')        // collapse multiple spaces
    .replace(/[|,;]\s*$/g, '')   // remove trailing separators
    .trim();
}

async function normalizeTitle(value: string): Promise<{ value: string; changed: boolean }> {
  // Try exact DB mapping
  const dbResult = await getNormalizedValue('title', value);
  if (dbResult !== value) {
    return { value: dbResult, changed: true };
  }

  // Standardize common abbreviations
  const abbreviations: Record<string, string> = {
    'vp': 'Vice President',
    'svp': 'Senior Vice President',
    'evp': 'Executive Vice President',
    'cto': 'Chief Technology Officer',
    'cfo': 'Chief Financial Officer',
    'coo': 'Chief Operating Officer',
    'cmo': 'Chief Marketing Officer',
    'cpo': 'Chief Product Officer',
    'ciso': 'Chief Information Security Officer',
    'ceo': 'Chief Executive Officer',
    'chro': 'Chief Human Resources Officer',
    'cdo': 'Chief Data Officer',
    'cio': 'Chief Information Officer',
  };

  const lower = value.toLowerCase().trim();
  if (abbreviations[lower]) {
    return { value: abbreviations[lower], changed: true };
  }

  return { value, changed: false };
}

// ── Helpers ──

function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}

/**
 * Get all available normalization categories.
 */
export function getNormalizationCategories(): string[] {
  return ['industry', 'country', 'employee_size', 'title', 'company_name'];
}