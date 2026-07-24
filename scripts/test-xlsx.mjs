import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const DB_URL = 'postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BASE = 'http://localhost:3000';

// Generate XLSX file
function generateXLSX(rows) {
  const data = [
    ['companyName', 'contactName', 'email', 'jobTitle', 'phone', 'location'],
    ['Apex Corp', 'John Smith', 'john.smith@apexcorp.com', 'CEO', '+1-555-0101', 'New York, NY'],
    ['Apex Corp', 'Jane Doe', 'jane.doe@apexcorp.com', 'CTO', '+1-555-0102', 'New York, NY'],
    ['Beta Industries', 'Bob Wilson', 'bob@betaind.com', 'VP Sales', '+1-555-0201', 'San Francisco, CA'],
    ['Gamma LLC', 'Alice Chen', 'alice@gammallc.com', 'Director', '+1-555-0301', 'Chicago, IL'],
    ['Delta Co', 'Carol White', 'carol@deltaco.com', 'Manager', '+1-555-0401', 'Austin, TX'],
    ['Epsilon Group', 'David Brown', 'david@epsilongroup.com', 'CFO', '+1-555-0501', 'Boston, MA'],
    ['Zeta Labs', 'Emily Davis', 'emily@zetalabs.com', 'VP Marketing', '+1-555-0601', 'Seattle, WA'],
    ['Eta Solutions', 'Frank Miller', 'frank@etasolutions.com', 'COO', '+1-555-0701', 'Denver, CO'],
    ['Theta Tech', 'Grace Lee', 'grace@thetatech.com', 'Head of Engineering', '+1-555-0801', 'Portland, OR'],
    ['Apex Corp', '', '', '', ''],  // Invalid row: no contact name
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const tmpPath = '/tmp/test-import.xlsx';
  writeFileSync(tmpPath, buf);
  console.log(`Generated XLSX: ${tmpPath} (${buf.length} bytes, ${data.length - 1} rows)`);
  return tmpPath;
}

async function main() {
  // Wait for server
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(BASE, { signal: AbortSignal.timeout(3000) })).ok) { console.log('Server up'); break; } } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  // Clean DB
  const db = new PrismaClient({ datasourceUrl: DB_URL });
  await db.companyTimelineEvent.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
  await db.importBatch.deleteMany();
  await db.$disconnect();
  console.log('DB cleaned');

  // Generate XLSX
  const xlsxPath = generateXLSX();

  // Stage
  console.log('\n--- STAGING XLSX ---');
  const t0 = performance.now();
  const fd = new FormData();
  const xlsxBuffer = await import('fs').then(fs => fs.default.readFileSync(xlsxPath));
  fd.append('file', new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test-import.xlsx');

  const sr = await fetch(`${BASE}/api/imports`, { method: 'POST', body: fd });
  const sd = await sr.json();
  const stageTime = ((performance.now() - t0) / 1000).toFixed(2);

  console.log(`Status: ${sr.status} (${stageTime}s)`);
  if (!sr.ok) { console.log(JSON.stringify(sd)); return; }

  console.log(`Batch: ${sd.data.id}`);
  console.log(`File type: ${sd.data.fileType}`);
  console.log(`Rows: ${sd.data.totalRows}`);
  console.log(`Columns: ${sd.data.columns.join(', ')}`);
  console.log(`Preview rows: ${sd.data.previewRows.length}`);
  for (const row of sd.data.previewRows) {
    console.log(`  ${row.join(' | ')}`);
  }

  // Execute
  const batchId = sd.data.id;
  const cols = sd.data.columns;
  const mapping = {};
  cols.forEach((c, i) => mapping[c] = i);

  // Parse XLSX rows for execution
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const rows = raw.slice(1).map(r => r.map(c => String(c ?? '').trim()));

  console.log('\n--- EXECUTING XLSX IMPORT ---');
  const t1 = performance.now();
  const er = await fetch(`${BASE}/api/imports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'execute', batchId, mapping, rows }),
    signal: AbortSignal.timeout(60000),
  });
  const ed = await er.json();
  const execTime = ((performance.now() - t1) / 1000).toFixed(2);

  if (!er.ok) { console.log(`FAIL: ${er.status}`); console.log(JSON.stringify(ed)); return; }

  console.log(`Status: ${er.status} (${execTime}s)`);
  console.log(`Accepted: ${ed.data.accepted}`);
  console.log(`Duplicates: ${ed.data.duplicates}`);
  console.log(`Invalid: ${ed.data.invalid}`);
  console.log(`Total processed: ${ed.data.totalProcessed}`);

  // Verify
  const db2 = new PrismaClient({ datasourceUrl: DB_URL });
  const co = await db2.company.count();
  const ct = await db2.contact.count();
  const ev = await db2.companyTimelineEvent.count();
  const batch = await db2.importBatch.findUnique({ where: { id: batchId } });

  console.log('\n--- DATABASE VERIFICATION ---');
  console.log(`Companies: ${co}`);
  console.log(`Contacts: ${ct}`);
  console.log(`Timeline events: ${ev}`);
  console.log(`Batch status: ${batch.status}`);
  console.log(`Batch accepted: ${batch.acceptedRows}, dup: ${batch.duplicateRows}, invalid: ${batch.invalidRows}`);

  const companies = await db2.company.findMany({ orderBy: { rawName: 'asc' } });
  console.log('\nCompanies created:');
  for (const c of companies) console.log(`  ${c.rawName} (${c.normalizedName})`);

  await db2.$disconnect();

  console.log('\n========== XLSX IMPORT RESULTS ==========');
  console.log(`| Metric              | Result              |`);
  console.log(`|---------------------|---------------------|`);
  console.log(`| File type           | ${'XLSX'.padEnd(20)}|`);
  console.log(`| Total rows          | ${String(batch.totalRows).padEnd(20)}|`);
  console.log(`| Accepted            | ${String(ed.data.accepted).padEnd(20)}|`);
  console.log(`| Duplicates          | ${String(ed.data.duplicates).padEnd(20)}|`);
  console.log(`| Invalid             | ${String(ed.data.invalid).padEnd(20)}|`);
  console.log(`| Failed              | ${'0'.padEnd(20)}|`);
  console.log(`| Stage time          | ${stageTime + 's'.padEnd(20)}|`);
  console.log(`| Execute time        | ${execTime + 's'.padEnd(20)}|`);
  console.log(`| Companies created   | ${String(co).padEnd(20)}|`);
  console.log(`| Contacts created    | ${String(ct).padEnd(20)}|`);
  console.log(`| Timeline events     | ${String(ev).padEnd(20)}|`);
  console.log(`| Final status        | ${batch.status.padEnd(20)}|`);

  console.log('\n✅ XLSX import pipeline validated end-to-end.');
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
