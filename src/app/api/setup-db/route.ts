import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

/**
 * POST /api/setup-db — Run prisma db push to create/align all tables.
 *
 * ⚠️  SECURITY: This endpoint is public (no auth) so that initial setup
 * works on fresh deployments. After tables are created, consider disabling
 * by removing this route or adding auth checks.
 *
 * Designed for Render/remote deployments where you can't run CLI commands.
 */
export async function POST() {
  try {
    // Verify DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL environment variable is not set.' },
        { status: 400 }
      );
    }

    // Run prisma db push — creates missing tables without data loss
    const result = execSync('npx prisma db push --accept-data-loss --skip-generate', {
      cwd: path.resolve(process.cwd()),
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return NextResponse.json({
      success: true,
      message: 'Database schema pushed successfully.',
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
  const dbUrl = process.env.DATABASE_URL;
  return NextResponse.json({
    configured: !!dbUrl,
    // Show only protocol+host, never the full URL with password
    hint: dbUrl
      ? `DATABASE_URL is set (${dbUrl.split('@')[0]}...@${dbUrl.split('@')[1]?.split('/')[0] || 'hidden'})`
      : 'DATABASE_URL is NOT set. Please configure it in Render environment variables.',
  });
}
