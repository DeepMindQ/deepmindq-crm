/**
 * Mark Baseline Migration as Applied
 *
 * For existing databases that were set up via `prisma db push` (not migrations),
 * this script marks the baseline migration as already applied in _prisma_migrations.
 *
 * Usage:
 *   npx tsx scripts/mark-baseline-migration.ts
 *
 * Prerequisites:
 *   - DATABASE_URL must point to an existing database with the full schema
 *   - The database must already have all tables (from prisma db push)
 *
 * After running this script, `prisma migrate status` will show the baseline
 * as applied, and future `prisma migrate deploy` calls will only run
 * new migrations added after the baseline.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIGRATION_NAME = '20260701000000_init_baseline';

async function main() {
  console.log(`[Migration Marker] Checking if baseline migration is already marked...`);

  try {
    // Check if _prisma_migrations table exists
    const tableCheck = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
      ) as "exists"
    `).catch(() => [{ exists: false }]);

    const tableExists = (tableCheck as Array<{ exists: boolean }>)[0]?.exists;

    if (!tableExists) {
      console.log('[Migration Marker] _prisma_migrations table does not exist. Creating it...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "_prisma_migrations" (
          "id" SERIAL NOT NULL PRIMARY KEY,
          "checksum" VARCHAR(64) NOT NULL,
          "finished_at" TIMESTAMPTZ NOT NULL,
          "migration_name" VARCHAR(255) NOT NULL,
          "logs" TEXT,
          "rolled_back_at" TIMESTAMPTZ,
          "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "applied_steps_count" INTEGER NOT NULL DEFAULT 0
        )
      `);
      console.log('[Migration Marker] _prisma_migrations table created.');
    }

    // Check if migration is already marked
    const existing = await prisma.$queryRawUnsafe(`
      SELECT "migration_name" FROM "_prisma_migrations" WHERE "migration_name" = $1
    `, MIGRATION_NAME).catch(() => []);

    if ((existing as Array<{ migration_name: string }>).length > 0) {
      console.log(`[Migration Marker] Baseline migration "${MIGRATION_NAME}" is already marked. No action needed.`);
      return;
    }

    // Read the migration SQL file to compute checksum
    const fs = await import('fs');
    const path = await import('path');
    const crypto = await import('crypto');

    const migrationPath = path.join(
      process.cwd(),
      'prisma',
      'migrations',
      MIGRATION_NAME,
      'migration.sql'
    );

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');

    // Insert migration record
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
      VALUES (
        DEFAULT,
        $1,
        NOW(),
        $2,
        NOW(),
        1
      )
    `, checksum, MIGRATION_NAME);

    console.log(`[Migration Marker] ✅ Baseline migration "${MIGRATION_NAME}" marked as applied.`);
    console.log(`[Migration Marker] Checksum: ${checksum}`);
    console.log(`[Migration Marker] Future \`prisma migrate deploy\` calls will only run new migrations.`);
  } catch (error) {
    console.error('[Migration Marker] ❌ Failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
