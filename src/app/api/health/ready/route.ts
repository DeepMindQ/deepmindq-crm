/**
 * GET /api/health/ready — Readiness Probe (unauthenticated)
 *
 * Returns whether the application is ready to serve traffic.
 * Used by container orchestrators (Kubernetes, Docker, Render).
 */
import { NextResponse } from 'next/server';
import { getReadinessCheck } from '@/lib/enterprise-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const readiness = await getReadinessCheck();
    return NextResponse.json(readiness, {
      status: readiness.ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      { ready: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
