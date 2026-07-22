/**
 * Excel Connector
 *
 * Parses Excel (.xlsx, .xls) file buffers into RawIntelligenceObject[].
 *
 * Config shape:
 *   {
 *     fileBuffer: ArrayBuffer,            // raw file bytes
 *     sheetIndex?: number,                 // specific sheet (0-based), omit for all
 *     columnMapping?: ColumnMapping[],     // explicit column mapping
 *     defaultCategory?: string,            // fallback knowledge category
 *   }
 *
 * Multi-sheet: up to 10 sheets processed when sheetIndex is omitted.
 * File size limit: 50 MB.
 * Row limit per sheet: 50,000.
 */

import * as XLSX from 'xlsx';
import { BaseConnector } from '../base-connector';
import type {
  ColumnMapping,
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorResult,
  RawIntelligenceObject,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_SHEETS = 10;
const MAX_ROWS_PER_SHEET = 50_000;

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

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Convert an XLSX row (object or array) to a Record<string, string>.
 * Handles array-style rows (indexed by column number) and object rows.
 */
function normalizeRow(
  row: unknown,
  headers: string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  if (Array.isArray(row)) {
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      const val = row[i];
      result[key] = val != null ? String(val).trim() : '';
    }
  } else if (row && typeof row === 'object') {
    for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
      result[key] = val != null ? String(val).trim() : '';
    }
  }

  return result;
}

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
 * Find a header that matches any of the given candidate names (case-insensitive).
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

/**
 * Process a single sheet's rows into RawIntelligenceObject[].
 */
function processSheet(
  sheetRows: Record<string, string>[],
  headers: string[],
  explicitMappings: ColumnMapping[],
  defaultCategory: string | undefined,
  sheetName: string
): {
  objects: RawIntelligenceObject[];
  skippedRows: number;
  companyColumn: string | null;
} {
  const companyCol = detectCompanyColumn(headers, explicitMappings);

  if (!companyCol) {
    return { objects: [], skippedRows: sheetRows.length, companyColumn: null };
  }

  // Build field map for optional explicit mappings
  const fieldMap = new Map<string, string>();
  for (const m of explicitMappings) {
    if (m.targetField !== 'company' && m.targetField !== 'content') {
      fieldMap.set(m.targetField, m.sourceColumn);
    }
  }

  const categoryCol =
    fieldMap.get('category') ??
    findHeaderByNames(headers, ['category', 'type', 'knowledge category']);
  const dateCol =
    fieldMap.get('date') ??
    findHeaderByNames(headers, ['date', 'created at', 'updated at']);
  const notesCol =
    fieldMap.get('notes') ??
    findHeaderByNames(headers, ['notes', 'comments', 'description']);
  const revenueCol =
    fieldMap.get('revenue') ??
    findHeaderByNames(headers, ['revenue', 'annual revenue', 'arr']);
  const industryCol =
    fieldMap.get('industry') ??
    findHeaderByNames(headers, ['industry', 'sector']);

  const objects: RawIntelligenceObject[] = [];
  let skippedRows = 0;

  for (let i = 0; i < sheetRows.length; i++) {
    const row = sheetRows[i]!;

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
      // XLSX serial dates come as numbers
      const raw = row[dateCol]!;
      const asNumber = Number(raw);
      if (!isNaN(asNumber) && raw === String(asNumber) && asNumber > 30000 && asNumber < 60000) {
        // Likely an Excel serial date number — convert via XLSX utility
        try {
          const jsDate = XLSX.SSF.parse_date_code(asNumber);
          capturedAt = new Date(jsDate.y, jsDate.m - 1, jsDate.d);
        } catch {
          // fall through to Date.parse
        }
      }
      if (!capturedAt) {
        const parsed = Date.parse(raw);
        if (!isNaN(parsed)) {
          capturedAt = new Date(parsed);
        }
      }
    }

    const obj: RawIntelligenceObject = {
      companyIdentifier: companyName.trim(),
      content,
      category,
      capturedAt,
      metadata: {
        source: 'excel_upload',
        sheet: sheetName,
        rowIndex: i + 1,
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
      obj.summary = row[notesCol];
    }

    objects.push(obj);
  }

  return { objects, skippedRows, companyColumn: companyCol };
}

// ─── Connector Implementation ──────────────────────────────────

export class ExcelConnector extends BaseConnector {
  readonly sourceType = 'excel' as const;
  readonly name = 'Excel File Upload';

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

    if (!config.fileBuffer || !(config.fileBuffer instanceof ArrayBuffer)) {
      errors.push('fileBuffer is required and must be an ArrayBuffer');
      return { valid: false, errors };
    }

    // Check file size
    const size = (config.fileBuffer as ArrayBuffer).byteLength;
    if (size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (size / (1024 * 1024)).toFixed(1);
      errors.push(
        `File size (${sizeMB} MB) exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit`
      );
    }

    return { valid: errors.length === 0, errors };
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
      const buffer = config.fileBuffer as ArrayBuffer;
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (workbook.SheetNames.length === 0) {
        return { success: false, message: 'Workbook contains no sheets' };
      }

      // Check first sheet for company column
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]!]!;
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
      const headers = (jsonData[0] ?? []).map((h) => String(h ?? '').trim()).filter(Boolean);

      if (headers.length === 0) {
        return { success: false, message: 'First sheet has no headers' };
      }

      const companyCol = detectCompanyColumn(headers, []);
      if (!companyCol) {
        return {
          success: false,
          message: `No company column detected in first sheet. Headers: ${headers.join(', ')}`,
        };
      }

      const rowCount = jsonData.length - 1; // exclude header
      return {
        success: true,
        message: `Excel looks valid: ${workbook.SheetNames.length} sheet(s), ` +
          `first sheet has ${rowCount} data rows, company column "${companyCol}"`,
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
      const buffer = config.fileBuffer as ArrayBuffer;
      const explicitMappings = (config.columnMapping ?? []) as ColumnMapping[];
      const defaultCategory = config.defaultCategory as string | undefined;
      const sheetIndex = config.sheetIndex as number | undefined;

      // Parse workbook
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (workbook.SheetNames.length === 0) {
        return this.createAcquisitionErrorResult('Workbook contains no sheets');
      }

      // Determine which sheets to process
      let sheetsToProcess: string[];
      if (sheetIndex !== undefined) {
        if (sheetIndex < 0 || sheetIndex >= workbook.SheetNames.length) {
          return this.createAcquisitionErrorResult(
            `sheetIndex ${sheetIndex} is out of range (workbook has ${workbook.SheetNames.length} sheets)`
          );
        }
        sheetsToProcess = [workbook.SheetNames[sheetIndex]!];
      } else {
        // Process all sheets, up to MAX_SHEETS
        sheetsToProcess = workbook.SheetNames.slice(0, MAX_SHEETS);
      }

      const allObjects: RawIntelligenceObject[] = [];
      const allErrors: string[] = [];
      let totalRows = 0;
      let totalSkipped = 0;
      const sheetSummaries: Array<{
        sheet: string;
        rows: number;
        objects: number;
        skipped: number;
      }> = [];

      for (const sheetName of sheetsToProcess) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          allErrors.push(`Sheet "${sheetName}" could not be read`);
          continue;
        }

        // Convert to array of arrays for header extraction
        const rawData = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
        }) as unknown[][];

        if (rawData.length < 2) {
          // Skip empty sheets (header only or completely empty)
          sheetSummaries.push({ sheet: sheetName, rows: 0, objects: 0, skipped: 0 });
          continue;
        }

        // Extract headers from first row
        const headers = (rawData[0] ?? [])
          .map((h) => String(h ?? '').trim())
          .filter(Boolean);

        if (headers.length === 0) {
          sheetSummaries.push({ sheet: sheetName, rows: 0, objects: 0, skipped: 0 });
          continue;
        }

        // Normalize remaining rows
        const sheetRows = rawData.slice(1, MAX_ROWS_PER_SHEET + 1).map((row) =>
          normalizeRow(row, headers)
        );

        totalRows += sheetRows.length;

        // Check for row limit
        if (rawData.length - 1 > MAX_ROWS_PER_SHEET) {
          allErrors.push(
            `Sheet "${sheetName}" has ${rawData.length - 1} rows; only first ${MAX_ROWS_PER_SHEET.toLocaleString()} processed`
          );
        }

        const { objects, skippedRows, companyColumn } = processSheet(
          sheetRows,
          headers,
          explicitMappings,
          defaultCategory,
          sheetName
        );

        if (!companyColumn) {
          allErrors.push(
            `Sheet "${sheetName}": no company column found. Headers: ${headers.join(', ')}`
          );
        }

        totalSkipped += skippedRows;
        allObjects.push(...objects);

        sheetSummaries.push({
          sheet: sheetName,
          rows: sheetRows.length,
          objects: objects.length,
          skipped: skippedRows,
        });
      }

      if (allObjects.length === 0) {
        return this.createAcquisitionErrorResult(
          `No valid intelligence objects extracted from any sheet. ` +
            (allErrors.length > 0 ? `Issues: ${allErrors.join('; ')}` : 'All rows were skipped or sheets were empty.')
        );
      }

      return this.createAcquisitionResult({
        success: true,
        intelligenceObjects: allObjects,
        errors: allErrors,
        metadata: {
          source: 'excel_upload',
          totalSheets: workbook.SheetNames.length,
          processedSheets: sheetsToProcess.length,
          totalRows,
          parsedObjects: allObjects.length,
          skippedRows: totalSkipped,
          sheetSummaries,
          fileSizeBytes: buffer.byteLength,
        },
      });
    } catch (err) {
      return this.createAcquisitionErrorResult(
        `Excel processing failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}