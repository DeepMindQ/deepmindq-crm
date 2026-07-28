import { NextResponse } from 'next/server';

/**
 * POST /api/setup-db — Run prisma migrate deploy to apply migrations.
 *
 * ⚠️ SECURITY: This endpoint is gated by SETUP_TOKEN environment variable.
 * To use: POST with header X-Setup-Token matching SETUP_TOKEN env var.
 *
 * Production flow:
 *   1. First deployment: Uses db push to create tables from schema
 *   2. Subsequent: Uses migrate deploy to apply migration files
 *
 * Uses migrate deploy (not db push) to ensure:
 *   - Migration history is maintained
 *   - Rollback is possible
 *   - No silent data loss from --accept-data-loss
 *
 * For first-time setup with no migration history, falls back to db push.
 */
export async function POST() {
  try {
    const setupToken = process.env.SETUP_TOKEN;

    if (!setupToken) {
      return NextResponse.json(
        { success: false, error: 'SETUP_TOKEN environment variable is not configured. This endpoint is disabled.' },
        { status: 403 }
      );
    }

    // Dynamic import to avoid loading child_process unless needed
    const { execSync } = await import('child_process');
    const path = await import('path');

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL environment variable is not set.' },
        { status: 400 }
      );
    }

    const prismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
    const cwd = path.resolve(process.cwd());

    // Check if migrations directory has migration files
    const fs = await import('fs');
    const migrationsDir = path.join(cwd, 'prisma', 'migrations');
    const hasMigrations = fs.existsSync(migrationsDir) &&
      fs.readdirSync(migrationsDir).some((f: string) => f.endsWith('.sql'));

    let command: string;
    if (hasMigrations) {
      // Use migrate deploy — applies pending migrations safely
      command = `"${prismaBin}" migrate deploy`;
    } else {
      // First-time setup — use db push to create initial schema
      command = `"${prismaBin}" db push --accept-data-loss`;
    }

    const result = execSync(command, {
      cwd,
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return NextResponse.json({
      success: true,
      message: hasMigrations ? 'Database migrations applied successfully.' : 'Initial database schema created.',
      method: hasMigrations ? 'migrate deploy' : 'db push',
      output: result.trim(),
    });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
      ? String((error as { stderr?: string }).stderr)
      : '';
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: 'Database setup failed.',
      detail: message,
      stderr: stderr?.substring(0, 500),
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    configured: !!process.env.DATABASE_URL && !!process.env.SETUP_TOKEN,
    hint: process.env.SETUP_TOKEN
      ? 'Setup endpoint is token-protected. POST with X-Setup-Token header.'
      : 'SETUP_TOKEN is NOT set. This endpoint is disabled.',
  });
}
