import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';

/* ═══════════════════════════════════════════════════
   L-08: Batch Import Preview
   
   POST: Parse file and return headers, detected mapping,
         preview rows, and total row count. Does NOT import.
   ═══════════════════════════════════════════════════ */

// Same column detection logic as batches/route.ts
function guessMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const low = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/^(name|fullname|contactname|personname)$/.test(low)) map[h] = 'name';
    else if (/^(email|emailaddress|email_address|mailto)$/.test(low)) map[h] = 'email';
    else if (/^(company|companyname|organization|org|account|firm)$/.test(low)) map[h] = 'company';
    else if (/^(title|jobtitle|job_title|role|position|designation)$/.test(low)) map[h] = 'title';
    else if (/^(phone|telephone|tel|mobile|phonenumber)$/.test(low)) map[h] = 'phone';
    else if (/^(linkedin|linkedinurl|linkedin_url|li)$/.test(low)) map[h] = 'linkedin';
    else if (/^(location|city|country|address)$/.test(low)) map[h] = 'location';
    else if (/^(industry|sector|vertical)$/.test(low)) map[h] = 'industry';
    else if (/^(website|url|web|site)$/.test(low)) map[h] = 'website';
    else if (/^(domain)$/.test(low)) map[h] = 'domain';
  }
  return map;
}

const MAPPING_FIELDS = ['name', 'email', 'company', 'title', 'phone', 'linkedin', 'location', 'industry', 'website', 'domain', '— skip —'];

export async function POST(request: Request) {
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
    const detectedMapping = guessMapping(headers);
    const previewRows = rows.slice(0, 5);

    return NextResponse.json({
      headers,
      detectedMapping,
      availableFields: MAPPING_FIELDS,
      previewRows,
      totalRows: rows.length,
      fileName: file.name,
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}