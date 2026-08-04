/**
 * GET /api/health/database — Database Health (unauthenticated)
 *
 * Production database health check endpoint.
 * Probes connectivity, latency, query performance, migration status.
 */
import { NextResponse } from 'next/server';
import { getDatabaseHealthSummary } from '@/lib/database-enterprise-monitor';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await getDatabaseHealthSummary();
    return NextResponse.json(health, {
      status: health.status === 'unhealthy' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Database health check failed', details: String(error) },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
