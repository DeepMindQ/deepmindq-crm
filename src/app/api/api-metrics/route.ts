import { NextResponse } from 'next/server';
import { getApiMetrics } from '@/lib/api-observability';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * WI-18.3 API Observability Endpoint
 *
 * Returns current API metrics: latency percentiles, error rates, top endpoints.
 * Requires authentication.
 */
export async function GET() {
  const auth = await checkApiAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  const metrics = getApiMetrics();
  return NextResponse.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}
