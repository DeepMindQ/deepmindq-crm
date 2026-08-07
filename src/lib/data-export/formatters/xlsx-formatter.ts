/**
 * XLSX Formatter — Task 4.6: Bulk Import/Export Pipeline
 *
 * Currently produces CSV-with-xlsx-extension as a placeholder.
 * TODO: Integrate a real Excel library (e.g., exceljs or xlsx) for
 * true .xlsx binary output with multiple sheets and formatting.
 *
 * The CSV content uses tab delimiters for better Excel compatibility
 * when the file is opened with .xlsx extension.
 */

import { Transform } from 'stream';
import { sanitizeString } from '@/lib/sanitize';

// ─── Configuration ──────────────────────────────────────────

export interface XlsxFormatterOptions {
  /** Sheet name. Default: "Sheet1" */
  sheetName?: string;
  /** Null/undefined value replacement. Default: empty string */
  nullValue?: string;
}

const DEFAULT_OPTIONS: Required<XlsxFormatterOptions> = {
  sheetName: 'Sheet1',
  nullValue: '',
};

// ─── Streaming XLSX Formatter (CSV-based placeholder) ───────

/**
 * Creates a Transform stream that converts objects to tab-delimited CSV.
 * Uses tab delimiter for better Excel compatibility.
 *
 * NOTE: This produces a CSV file with .xlsx extension.
 * TODO: Replace with real Excel library for binary .xlsx output.
 */
export function createXlsxFormatterStream(
  fields: string[],
  options: XlsxFormatterOptions = {},
): Transform {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let headerWritten = false;

  return new Transform({
    objectMode: true,
    transform(row: Record<string, unknown>, _encoding, callback) {
      const lines: string[] = [];
      const delimiter = '\t';

      if (!headerWritten) {
        const headerLine = fields
          .map((f) => escapeTabValue(f, opts.nullValue))
          .join(delimiter);
        lines.push(headerLine);
        headerWritten = true;
      }

      const dataLine = fields
        .map((f) => {
          const val = row[f];
          if (val instanceof Date) {
            return escapeTabValue(val.toISOString(), opts.nullValue);
          }
          if (typeof val === 'object' && val !== null) {
            return escapeTabValue(JSON.stringify(val), opts.nullValue);
          }
          return escapeTabValue(val, opts.nullValue);
        })
        .join(delimiter);

      lines.push(dataLine);
      callback(null, lines.join('\n') + '\n');
    },
    flush(callback) {
      callback();
    },
  });
}

/**
 * Synchronous XLSX formatting for small datasets.
 */
export function formatXlsxSync(
  rows: Record<string, unknown>[],
  fields: string[],
  options: XlsxFormatterOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = '\t';
  const lines: string[] = [];

  // Header
  lines.push(
    fields
      .map((f) => escapeTabValue(f, opts.nullValue))
      .join(delimiter),
  );

  // Data rows
  for (const row of rows) {
    lines.push(
      fields
        .map((f) => {
          const val = row[f];
          if (val instanceof Date) {
            return escapeTabValue(val.toISOString(), opts.nullValue);
          }
          if (typeof val === 'object' && val !== null) {
            return escapeTabValue(JSON.stringify(val), opts.nullValue);
          }
          return escapeTabValue(val, opts.nullValue);
        })
        .join(delimiter),
    );
  }

  return lines.join('\n');
}

/**
 * Get the Content-Type header for XLSX responses.
 */
export function getXlsxContentType(): string {
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

/**
 * Get the file extension for XLSX files.
 */
export function getXlsxExtension(): string {
  return '.xlsx';
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Escape a value for tab-delimited format.
 * Wraps in quotes if it contains tabs, newlines, or double-quotes.
 */
function escapeTabValue(
  value: unknown,
  nullValue: string = '',
): string {
  if (value === null || value === undefined) {
    return nullValue;
  }

  const raw = typeof value === 'string'
    ? sanitizeString(value)
    : String(value);

  if (raw.includes('\t') || raw.includes('\n') || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}
