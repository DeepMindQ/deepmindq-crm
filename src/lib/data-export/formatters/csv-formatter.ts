/**
 * CSV Formatter — Task 4.6: Bulk Import/Export Pipeline
 *
 * Production-grade CSV formatting with configurable delimiter,
 * quoting strategy, and proper RFC 4180 escaping.
 */

import { Writable, Transform } from 'stream';
import { sanitizeString } from '@/lib/sanitize';

// ─── Configuration ──────────────────────────────────────────

export interface CsvFormatterOptions {
  /** Column delimiter. Default: `,` */
  delimiter?: string;
  /** Include header row. Default: true */
  header?: boolean;
  /** UTF-8 BOM for Excel compatibility. Default: true */
  bom?: boolean;
  /** Line ending. Default: `\r\n` for Excel */
  lineEnding?: string;
  /** Null/undefined value replacement. Default: empty string */
  nullValue?: string;
}

const DEFAULT_OPTIONS: Required<CsvFormatterOptions> = {
  delimiter: ',',
  header: true,
  bom: true,
  lineEnding: '\r\n',
  nullValue: '',
};

// ─── CSV Escaping (RFC 4180 compliant) ─────────────────────

/**
 * Escape a single CSV value according to RFC 4180.
 * - Fields containing delimiter, double-quote, or newline are quoted
 * - Double-quotes inside are escaped by doubling
 */
export function escapeCsvValue(
  value: unknown,
  delimiter: string = ',',
  nullValue: string = '',
): string {
  if (value === null || value === undefined) {
    return nullValue;
  }

  const raw = typeof value === 'string'
    ? sanitizeString(value)
    : String(value);

  if (raw.includes(delimiter) || raw.includes('"') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

// ─── Streaming CSV Formatter ────────────────────────────────

/**
 * Creates a Transform stream that converts objects to CSV lines.
 * Write objects, read CSV string chunks.
 *
 * Memory-efficient: processes one row at a time without buffering the entire dataset.
 */
export function createCsvFormatterStream(
  fields: string[],
  options: CsvFormatterOptions = {},
): Transform {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let headerWritten = false;
  let rowCount = 0;

  return new Transform({
    objectMode: true,
    transform(row: Record<string, unknown>, _encoding, callback) {
      const lines: string[] = [];

      // Write header on first row
      if (!headerWritten && opts.header) {
        const headerLine = fields
          .map((f) => escapeCsvValue(f, opts.delimiter, opts.nullValue))
          .join(opts.delimiter);
        lines.push(headerLine);
        headerWritten = true;
      }

      // Write data row
      const dataLine = fields
        .map((f) => {
          const val = row[f];
          // Handle Date objects
          if (val instanceof Date) {
            return escapeCsvValue(val.toISOString(), opts.delimiter, opts.nullValue);
          }
          // Handle JSON fields (arrays, objects)
          if (typeof val === 'object' && val !== null) {
            return escapeCsvValue(JSON.stringify(val), opts.delimiter, opts.nullValue);
          }
          return escapeCsvValue(val, opts.delimiter, opts.nullValue);
        })
        .join(opts.delimiter);

      lines.push(dataLine);
      rowCount++;

      callback(null, lines.join(opts.lineEnding) + opts.lineEnding);
    },
    flush(callback) {
      // No trailing cleanup needed
      callback();
    },
  });
}

/**
 * Get the BOM string for UTF-8 Excel compatibility.
 */
export function getCsvBom(): string {
  return '\uFEFF';
}

/**
 * Synchronous CSV formatting for small datasets.
 * Returns the complete CSV string.
 */
export function formatCsvSync(
  rows: Record<string, unknown>[],
  fields: string[],
  options: CsvFormatterOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  if (opts.bom) {
    lines.push(getCsvBom());
  }

  if (opts.header) {
    lines.push(
      fields
        .map((f) => escapeCsvValue(f, opts.delimiter, opts.nullValue))
        .join(opts.delimiter),
    );
  }

  for (const row of rows) {
    lines.push(
      fields
        .map((f) => {
          const val = row[f];
          if (val instanceof Date) {
            return escapeCsvValue(val.toISOString(), opts.delimiter, opts.nullValue);
          }
          if (typeof val === 'object' && val !== null) {
            return escapeCsvValue(JSON.stringify(val), opts.delimiter, opts.nullValue);
          }
          return escapeCsvValue(val, opts.delimiter, opts.nullValue);
        })
        .join(opts.delimiter),
    );
  }

  return lines.join(opts.lineEnding);
}

/**
 * Get the Content-Type header for CSV responses.
 */
export function getCsvContentType(): string {
  return 'text/csv; charset=utf-8';
}

/**
 * Get the file extension for CSV files.
 */
export function getCsvExtension(): string {
  return '.csv';
}
