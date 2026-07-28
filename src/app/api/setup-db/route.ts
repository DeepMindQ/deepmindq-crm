import { NextResponse } from 'next/server';

/**
 * POST /api/setup-db — Run prisma db push to create/align all tables.
 *
 * ⚠️ SECURITY: This endpoint is gated by SETUP_TOKEN environment variable.
 * To use: POST with header X-Setup-Token matching SETUP_TOKEN env var.
 * Designed for Render/remote deployments where you can't run CLI commands.
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
    const result = execSync(`"${prismaBin}" db push --accept-data-loss`, {
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
  return NextResponse.json({
    configured: !!process.env.DATABASE_URL && !!process.env.SETUP_TOKEN,
    hint: process.env.SETUP_TOKEN
      ? 'Setup endpoint is token-protected. POST with X-Setup-Token header.'
      : 'SETUP_TOKEN is NOT set. This endpoint is disabled.',
  });
}
