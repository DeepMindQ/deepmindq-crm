// ═══════════════════════════════════════════════════════════════════════════
// Column Detector — Intelligent column mapping
//
// Analyzes CSV/Excel headers to detect what each column represents.
// Maps raw column names to DeepMindQ entity fields.
// ═══════════════════════════════════════════════════════════════════════════

import type { ParsedRow } from './parsers';

export interface ColumnMapping {
  // Organization fields
  companyName?: string; // "company", "organization", "account", "company name"
  domain?: string; // "website", "domain", "url", "website url"
  industry?: string; // "industry", "sector", "market"
  description?: string; // "description", "overview", "about"
  revenue?: string; // "revenue", "annual revenue", "arr"
  employeeCount?: string; // "employees", "employee count", "size", "headcount"
  headquarters?: string; // "location", "hq", "headquarters", "city"

  // Person fields
  contactName?: string; // "contact", "name", "full name", "contact name"
  email?: string; // "email", "email address", "work email"
  title?: string; // "title", "job title", "position", "role"
  department?: string; // "department", "team", "function"

  // Common patterns that could be either
  name?: string; // Ambiguous — could be company or person
  phone?: string; // "phone", "telephone", "mobile"
  notes?: string; // "notes", "comments", "remarks"
}

// Column name patterns mapped to DeepMindQ fields
const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  companyName: [
    /^(company|organization|org|account|account\s*name|company\s*name|firm|business)$/i,
    /^(co\.?\s*name|corp|enterprise)$/i,
  ],
  domain: [/^(website|domain|url|web|website\s*url|website\s*domain|homepage)$/i],
  industry: [/^(industry|sector|market|vertical|category)$/i],
  description: [
    /^(description|overview|about|summary|business\s*description|company\s*description)$/i,
  ],
  revenue: [/^(revenue|annual\s*revenue|arr|annual\s*recurring\s*revenue|turnover|sales)$/i],
  employeeCount: [
    /^(employees?|employee\s*count|headcount|size|company\s*size|staff|no\.\s*of\s*employees?|num\s*employees?)$/i,
  ],
  headquarters: [/^(location|hq|headquarters|city|address|country|region|state)$/i],
  contactName: [/^(contact|contact\s*name|full\s*name|person|stakeholder|decision\s*maker)$/i],
  email: [/^(email|e-?mail|email\s*address|work\s*email|business\s*email)$/i],
  title: [/^(title|job\s*title|position|role|designation|job\s*role)$/i],
  department: [/^(department|team|function|division|unit)$/i],
  name: [/^name$/i],
  phone: [/^(phone|telephone|mobile|cell|tel)$/i],
  notes: [/^(notes|comments|remarks|memo)$/i],
};

/**
 * Detect column mapping from a parsed row's keys.
 * Returns a mapping from DeepMindQ fields to the actual column names in the data.
 */
export function detectColumns(sampleRow: ParsedRow): ColumnMapping {
  const mapping: ColumnMapping = {};
  const columns = Object.keys(sampleRow);

  for (const column of columns) {
    const trimmed = column.trim();

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(trimmed)) {
          // Only map if not already mapped to a more specific field
          if (!mapping[field as keyof ColumnMapping]) {
            mapping[field as keyof ColumnMapping] = trimmed;
          }
        }
      }
    }
  }

  // Handle ambiguous "name" column
  if (mapping.name && !mapping.companyName && !mapping.contactName) {
    // If there's also an email/title column, "name" is likely a person name
    if (mapping.email || mapping.title) {
      mapping.contactName = mapping.name;
    } else {
      mapping.companyName = mapping.name;
    }
    delete mapping.name;
  }

  return mapping;
}
