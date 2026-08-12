/**
 * GET /api/health/livez — Kubernetes-style liveness probe.
 *
 * Extremely lightweight — returns 200 if the Node.js process is alive.
 * No database, Redis, or external dependency checks.
 * Used by orchestrators to determine if the container should be restarted.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'alive' }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
