import { NextResponse } from 'next/server';

/**
 * GET /api/health — Lightweight liveness probe (NO database access).
 *
 * Used by Render (and other orchestrators) for health checks.
 * Returns 200 OK as soon as the Node process is up — does NOT depend
 * on DATABASE_URL being reachable, so it works during initial deploy
 * before the DB is connected.
 *
 * For a deeper health view (DB counts, AI provider status, etc.) see
 * GET /api/system-health.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Indicate which AI providers are configured WITHOUT exposing secret values.
      providers: {
        zai: Boolean(process.env.ZAI_API_KEY || process.env.ZAI_TOKEN),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
      },
      db: Boolean(process.env.DATABASE_URL),
    },
    { status: 200 }
  );
}
