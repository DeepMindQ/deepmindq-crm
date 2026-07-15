/**
 * export-seed-data.js
 * Exports SQLite data to JSON files for cloud seeding.
 * Run: node scripts/export-seed-data.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'db', 'custom.db'));
const outDir = path.join(__dirname, 'seed-data');

console.log('Exporting seed data from SQLite...');

// Meta
const batch = db.prepare('SELECT * FROM ImportBatch LIMIT 1').get();
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
  fileName: batch?.fileName || 'KSA-40K-contacts.xlsx',
  fileHash: 'ksa40k',
  totalRows: batch?.totalRows || 40986,
  acceptedRows: batch?.acceptedRows || 40982,
}, null, 2));
console.log('  ✓ meta.json');

// Companies
const companies = db.prepare('SELECT id, rawName, normalizedName, domain, industry, sizeRange, location, country, website, tags, status, lifecycleStage, intelligenceScore, engagementScore, source FROM Company').all();
fs.writeFileSync(path.join(outDir, 'companies.json'), JSON.stringify(companies));
console.log(`  ✓ companies.json (${companies.length} rows)`);

// Contacts (limited fields to keep file size manageable)
const contacts = db.prepare('SELECT id, rawName, normalizedName, email, title, role, linkedinUrl, companyId, source, leadScore, companyFitScore, engagementScore, enrichmentScore, aiConversionScore FROM Contact').all();
fs.writeFileSync(path.join(outDir, 'contacts.json'), JSON.stringify(contacts));
console.log(`  ✓ contacts.json (${contacts.length} rows)`);

// Segments (just the definitions)
const segments = db.prepare('SELECT * FROM Segment').all();
fs.writeFileSync(path.join(outDir, 'segments.json'), JSON.stringify(segments));
console.log(`  ✓ segments.json (${segments.length} rows)`);

const size = ['companies.json', 'contacts.json', 'meta.json', 'segments.json']
  .map(f => `${(fs.statSync(path.join(outDir, f)).size / 1024 / 1024).toFixed(1)}MB ${f}`).join(', ');
console.log(`\n✅ Done. Files: ${size}`);
db.close();