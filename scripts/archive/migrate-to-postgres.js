/**
 * migrate-to-postgres.js
 * 
 * Migrates ALL data from local SQLite (db/custom.db) to a PostgreSQL database.
 * 
 * USAGE:
 *   DB_PROVIDER=postgresql DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/migrate-to-postgres.js
 *   DB_PROVIDER=postgresql DATABASE_URL="$NEON_CONNECTION_STRING" node scripts/migrate-to-postgres.js
 * 
 * For Neon free tier:
 *   1. Go to https://console.neon.tech → Create Project
 *   2. Copy the connection string (looks like: postgresql://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require)
 *   3. Run: DB_PROVIDER=postgresql DATABASE_URL="<that string>" npx prisma db push
 *   4. Run: DB_PROVIDER=postgresql DATABASE_URL="<that string>" node scripts/migrate-to-postgres.js
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');

const SQLITE_PATH = process.env.SQLITE_PATH || require('path').join(__dirname, '..', 'db', 'custom.db');
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error('ERROR: Set DATABASE_URL environment variable');
  console.error('Example: DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/migrate-to-postgres.js');
  process.exit(1);
}

async function migrate() {
  const t0 = Date.now();
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Client({ connectionString: PG_URL, ssl: PG_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  
  await pg.connect();
  console.log('✓ Connected to PostgreSQL');
  
  // Disable foreign key checks during migration
  await pg.query('SET session_replication_role = replica');
  
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
  console.log(`✓ Found ${tables.length} tables in SQLite`);
  
  for (const table of tables) {
    const count = sqlite.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
    if (count === 0) {
      console.log(`  ⏭ ${table}: 0 rows, skipping`);
      continue;
    }
    
    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
    const colList = cols.join(', ');
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    
    // Check if table exists in PG
    const tableExists = await pg.query(`SELECT to_regclass('"${table}"') as exists`).then(r => r.rows[0].exists);
    if (!tableExists) {
      console.log(`  ⚠ ${table}: doesn't exist in PostgreSQL, skipping (run prisma db push first)`);
      continue;
    }
    
    // Truncate in correct order (respect FK constraints - we disabled checks so order doesn't matter)
    await pg.query(`TRUNCATE TABLE "${table}" CASCADE`);
    
    // Batch insert
    const rows = sqlite.prepare(`SELECT ${colList} FROM "${table}"`).all();
    const BATCH = 500;
    let inserted = 0;
    
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = batch.map(row => cols.map(c => row[c]));
      const flatValues = values.flat();
      
      try {
        await pg.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
          flatValues
        );
        inserted += batch.length;
      } catch (err) {
        // Try with ON CONFLICT DO NOTHING for duplicate key issues
        if (err.code === '23505') {
          try {
            const updateSet = cols.filter(c => c !== 'id').map(c => `EXCLUDED."${c}"`).join(', ');
            const upsertSql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`;
            
            for (const row of batch) {
              const rowValues = cols.map(c => row[c]);
              try {
                await pg.query(upsertSql, rowValues);
                inserted++;
              } catch (e2) {
                // Skip individual row errors
              }
            }
          } catch (e3) {
            console.log(`  ⚠ ${table}: batch at ${i} failed: ${err.message.slice(0, 80)}`);
          }
        } else {
          console.log(`  ⚠ ${table}: batch at ${i} failed: ${err.code} - ${err.message.slice(0, 80)}`);
        }
      }
    }
    
    console.log(`  ✓ ${table}: ${inserted}/${count} rows migrated`);
  }
  
  // Re-enable FK checks
  await pg.query('SET session_replication_role = DEFAULT');
  
  // Update sequences for auto-increment IDs (not needed for cuid() but good practice)
  await pg.query(`
    SELECT setval(pg_get_serial_sequence('"ImportBatch"', 'id'), COALESCE((SELECT MAX(CAST(id AS INTEGER)) FROM "ImportBatch"), 0) + 1, false)
  `).catch(() => {}); // Ignore if no serial sequence
  
  await pg.end();
  sqlite.close();
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Migration completed in ${elapsed}s`);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});