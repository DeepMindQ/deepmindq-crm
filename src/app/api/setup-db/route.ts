import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/setup-db — Run prisma migrate deploy to apply migrations.
 *
 * ⚠️ SECURITY: This endpoint is DOUBLE-GATED:
 *   1. SETUP_TOKEN env var must be configured
 *   2. X-Setup-Token request header must match SETUP_TOKEN
 *   If either is missing/mismatched → 403
 *
 * GET /api/setup-db — Always returns 404.
 *   Setup status is NOT publicly queryable.
 */
export async function POST(request: NextRequest) {
  const setupToken = process.env.SETUP_TOKEN;

  // Gate 1: env var must exist
  if (!setupToken) {
    return NextResponse.json(
      { success: false, error: 'Endpoint disabled.' },
      { status: 403 }
    );
  }

  // Gate 2: request must carry matching token
  const requestToken = request.headers.get('X-Setup-Token');
  if (!requestToken || requestToken !== setupToken) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing token.' },
      { status: 403 }
    );
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL not set.' },
        { status: 400 }
      );
    }

    const { execSync } = await import('child_process');
    const path = await import('path');
    const fs = await import('fs');

    const prismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
    const cwd = path.resolve(process.cwd());
    const migrationsDir = path.join(cwd, 'prisma', 'migrations');
    const hasMigrations = fs.existsSync(migrationsDir) &&
      fs.readdirSync(migrationsDir).some((f: string) => f.endsWith('.sql'));

    const command = hasMigrations
      ? `"${prismaBin}" migrate deploy`
      : `"${prismaBin}" db push`;

    const result = execSync(command, {
      cwd,
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return NextResponse.json({
      success: true,
      message: hasMigrations ? 'Migrations applied.' : 'Schema created.',
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

// GET returns 404 — no information leakage
export async function GET() {
  return NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
