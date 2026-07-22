/**
 * CSV Connector
 *
 * Parses CSV file content into RawIntelligenceObject[].
 *
 * Config shape:
 *   {
 *     fileContent: string,              // raw CSV text
 *     columnMapping?: ColumnMapping[],  // explicit column mapping
 *     defaultCategory?: string,         // fallback knowledge category
 *   }
 *
 * Auto-detection: scans headers for common company column names
 * (company, account name, organization, customer, etc.).
 *
 * Row limit: 50,000 rows.
 */

import { BaseConnector } from '../base-connector';
import type {
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorResult,
  ColumnMapping,
  RawIntelligenceObject,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────

const MAX_ROWS = 50_000;

/** Header names (lowercased) that map to the "company" target field */
const COMPANY_HEADER_PATTERNS = [
  'company',
  'account name',
  'organization',
  'customer',
  'account',
  'company name',
  'organisation',
  'firm',
  'client',
  'account_name',
  'company_name',
  'org',
  'org name',
];

// ─── Simple CSV Parser ─────────────────────────────────────────
// No csv-parse package installed, so we use a lightweight RFC-4180-
// compliant parser that handles quoted fields with embedded commas.

/**
 * Parse a CSV string into an array of row objects keyed by header.
 * Handles quoted fields containing commas and newlines.
 */
function parseCsv(content: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const records = splitRecords(content);

  if (records.length < 2) return rows; // need at least a header + 1 data row

  const headers = parseFields(records[0]);
  for (let i = 1; i < records.length; i++) {
    const values = parseFields(records[i]);
    if (values.length === 0) continue; // skip blank rows

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = (headers[j] ?? '').trim();
      if (!key) continue;
      row[key] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Split CSV content into records (rows), respecting quoted newlines.
 */
function splitRecords(content: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          // Escaped quote — keep one quote
          current += '"';
          i++; // skip next char
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === '\r' && next === '\n') {
        // CRLF line ending
        records.push(current);
        current = '';
        i++; // skip the \n
      } else if (ch === '\n') {
        // LF line ending
        records.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // Push last record if non-empty
  if (current.trim()) {
    records.push(current);
  }

  return records;
}

/**
 * Split a single CSV record into fields, respecting quoted commas.
 */
function parseFields(record: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < record.length; i++) {
    const ch = record[i]!;
    const next = record[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

// ─── Column Auto-Detection ─────────────────────────────────────

/**
 * Try to auto-detect which header column contains the company name.
 * Returns the header key if found, or null.
 */
function detectCompanyColumn(
  headers: string[],
  explicitMappings: ColumnMapping[]
): string | null {
  // If explicit mapping provided, use it
  const companyMapping = explicitMappings.find((m) => m.targetField === 'company');
  if (companyMapping) return companyMapping.sourceColumn;

  // Otherwise, scan for known company header patterns
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    if (COMPANY_HEADER_PATTERNS.includes(normalized)) {
      return header;
    }
  }

  return null;
}

/**
 * Build a map of targetField → sourceColumn from explicit mappings,
 * used to extract category, date, etc.
 */
function buildFieldMap(
  mappings: ColumnMapping[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of mappings) {
    if (m.targetField !== 'company' && m.targetField !== 'content') {
      map.set(m.targetField, m.sourceColumn);
    }
  }
  return map;
}

// ─── Connector Implementation ──────────────────────────────────

export class CsvConnector extends BaseConnector {
  readonly sourceType = 'csv' as const;
  readonly name = 'CSV File Upload';

  // ── Legacy run() adapter ───────────────────────────────────────

  async run(config: ConnectorConfig): Promise<ConnectorResult> {
    const result = await this.acquire(config);
    const status = result.success ? 'success' : 'error';
    return this.createResult(
      status,
      result.intelligenceObjects,
      result.errors.map((e) => this.msg('error', e)),
    );
  }

  // ── validateConfig ───────────────────────────────────────────

  validateConfig(config: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.fileContent || typeof config.fileContent !== 'string') {
      errors.push('fileContent is required and must be a string');
      return { valid: false, errors };
    }

    if (config.fileContent.trim().length === 0) {
      errors.push('fileContent is empty');
      return { valid: false, errors };
    }

    return { valid: true, errors };
  }

  // ── test ─────────────────────────────────────────────────────

  async test(config: Record<string, unknown>): Promise<{
    success: boolean;
    message: string;
  }> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.errors.join('; ') };
    }

    try {
      const rows = parseCsv(config.fileContent as string);
      if (rows.length === 0) {
        return { success: false, message: 'CSV has headers but no data rows' };
      }

      const headers = Object.keys(rows[0]!);
      const companyCol = detectCompanyColumn(headers, []);

      if (!companyCol) {
        return {
          success: false,
          message: `No company column detected. Headers: ${headers.join(', ')}`,
        };
      }

      return {
        success: true,
        message: `CSV looks valid: ${rows.length} rows, company column "${companyCol}" detected`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── acquire ──────────────────────────────────────────────────

  async acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult> {
    // Validate
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return this.createAcquisitionErrorResult(validation.errors.join('; '));
    }

    try {
      const fileContent = config.fileContent as string;
      const explicitMappings = (config.columnMapping ?? []) as ColumnMapping[];
      const defaultCategory = config.defaultCategory as string | undefined;

      const rows = parseCsv(fileContent);

      if (rows.length === 0) {
        return this.createAcquisitionErrorResult('CSV contains headers but no data rows');
      }

      // Enforce row limit
      if (rows.length > MAX_ROWS) {
        return this.createAcquisitionErrorResult(
          `CSV exceeds maximum of ${MAX_ROWS.toLocaleString()} rows (found ${rows.length.toLocaleString()})`
        );
      }

      const headers = Object.keys(rows[0]!);
      const companyCol = detectCompanyColumn(headers, explicitMappings);

      if (!companyCol) {
        return this.createAcquisitionErrorResult(
          `No company column found. Headers: ${headers.join(', ')}. ` +
            `Expected a column named "company", "account name", "organization", or "customer".`
        );
      }

      // Build field map for optional explicit mappings
      const fieldMap = buildFieldMap(explicitMappings);
      const categoryCol =
        fieldMap.get('category') ??
        findHeaderByNames(headers, ['category', 'type', 'knowledge category']);
      const dateCol =
        fieldMap.get('date') ?? findHeaderByNames(headers, ['date', 'created at', 'updated at']);
      const notesCol =
        fieldMap.get('notes') ?? findHeaderByNames(headers, ['notes', 'comments', 'description']);
      const revenueCol = fieldMap.get('revenue') ??
        findHeaderByNames(headers, ['revenue', 'annual revenue', 'arr']);
      const industryCol = fieldMap.get('industry') ??
        findHeaderByNames(headers, ['industry', 'sector']);

      // Parse rows into intelligence objects
      const objects: RawIntelligenceObject[] = [];
      const errors: string[] = [];
      let skippedRows = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;

        // Company name is required per row
        const companyName = row[companyCol];
        if (!companyName || companyName.trim().length === 0) {
          skippedRows++;
          continue;
        }

        // Build content from all non-company fields
        const contentParts: string[] = [];
        for (const [key, value] of Object.entries(row)) {
          if (key === companyCol || !value) continue;
          contentParts.push(`${key}: ${value}`);
        }

        const content = contentParts.join('\n');
        if (!content.trim()) {
          skippedRows++;
          continue;
        }

        // Extract category
        let category: string | undefined = defaultCategory;
        if (categoryCol && row[categoryCol]) {
          category = row[categoryCol]!;
        }

        // Parse date if present
        let capturedAt: Date | undefined;
        if (dateCol && row[dateCol]) {
          const parsed = Date.parse(row[dateCol]!);
          if (!isNaN(parsed)) {
            capturedAt = new Date(parsed);
          }
        }

        const obj: RawIntelligenceObject = {
          companyIdentifier: companyName.trim(),
          content,
          category,
          capturedAt,
          metadata: {
            source: 'csv_upload',
            rowIndex: i + 1, // 1-based for human readability
          },
        };

        // Attach optional structured fields to metadata
        if (revenueCol && row[revenueCol]) {
          obj.metadata!.revenue = row[revenueCol];
        }
        if (industryCol && row[industryCol]) {
          obj.metadata!.industry = row[industryCol];
        }
        if (notesCol && row[notesCol]) {
          obj.metadata!.notes = row[notesCol];
          obj.summary = row[notesCol]; // use notes as summary if available
        }

        objects.push(obj);
      }

      if (objects.length === 0) {
        return this.createAcquisitionErrorResult(
          `No valid rows found (all ${rows.length} rows were skipped — missing company names or empty content)`
        );
      }

      // Build result
      return this.createAcquisitionResult({
        success: true,
        intelligenceObjects: objects,
        errors,
        metadata: {
          totalRows: rows.length,
          parsedObjects: objects.length,
          skippedRows,
          companyColumn: companyCol,
          headers,
          source: 'csv_upload',
        },
      });
    } catch (err) {
      return this.createAcquisitionErrorResult(
        `CSV processing failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Find a header that matches any of the given candidate names (case-insensitive).
 * Returns the original header key or undefined.
 */
function findHeaderByNames(
  headers: string[],
  candidates: string[]
): string | undefined {
  const lowered = new Set(candidates.map((c) => c.toLowerCase()));
  for (const header of headers) {
    if (lowered.has(header.trim().toLowerCase())) {
      return header;
    }
  }
  return undefined;
}