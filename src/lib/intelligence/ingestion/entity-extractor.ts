// ═══════════════════════════════════════════════════════════════════════════
// Entity Extractor — Converts parsed rows into intelligence entities
//
// Takes a row of data and column mapping, extracts Organization and Person
// entities with proper field normalization.
// ═══════════════════════════════════════════════════════════════════════════

import type { ParsedRow } from './parsers';
import type { ColumnMapping } from './column-detector';

export interface ExtractedOrganization {
  name: string;
  domain?: string;
  industry?: string;
  description?: string;
  revenue?: string;
  employeeCount?: number;
  headquarters?: string;
}

export interface ExtractedPerson {
  fullName: string;
  email?: string;
  title?: string;
  department?: string;
}

export interface ExtractedEntities {
  organization?: ExtractedOrganization;
  person?: ExtractedPerson;
}

/**
 * Extract entities from a single row using column mapping.
 */
export function extractEntities(row: ParsedRow, mapping: ColumnMapping): ExtractedEntities {
  const entities: ExtractedEntities = {};

  // Extract Organization
  const companyName = getFieldValue(row, mapping.companyName);
  if (companyName) {
    entities.organization = {
      name: cleanCompanyName(companyName),
      domain: extractDomain(getFieldValue(row, mapping.domain)),
      industry: getFieldValue(row, mapping.industry),
      description: getFieldValue(row, mapping.description),
      revenue: getFieldValue(row, mapping.revenue),
      employeeCount: parseInteger(getFieldValue(row, mapping.employeeCount)),
      headquarters: getFieldValue(row, mapping.headquarters),
    };
  }

  // Extract Person
  const contactName = getFieldValue(row, mapping.contactName);
  if (contactName) {
    entities.person = {
      fullName: contactName.trim(),
      email: extractEmail(getFieldValue(row, mapping.email)),
      title: getFieldValue(row, mapping.title),
      department: getFieldValue(row, mapping.department),
    };
  }

  return entities;
}

function getFieldValue(row: ParsedRow, columnName?: string): string | undefined {
  if (!columnName) return undefined;
  const value = row[columnName.toLowerCase()];
  return value && value.trim() ? value.trim() : undefined;
}

function extractDomain(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase();

  // Already looks like a domain
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
    return cleaned.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
  }

  // URL — extract domain
  try {
    const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function extractEmail(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase();
  // Basic email validation
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return cleaned;
  }
  return undefined;
}

function parseInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

function cleanCompanyName(name: string): string {
  return (
    name
      .trim()
      // Remove common legal suffixes for cleaner matching
      .replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|corporation|company|co\.?)\s*$/i, '')
      .trim() || name.trim()
  );
}
