/**
 * XLSX Formatter — Task 4.6: Bulk Import/Export Pipeline
 *
 * Produces real .xlsx binary output using ExcelJS.
 * Supports streaming via workbook.xlsx.writeBuffer() for large datasets.
 *
 * Note: The legacy formatXlsxSync() has been removed. All export paths
 * use the async formatXlsxToBuffer() or the streaming Transform.
 */

import ExcelJS from 'exceljs';

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

// ─── Streaming XLSX Formatter ──────────────────────────────

/**
 * Creates a Transform stream that buffers objects and produces real .xlsx binary output.
 * ExcelJS doesn't support true row-by-row streaming, so we buffer all rows and
 * flush the complete workbook at the end.
 */
export function createXlsxFormatterStream(
  fields: string[],
  options: XlsxFormatterOptions = {},
): import('stream').Transform {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rows: Record<string, unknown>[] = [];

  // We use a simple Transform that buffers, then outputs the xlsx buffer on flush
  const { Transform } = require('stream');
  let headerWritten = false;

  return new Transform({
    objectMode: true,
    transform(row: Record<string, unknown>, _encoding: string, callback: (err: Error | null, data?: Buffer) => void) {
      rows.push(row);
      callback(null);
    },
    async flush(callback: (err: Error | null, data?: Buffer) => void) {
      try {
        const buffer = await formatXlsxToBuffer(rows, fields, opts);
        callback(null, buffer);
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

/**
 * Format rows as a real .xlsx Buffer (async).
 * This is the primary export method for XLSX format.
 */
export async function formatXlsxToBuffer(
  rows: Record<string, unknown>[],
  fields: string[],
  options: XlsxFormatterOptions = {},
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DeepMindQ Enterprise';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(opts.sheetName, {
    properties: { defaultColWidth: 15 },
  });

  // Add header row with styling
  const headerRow = worksheet.addRow(fields);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF426272' },
  };
  worksheet.getRow(1).height = 22;

  // Add data rows
  for (const row of rows) {
    const values = fields.map(f => {
      const val = row[f];
      if (val === null || val === undefined) return opts.nullValue;
      if (val instanceof Date) return val;
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val).replace(/[\x00-\x1F]/g, ''); // Strip control characters
    });
    worksheet.addRow(values);
  }

  // Auto-fit column widths (best effort)
  worksheet.columns.forEach((column, i) => {
    let maxLen = String(fields[i] || '').length;
    for (const row of rows) {
      const val = row[fields[i]];
      if (val !== null && val !== undefined) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    column.width = Math.min(Math.max(maxLen + 2, 10), 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
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
