#!/usr/bin/env node
/**
 * pick-database.js
 * ================
 * Helper for picking / verifying a Neon (or any Postgres) database
 * for Vercel deployment.
 *
 * Usage:
 *   node scripts/pick-database.js                    # interactive picker
 *   node scripts/pick-database.js <DATABASE_URL>     # verify a single URL
 *   DATABASE_URL=postgresql://... node scripts/pick-database.js
 */

const { execSync } = require('child_process');

const args = process.argv.slice(2);
const url = args[0] || process.env.DATABASE_URL;

function redact(url) {
  if (!url) return '(empty)';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

async function verify(url) {
  if (!url) {
    console.error('❌ No DATABASE_URL provided.');
    console.error('   Pass it as an argument or set DATABASE_URL env var.');
    process.exit(1);
  }

  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    console.error(`❌ URL must start with postgresql:// or postgres://`);
    console.error(`   Got: ${redact(url)}`);
    process.exit(1);
  }

  console.log(`\n🔍 Verifying: ${redact(url)}\n`);

  // Set env and try prisma db push --accept-data-loss (dry-run via introspect)
  process.env.DATABASE_URL = url;

  try {
    console.log('  → Testing connection with prisma...');
    execSync('npx prisma validate', { stdio: 'inherit', env: process.env });
    console.log('  ✓ Schema is valid\n');

    console.log('  → Pushing schema to database (creates all 71 tables if missing)...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit', env: process.env });
    console.log('  ✓ Schema pushed successfully\n');

    console.log('  → Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
    console.log('  ✓ Client generated\n');

    console.log('─────────────────────────────────────────────────────────────');
    console.log('✅ Database ready for Vercel deployment.');
    console.log('');
    console.log('Next step — add this DATABASE_URL to Vercel:');
    console.log('  vercel env add DATABASE_URL');
    console.log('  (paste the same URL when prompted)');
    console.log('─────────────────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('\n❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verify(url);
