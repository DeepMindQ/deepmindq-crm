// POST /api/g-intel-acquisition/upload  → upload CSV/Excel file, parse, return preview

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// ─── Constants ──────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const PREVIEW_ROWS = 5;

/** Header patterns from CsvConnector / ExcelConnector */
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

// ─── Helpers ────────────────────────────────────────────────────

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function detectCompanyColumn(headers: string[]): string | null {
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    if (COMPANY_HEADER_PATTERNS.includes(normalized)) {
      return header;
    }
  }
  return null;
}

// ─── Lightweight CSV Parser (RFC-4180) ──────────────────────────

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === '\r' && next === '\n') { records.push(current); current = ''; i++; }
      else if (ch === '\n') { records.push(current); current = ''; }
      else { current += ch; }
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

function parseCsvFields(record: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < record.length; i++) {
    const ch = record[i]!;
    const next = record[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsvPreview(content: string): {
  columns: string[];
  rows: string[][];
} {
  const records = splitCsvRecords(content);
  if (records.length < 1) return { columns: [], rows: [] };

  const columns = parseCsvFields(records[0]!);
  const rows: string[][] = [];
  const dataRecords = records.slice(1, PREVIEW_ROWS + 1);
  for (const rec of dataRecords) {
    const fields = parseCsvFields(rec);
    if (fields.length === 0 || fields.every((f) => f === '')) continue;
    rows.push(fields);
  }
  return { columns, rows };
}

// ─── Lightweight Excel Parser ───────────────────────────────────

function parseExcelPreview(buffer: ArrayBuffer): {
  columns: string[];
  rows: string[][];
  totalRowCount: number;
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  if (workbook.SheetNames.length === 0) return { columns: [], rows: [], totalRowCount: 0 };

  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  if (rawData.length < 1) return { columns: [], rows: [], totalRowCount: 0 };

  const columns = (rawData[0] ?? []).map((h) => String(h ?? '').trim());
  const rows: string[][] = [];
  const dataRows = rawData.slice(1, PREVIEW_ROWS + 1);
  for (const row of dataRows) {
    const fields = (Array.isArray(row) ? row : []).map((v) => String(v ?? '').trim());
    if (fields.every((f) => f === '')) continue;
    rows.push(fields);
  }
  return { columns, rows, totalRowCount: Math.max(0, rawData.length - 1) };
}

// ─── POST handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Use form field named "file".' }, { status: 400 });
    }

    // Validate extension
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({
        error: `Invalid file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json({
        error: `File size (${sizeMB} MB) exceeds the ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`,
      }, { status: 400 });
    }

    // Parse based on file type
    let columns: string[];
    let rows: string[][];
    let rowCount: number;

    if (ext === '.csv') {
      const text = await file.text();
      const parsed = parseCsvPreview(text);
      columns = parsed.columns;
      rows = parsed.rows;
      const allRecords = splitCsvRecords(text);
      rowCount = Math.max(0, allRecords.length - 1);
    } else {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelPreview(buffer);
      columns = parsed.columns;
      rows = parsed.rows;
      rowCount = parsed.totalRowCount;
    }

    // Detect company column using the same logic as connectors
    const detectedCompanyColumn = detectCompanyColumn(columns);

    return NextResponse.json({
      columns,
      rowCount,
      preview: rows,
      detectedCompanyColumn,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload processing failed';
    console.error('[g-intel-acquisition:upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}