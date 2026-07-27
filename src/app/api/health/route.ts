import { NextResponse } from 'next/server';

/**
 * GET /api/health — Lightweight liveness probe (NO database access, NO auth).
 *
 * Used by Vercel/Render health checks. Returns 200 OK as soon as the
 * Node process is up — does NOT depend on DATABASE_URL being reachable,
 * so it works during initial deploy before the DB is connected.
 *
 * For a deeper health view (DB counts, AI provider status, etc.) see
 * GET /api/system-health (requires auth).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Indicate which AI providers are configured WITHOUT exposing secret values.
      // Priority order: nvidia → fireworks → groq → gemini (see ai-config.ts)
      providers: {
        nvidia: Boolean(process.env.NVIDIA_API_KEY),
        fireworks: Boolean(process.env.FIREWORKS_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        tavily: Boolean(process.env.TAVILY_API_KEY),
      },
      db: Boolean(process.env.DATABASE_URL),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

