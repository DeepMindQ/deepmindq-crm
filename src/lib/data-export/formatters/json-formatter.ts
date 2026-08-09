/**
 * JSON Formatter — Task 4.6: Bulk Import/Export Pipeline
 *
 * Formats data as JSON array with configurable indentation.
 * Supports streaming via NDJSON (newline-delimited JSON) for large datasets.
 */

import { Transform } from 'stream';
import { sanitizeString } from '@/lib/sanitize';

// ─── Configuration ──────────────────────────────────────────

export interface JsonFormatterOptions {
  /** Indentation spaces for pretty-print. 0 = minified. Default: 2 */
  indent?: number;
  /** Use NDJSON (one JSON object per line) for streaming. Default: false */
  ndjson?: boolean;
}

const DEFAULT_OPTIONS: Required<JsonFormatterOptions> = {
  indent: 2,
  ndjson: false,
};

// ─── Streaming JSON Formatter ────────────────────────────────

/**
 * Creates a Transform stream that converts objects to JSON.
 *
 * In NDJSON mode: each row is a separate JSON object followed by a newline.
 * In array mode: outputs `[` first row, then `,{row}` for subsequent rows, then `]`.
 */
export function createJsonFormatterStream(
 options: JsonFormatterOptions = {},
): Transform {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let rowIndex = 0;

  if (opts.ndjson) {
    return new Transform({
      objectMode: true,
      transform(row: Record<string, unknown>, _encoding, callback) {
        const sanitized = sanitizeRow(row);
        callback(null, JSON.stringify(sanitized) + '\n');
        rowIndex++;
      },
    });
  }

  // Array mode
  return new Transform({
    objectMode: true,
    transform(row: Record<string, unknown>, _encoding, callback) {
      const sanitized = sanitizeRow(row);
      const prefix = rowIndex === 0 ? '[\n' : ',\n';
      const line = typeof opts.indent === 'number' && opts.indent > 0
        ? prefix + ' '.repeat(opts.indent) + JSON.stringify(sanitized)
        : prefix + JSON.stringify(sanitized);
      rowIndex++;
      callback(null, line);
    },
    flush(callback) {
      const suffix = rowIndex > 0 && typeof opts.indent === 'number' && opts.indent > 0
        ? '\n]'
        : rowIndex > 0 ? ']' : '[]';
      callback(null, suffix);
    },
  });
}

/**
 * Synchronous JSON formatting for small datasets.
 */
export function formatJsonSync(
  rows: Record<string, unknown>[],
  options: JsonFormatterOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sanitized = rows.map(sanitizeRow);

  if (opts.ndjson) {
    return sanitized.map((r) => JSON.stringify(r)).join('\n') + '\n';
  }

  return JSON.stringify(sanitized, null, opts.indent);
}

/**
 * Get the Content-Type header for JSON responses.
 */
export function getJsonContentType(options: JsonFormatterOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return opts.ndjson
    ? 'application/x-ndjson; charset=utf-8'
    : 'application/json; charset=utf-8';
}

/**
 * Get the file extension for JSON files.
 */
export function getJsonExtension(options: JsonFormatterOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return opts.ndjson ? '.ndjson' : '.json';
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Sanitize a row's string values to prevent XSS in exported data.
 */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (value !== null && value !== undefined && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = deepSanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Deep sanitize an object or array.
 */
function deepSanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = deepSanitize(v);
    }
    return result;
  }
  return value;
}