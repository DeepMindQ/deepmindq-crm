/**
 * GET /api/health/deps — Dependency Health Check (unauthenticated)
 *
 * Reports health of all external dependencies:
 *   - Database
 *   - AI providers (key presence, not actual API calls)
 *   - Email provider
 *   - Environment configuration
 */
import { NextResponse } from 'next/server';
import { getEnvHealthReport } from '@/lib/validate-env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envReport = getEnvHealthReport();

  return NextResponse.json(
    {
      status: envReport.status,
      dependencies: {
        database: envReport.database,
        auth: envReport.auth,
        ai: envReport.ai,
        smtp: envReport.smtp,
        tracking: envReport.secrets.trackingSecret,
      },
      warnings: envReport.warnings,
      timestamp: new Date().toISOString(),
    },
    {
      status: envReport.status === 'critical' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
