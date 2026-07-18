/**
 * Column Detector — Data Intelligence Engine
 *
 * Matches source file column headers to internal target fields
 * using DB-stored regex patterns (ColumnMappingRule).
 *
 * No hardcoded patterns — all rules come from the database.
 * Admin can add new patterns for any file format via Settings.
 */

import { getColumnMappingRules, TARGET_FIELDS, type TargetField } from './config-store';

export interface ColumnDetectionResult {
  mapping: Record<string, TargetField>;  // sourceHeader → targetField
  unmatchedHeaders: string[];             // headers with no rule match
  unmatchedFields: TargetField[];         // target fields not matched
  confidence: number;                     // 0-100, how confident the detection is
}

/**
 * Analyze source headers and produce a column mapping.
 * Rules are loaded from DB and matched by priority (highest first).
 */
export async function detectColumns(
  headers: string[]
): Promise<ColumnDetectionResult> {
  const rules = await getColumnMappingRules();
  const mapping: Record<string, TargetField> = {};
  const matchedFields = new Set<string>();
  const matchedHeaders = new Set<string>();

  // Sort rules by priority descending (higher priority = checked first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const header of headers) {
    const normalizedHeader = header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const rule of sortedRules) {
      // Skip if this target field is already matched by a higher-priority header
      if (matchedFields.has(rule.targetField)) continue;

      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(header) || regex.test(normalizedHeader)) {
          mapping[header] = rule.targetField as TargetField;
          matchedFields.add(rule.targetField);
          matchedHeaders.add(header);
          break; // move to next header
        }
      } catch {
        // Invalid regex in DB — skip this rule
        console.warn(`Invalid regex in ColumnMappingRule "${rule.name}": ${rule.pattern}`);
      }
    }
  }

  const unmatchedHeaders = headers.filter(h => !matchedHeaders.has(h));
  const unmatchedFields = TARGET_FIELDS.filter(f => !matchedFields.has(f)) as TargetField[];

  // Confidence: proportion of target fields that were matched
  // (Not all fields need to be present — name and email are most important)
  const criticalFields = ['name', 'email', 'company'];
  const criticalMatched = criticalFields.filter(f => matchedFields.has(f)).length;
  const totalMatched = matchedFields.size;
  const confidence = Math.min(100, Math.round(
    (criticalMatched / criticalFields.length) * 60 +  // 60% weight on critical fields
    (totalMatched / TARGET_FIELDS.length) * 40         // 40% weight on total coverage
  ));

  return { mapping, unmatchedHeaders, unmatchedFields, confidence };
}

/**
 * Build a reverse mapping: targetField → sourceHeader.
 * Useful for extracting data from rows using the mapping.
 */
export function buildReverseMapping(
  mapping: Record<string, TargetField>
): Record<TargetField, string> {
  const reverse: Partial<Record<TargetField, string>> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'skip' && field) {
      reverse[field] = header;
    }
  }
  return reverse as Record<TargetField, string>;
}