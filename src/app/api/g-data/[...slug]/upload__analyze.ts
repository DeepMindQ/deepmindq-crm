import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { analyzeFile } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/analyze
 *
 * Upload a file and get column detection + mapping suggestion.
 * Does NOT import anything — just analyzes the structure.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: Record<string, unknown>[];

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      return NextResponse.json({ error: 'Failed to parse file' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    const previewRows = rows.slice(0, 5);

    const result = await analyzeFile(headers, previewRows, rows.length, file.name);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[upload/analyze]', error.message);
    return NextResponse.json({ error: 'Analysis failed', detail: error.message }, { status: 500 });
  }
}