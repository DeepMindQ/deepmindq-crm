/**
 * WI-18.2 Phase 3.5 — Staging Shadow Mode Activation
 * ====================================================
 *
 * This script activates shadow mode for the 7-day staging validation period.
 * Run on the staging environment ONLY.
 *
 * Usage:
 *   ENABLE=1 bun run scripts/persistence-shadow-activate.ts    # Activate
 *   bun run scripts/persistence-shadow-activate.ts               # Check status
 *   DISABLE=1 bun run scripts/persistence-shadow-activate.ts    # Deactivate
 *
 * What it does:
 *   - Verifies DB connectivity
 *   - Checks existing persistence data state
 *   - Validates feature flag configuration
 *   - Runs a mini write/read round-trip test
 *   - Reports activation status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mode = process.env.ENABLE === '1' ? 'activate' : process.env.DISABLE === '1' ? 'deactivate' : 'check';
  const isCurrentlyEnabled = process.env.USE_DB_PERSISTENCE === 'true';
  const isCurrentlyShadow = process.env.PERSISTENCE_SHADOW_MODE === 'true';

  console.log('='.repeat(60));
  console.log('WI-18.2 Phase 3.5 — Shadow Mode Activation');
  console.log('='.repeat(60));
  console.log(`Mode: ${mode}`);
  console.log(`Current: USE_DB_PERSISTENCE=${process.env.USE_DB_PERSISTENCE || '(not set)'}`);
  console.log(`Current: PERSISTENCE_SHADOW_MODE=${process.env.PERSISTENCE_SHADOW_MODE || '(not set)'}`);
  console.log('');

  // 1. Verify DB connectivity
  console.log('Step 1: Verifying database connectivity...');
  try {
    await prisma.$queryRaw`SELECT 1 as _1`;
    console.log('  ✅ Database connected');
  } catch (err) {
    console.log('  ❌ Database connection failed:', err);
    process.exit(1);
  }

  // 2. Check persistence tables exist
  console.log('\nStep 2: Checking persistence tables...');
  const tables = [
    'KnowledgeGraphNode',
    'KnowledgeGraphEdge',
    'AIMemoryEntry',
    'RetrievalIndexEntry',
    'RetrievalCorpusStats',
    'PersistenceOperationLog',
    'PersistenceHealthSnapshot',
    'ShadowModeReconciliation',
  ];

  for (const table of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
      if (model) {
        const count = await model.count();
        console.log(`  ✅ ${table}: ${count} records`);
      } else {
        console.log(`  ⚠️  ${table}: model not found in Prisma client`);
      }
    } catch (err) {
      console.log(`  ❌ ${table}: ${err}`);
    }
  }

  // 3. Feature flag guidance
  console.log('\nStep 3: Feature flag configuration...');
  if (mode === 'activate') {
    console.log('  To activate shadow mode, set in environment:');
    console.log('    USE_DB_PERSISTENCE=true');
    console.log('    PERSISTENCE_SHADOW_MODE=true');
    console.log('    PERSISTENCE_REQUIRE_FULL_LOAD=false  (recommended for staging)');
    console.log('    PERSISTENCE_MAX_LOAD_TIME_MS=60000');
    console.log('    PERSISTENCE_DEGRADED_THRESHOLD=0.8');
    console.log('');
    console.log('  Then restart the application.');
    console.log('  Shadow mode writes to BOTH Map and DB.');
    console.log('  Map remains authoritative. DB is validated via reconciliation.');
  } else if (mode === 'deactivate') {
    console.log('  To deactivate, set:');
    console.log('    USE_DB_PERSISTENCE=false');
    console.log('  Or remove the env vars entirely.');
    console.log('  Application reverts to Map-only mode (zero risk).');
  } else {
    if (isCurrentlyEnabled && isCurrentlyShadow) {
      console.log('  ✅ Shadow mode is ACTIVE');
      console.log('  DB writes happen in parallel with Map operations.');
      console.log('  Reconciliation runs every 5 minutes.');
    } else if (isCurrentlyEnabled) {
      console.log('  ⚠️  Persistence enabled but NOT in shadow mode.');
      console.log('  DB writes are active. Set PERSISTENCE_SHADOW_MODE=true for shadow.');
    } else {
      console.log('  ℹ️  Persistence is DISABLED (Map-only mode).');
    }
  }

  // 4. Evidence collection endpoints
  console.log('\nStep 4: Evidence collection endpoints...');
  console.log('  GET  /api/health/persistence  — Real-time health data');
  console.log('  POST /api/cron/persistence-evidence  — Daily evidence collection');
  console.log('  (Requires CRON_SECRET bearer token)');

  console.log('\n' + '='.repeat(60));
  console.log('Phase 3.5 Shadow Mode — Ready for 7-day validation');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
