#!/usr/bin/env node
/**
 * Phase C — Index Verification Script
 *
 * Extracts all @@index declarations from prisma/schema.prisma,
 * cross-references them against the migration SQL files,
 * and reports any missing or mismatched indexes.
 *
 * Usage: node scripts/verify-indexes.js
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function extractIndexesFromSchema() {
  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const indexes = [];
  
  // Match model blocks
  const modelRegex = /model\s+(\w+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;
  let match;
  
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const modelBody = match[2];
    
    // Match @@index([...fields]) declarations
    const indexRegex = /@@index\(\[([^\]]+)\](?:,\s*(map:\s*"([^"]+)")?)?\)/g;
    let idxMatch;
    
    while ((idxMatch = indexRegex.exec(modelBody)) !== null) {
      const fields = idxMatch[1].trim();
      const mapName = idxMatch[3]; // optional map name
      
      // Parse fields - handle quoted, unquoted, and sort directions
      const fieldList = fields.split(',').map(f => {
        const trimmed = f.trim();
        // Remove sort direction if present
        const namePart = trimmed.replace(/\s+(ASC|DESC)\s*$/i, '').trim();
        // Remove quotes and sort annotation like (sort: Desc)
        return namePart.replace(/"/g, '').replace(/\(sort:\s*Desc\)/gi, '').replace(/\(sort:\s*Asc\)/gi, '').trim();
      });
      
      // Generate expected index name (Prisma convention)
      const expectedName = mapName || fieldList.join('_') + '_idx';
      
      indexes.push({
        model: modelName,
        fields: fieldList,
        mapName,
        expectedIndexName: expectedName,
        declaration: idxMatch[0],
      });
    }
  }
  
  return indexes;
}

function extractIndexesFromMigrations() {
  const allSql = [];
  const migrationDirs = fs.readdirSync(MIGRATIONS_DIR).filter(
    d => d !== 'migration_lock.toml'
  ).sort();
  
  for (const dir of migrationDirs) {
    const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      allSql.push({ dir, sql });
    }
  }
  
  // Extract CREATE INDEX statements (handles IF NOT EXISTS)
  const indexStatements = [];
  const createIndexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"\s+ON\s+"?(\w+)"?\s*\(([^)]+)\)/gi;
  
  for (const { dir, sql } of allSql) {
    let m;
    while ((m = createIndexRegex.exec(sql)) !== null) {
      indexStatements.push({
        migration: dir,
        unique: !!m[1],
        indexName: m[2],
        tableName: m[3],
        columns: m[4].split(',').map(c => {
          const trimmed = c.trim().replace(/"/g, '');
          // Remove sort direction and DESC/ASC
          return trimmed.split(/\s+/)[0].replace(/"/g, '');
        }),
        raw: m[0],
      });
    }
  }
  
  return indexStatements;
}

function main() {
  console.log('═'.repeat(80));
  console.log('  Phase C — Index Verification Report');
  console.log('═'.repeat(80));
  console.log('');
  
  // 1. Extract from schema
  const schemaIndexes = extractIndexesFromSchema();
  console.log(`📋 Schema declares ${schemaIndexes.length} @@index directives across all models\n`);
  
  // Group by model
  const byModel = {};
  for (const idx of schemaIndexes) {
    if (!byModel[idx.model]) byModel[idx.model] = [];
    byModel[idx.model].push(idx);
  }
  
  for (const [model, idxs] of Object.entries(byModel)) {
    console.log(`  ${model}: ${idxs.length} index(es)`);
    for (const idx of idxs) {
      console.log(`    - [${idx.fields.join(', ')}] → ${idx.expectedIndexName}`);
    }
  }
  console.log('');
  
  // 2. Extract from migrations
  const migrationIndexes = extractIndexesFromMigrations();
  console.log(`📦 Migrations contain ${migrationIndexes.length} CREATE INDEX statements\n`);
  
  // 3. Cross-reference
  console.log('═'.repeat(80));
  console.log('  Cross-Reference: Schema ↔ Migrations');
  console.log('═'.repeat(80));
  console.log('');
  
  const verified = [];
  const missing = [];
  
  for (const schemaIdx of schemaIndexes) {
    // Check if there's a matching migration index
    const match = migrationIndexes.find(m => {
      if (m.tableName.toLowerCase() !== schemaIdx.model.toLowerCase()) return false;
      // Check if all fields are covered
      const schemaFields = schemaIdx.fields.map(f => f.toLowerCase());
      const migFields = m.columns.map(c => c.toLowerCase());
      // Simple prefix match: all schema fields appear in migration index columns
      return schemaFields.every(sf => migFields.includes(sf));
    });
    
    if (match) {
      verified.push({ schema: schemaIdx, migration: match });
    } else {
      missing.push(schemaIdx);
    }
  }
  
  console.log(`✅ VERIFIED: ${verified.length} indexes confirmed in migrations`);
  for (const v of verified) {
    console.log(`   ✓ ${v.schema.model}.[${v.schema.fields.join(',')}] → ${v.migration.indexName} (${v.migration.migration})`);
  }
  console.log('');
  
  if (missing.length > 0) {
    console.log(`⚠️  MISSING: ${missing.length} indexes NOT found in migration files`);
    for (const m of missing) {
      console.log(`   ✗ ${m.model}.[${m.fields.join(',')}] — declared in schema but no CREATE INDEX in migrations`);
      console.log(`     Declaration: ${m.declaration}`);
    }
  } else {
    console.log('🎉 All declared indexes are present in migration files!');
  }
  
  console.log('');
  console.log('═'.repeat(80));
  console.log('  Summary');
  console.log('═'.repeat(80));
  console.log(`  Total schema indexes:     ${schemaIndexes.length}`);
  console.log(`  Verified in migrations:    ${verified.length}`);
  console.log(`  Missing from migrations:   ${missing.length}`);
  console.log(`  Coverage:                  ${schemaIndexes.length > 0 ? Math.round((verified.length / schemaIndexes.length) * 100) : 0}%`);
  console.log('');
  
  // Exit with error if any indexes are missing
  if (missing.length > 0) {
    process.exit(1);
  }
}

main();
