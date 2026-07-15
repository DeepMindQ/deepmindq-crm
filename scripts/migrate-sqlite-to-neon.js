/**
 * migrate-sqlite-to-neon.js  (v7 — single Client, no pool)
 * Uses dedicated pg.Client (not Pool) to avoid Neon connection splitting.
 * Generates SQL file then executes in single session.
 * Usage: DATABASE_URL="postgres://..." node scripts/migrate-sqlite-to-neon.js
 */
const Database = require("better-sqlite3");
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const SQLITE_PATH = "db/custom.db";
const PG_URL = process.env.DATABASE_URL;
const SQL_FILE = "/tmp/neon-migration.sql";

const TABLES = [
  "ImportBatch", "Company", "CompanyResearchCard", "CompanyNote",
  "CompanySignal", "CompanyTimelineEvent", "Contact", "ContactNote",
  "Segment", "SegmentContact", "CapabilityAsset", "EmailTemplate",
  "EmailSequence", "SequenceStep", "SequenceEnrollment", "Draft",
  "SendQueue", "EmailEvent", "ABTest", "Reply", "Bounce",
  "Suppression", "AuditLog",
];

const DATE_COLS = new Set([
  "lastCheckedAt", "lastContactedAt", "consentDate",
  "createdAt", "updatedAt",
  "lastEnrichedAt", "lastActivityAt", "lastResearchedAt", "enrichmentDate",
  "receivedAt", "bouncedAt",
  "startedAt", "nextStepAt", "completedAt",
  "scheduledAt", "sentAt", "removedAt",
]);

const BOOL_COLS = new Set([
  "isSuppressed", "isActive", "pinned", "isRead",
  "replied", "bounced", "isStatic",
]);

function fixDate(v) {
  if (!v || typeof v !== "string") return v;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(\.\d+)?/);
  if (m) return `${m[1]}T${m[2]}${m[3] || ".000"}Z`;
  if (v.includes("T")) return v;
  return v;
}

function esc(val, col) {
  if (val === null || val === undefined) return "NULL";
  if (BOOL_COLS.has(col) && (val === 0 || val === 1)) return val === 1 ? "TRUE" : "FALSE";
  if (DATE_COLS.has(col)) {
    const s = String(val);
    // Skip SQLite function expressions stored as literal strings
    if (s.includes("datetime(") || s.includes("date(") || s.includes("time(") || s === "now") return "NULL";
    const d = fixDate(s);
    return d ? `'${d}'` : "NULL";
  }
  if (typeof val === "number") return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSql(sqlite) {
  const lines = [];
  lines.push("BEGIN;");

  // Drop all tables
  lines.push(`DROP SCHEMA public CASCADE;`);
  lines.push(`CREATE SCHEMA public;`);

  // Create all tables from Prisma's generated SQL
  // Read the Prisma migration SQL or generate it
  const schemaSql = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
  lines.push("-- Tables will be created by Prisma db push after this script");
  lines.push("COMMIT;");
  return lines.join("\n");
}

async function main() {
  console.log("SQLite → Neon Migration (v7 - SQL file + single Client)\n");
  if (!PG_URL) { console.error("Set DATABASE_URL"); process.exit(1); }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Step 1: Drop all tables using single Client
  console.log("Step 1: Clearing Neon database...");
  const clearClient = new Client({
    connectionString: PG_URL,
    ssl: { rejectUnauthorized: false },
  });
  await clearClient.connect();
  await clearClient.query("DROP SCHEMA public CASCADE");
  await clearClient.query("CREATE SCHEMA public");
  await clearClient.end();
  console.log("  Schema cleared.\n");

  // Step 2: Push Prisma schema
  console.log("Step 2: Pushing Prisma schema...");
  const { execSync } = require("child_process");
  execSync(`DATABASE_URL="${PG_URL}" npx prisma db push --skip-generate 2>&1`, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    timeout: 120000,
  });
  console.log("  Schema pushed.\n");

  // Step 3: Migrate data using single Client (same connection for all queries)
  console.log("Step 3: Migrating data...");
  const dataClient = new Client({
    connectionString: PG_URL,
    ssl: { rejectUnauthorized: false },
  });
  await dataClient.connect();

  const t0 = Date.now();
  let total = 0;

  for (const table of TABLES) {
    const start = Date.now();
    const { count: rowCount } = sqlite.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
    if (rowCount === 0) { console.log(`  ${table}: 0 — skip`); continue; }

    const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    const colList = cols.map(c => `"${c}"`).join(", ");
    const BATCH = 500;

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const valRows = batch.map(row =>
        "(" + cols.map(c => esc(row[c], c)).join(",") + ")"
      );
      const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valRows.join(",")}`;
      await dataClient.query(sql);
      inserted += batch.length;
      process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
    }
    total += inserted;
    console.log(`  ✓ ${inserted} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }

  // Verify
  console.log("\n── Verify ──");
  let allOk = true;
  for (const table of TABLES) {
    const pgR = await dataClient.query(`SELECT COUNT(*) as c FROM "${table}"`);
    const slR = sqlite.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get();
    if (Number(pgR.rows[0].c) !== Number(slR.c)) {
      console.log(`  ✗ ${table}: SL=${slR.c} PG=${pgR.rows[0].c}`);
      allOk = false;
    }
  }
  if (allOk) console.log("  ✓ All counts match!\n");

  console.log(`═══ ${total} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s ═══`);

  await dataClient.end();
  sqlite.close();
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });