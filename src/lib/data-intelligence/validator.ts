/**
 * Validator — Data Intelligence Engine
 *
 * Validates mapped row data against DB-stored FieldValidationRules.
 * No hardcoded validation logic — all rules come from the database.
 *
 * Returns validation issues (errors and warnings) for each row.
 */

import { getValidationRules, type ValidationRuleConfig } from './config-store';

export interface ValidationIssue {
  field: string;
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning';
  message: string;
}

interface MappedRow {
  [key: string]: unknown;
}

/**
 * Validate a single mapped row against all active validation rules.
 */
export async function validateRow(
  row: MappedRow,
  existingValuesInBatch?: Map<string, Set<string>>
): Promise<ValidationIssue[]> {
  const rules = await getValidationRules();
  const issues: ValidationIssue[] = [];

  for (const rule of rules) {
    const value = row[rule.targetField];
    const valueStr = value !== null && value !== undefined ? String(value).trim() : '';

    const ruleIssues = applyRule(rule, rule.targetField, valueStr, row, existingValuesInBatch);
    issues.push(...ruleIssues);
  }

  return issues;
}

/**
 * Validate a batch of rows. Returns issues per row index.
 */
export async function validateRows(
  rows: MappedRow[]
): Promise<Map<number, ValidationIssue[]>> {
  const rules = await getValidationRules();
  const result = new Map<number, ValidationIssue[]>();

  // Build uniqueness trackers across the batch
  const seenEmails = new Map<string, number>();  // email → first rowIndex
  const seenDomains = new Map<string, number>();
  const seenCompanyNames = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const issues: ValidationIssue[] = [];

    for (const rule of rules) {
      const value = row[rule.targetField];
      const valueStr = value !== null && value !== undefined ? String(value).trim() : '';

      // For uniqueness rules, pass the batch-level trackers
      const trackers = buildUniquenessContext(rule, seenEmails, seenDomains, seenCompanyNames, i);
      const ruleIssues = applyRule(rule, rule.targetField, valueStr, row, trackers);
      issues.push(...ruleIssues);
    }

    result.set(i, issues);
  }

  return result;
}

function buildUniquenessContext(
  rule: ValidationRuleConfig,
  seenEmails: Map<string, number>,
  seenDomains: Map<string, number>,
  seenCompanyNames: Map<string, number>,
  currentIndex: number
): Map<string, Set<string>> | undefined {
  if (rule.ruleType !== 'uniqueness') return undefined;

  const map = new Map<string, Set<string>>();
  if (rule.targetField === 'email') {
    const set = new Set<string>();
    seenEmails.forEach((_, key) => set.add(key));
    map.set('email', set);
  } else if (rule.targetField === 'domain') {
    const set = new Set<string>();
    seenDomains.forEach((_, key) => set.add(key));
    map.set('domain', set);
  } else if (rule.targetField === 'company') {
    const set = new Set<string>();
    seenCompanyNames.forEach((_, key) => set.add(key));
    map.set('company', set);
  }
  return map;
}

function applyRule(
  rule: ValidationRuleConfig,
  field: string,
  value: string,
  row: MappedRow,
  existingValues?: Map<string, Set<string>>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const config = rule.config;

  switch (rule.ruleType) {
    case 'required': {
      const whenFields = (config.whenFields as string[]) || [];
      if (whenFields.length > 0) {
        // Conditional required: required when all "when" fields are empty
        const whenFieldsEmpty = whenFields.every(f => {
          const v = row[f];
          return !v || String(v).trim() === '';
        });
        if (whenFieldsEmpty && !value) {
          issues.push(makeIssue(field, rule));
        }
      } else if (!value) {
        issues.push(makeIssue(field, rule));
      }
      break;
    }

    case 'regex': {
      if (!value) break; // Don't validate empty values with regex (use 'required' for that)
      const pattern = (config.pattern as string) || '';
      if (pattern) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (!regex.test(value)) {
            issues.push(makeIssue(field, rule));
          }
        } catch {
          // Invalid regex in config — skip
        }
      }
      break;
    }

    case 'format': {
      if (!value) break;
      const formatType = (config.format as string) || '';
      if (formatType === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          issues.push(makeIssue(field, rule));
        }
      } else if (formatType === 'url') {
        if (!/^https?:\/\/.+\..+/.test(value) && !value.includes('.')) {
          issues.push(makeIssue(field, rule));
        }
      } else if (formatType === 'domain') {
        if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(value)) {
          issues.push(makeIssue(field, rule));
        }
      }
      break;
    }

    case 'range': {
      if (!value) break;
      const num = Number(value);
      if (isNaN(num)) break;
      const min = (config.min as number) ?? -Infinity;
      const max = (config.max as number) ?? Infinity;
      if (num < min || num > max) {
        issues.push(makeIssue(field, rule));
      }
      break;
    }

    case 'uniqueness': {
      if (!value) break;
      if (existingValues) {
        const fieldKey = field;
        const existing = existingValues.get(fieldKey) || new Set();
        if (existing.has(value.toLowerCase())) {
          issues.push(makeIssue(field, rule));
        }
        existing.add(value.toLowerCase());
      }
      break;
    }

    case 'custom': {
      if (!value) break;
      const customType = (config.customType as string) || '';
      if (customType === 'no_special_chars_only') {
        // Value should not be ONLY special characters
        if (!/[a-zA-Z0-9]/.test(value)) {
          issues.push(makeIssue(field, rule));
        }
      } else if (customType === 'min_word_count') {
        const minWords = (config.minWords as number) || 1;
        if (value.split(/\s+/).filter(Boolean).length < minWords) {
          issues.push(makeIssue(field, rule));
        }
      }
      break;
    }
  }

  return issues;
}

function makeIssue(field: string, rule: ValidationRuleConfig): ValidationIssue {
  return {
    field,
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    message: rule.message,
  };
}