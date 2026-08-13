// ═══════════════════════════════════════════════════════════════════════════
// File Parsers — CSV and Excel row parsing
// ═══════════════════════════════════════════════════════════════════════════

export type ParsedRow = Record<string, string>;

/**
 * Parse CSV text into an array of row objects.
 * Handles quoted fields, commas inside quotes, and BOM.
 */
export async function parseCSV(csvText: string): Promise<ParsedRow[]> {
  // Remove BOM if present
  const cleanText = csvText.replace(/^\uFEFF/, '');

  const lines = cleanText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      const normalizedHeader = header.trim().toLowerCase();
      if (normalizedHeader) {
        row[normalizedHeader] = (values[idx] || '').trim();
      }
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse Excel file into rows.
 * Uses exceljs for .xlsx/.xls files.
 */
export async function parseExcelRow(buffer: Buffer): Promise<ParsedRow[]> {
  // Dynamic import to avoid bundling exceljs when not needed
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  const rows: ParsedRow[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim().toLowerCase();
  });

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const rowObj: ParsedRow = {};

    let hasData = false;
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        const value = formatCellValue(cell.value);
        rowObj[header] = value;
        if (value) hasData = true;
      }
    });

    if (hasData) {
      rows.push(rowObj);
    }
  }

  return rows;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
    return String((value as { text: string }).text);
  }
  return String(value);
}
