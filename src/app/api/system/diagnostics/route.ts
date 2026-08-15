import { z } from 'zod';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/api-error-handler';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

const diagnosticsBodySchema = z.object({
  deepScan: z.boolean().optional().default(false),
});

async function _postHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = diagnosticsBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid parameters', 400);
  }

  const checks: { name: string; status: 'pass' | 'warn' | 'fail'; value: string | number }[] = [];
  let allPassed = true;

  // 1. Database connectivity check
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.$queryRaw<any[]>`SELECT 1 as ok`;
    checks.push({
      name: 'database',
      status: result?.[0]?.ok === 1 ? 'pass' : 'fail',
      value: 'connected',
    });
    if (result?.[0]?.ok !== 1) allPassed = false;
  } catch {
    checks.push({ name: 'database', status: 'fail', value: 'disconnected' });
    allPassed = false;
  }

  // 2. Count records in key tables
  const [orgCount, signalCount, personCount, insightCount, briefingCount, evidenceCount] =
    await Promise.all([
      db.organization.count(),
      db.signal.count(),
      db.person.count(),
      db.insight.count(),
      db.briefing.count(),
      db.evidence.count(),
    ]);

  checks.push({ name: 'organizations', status: 'pass', value: orgCount });
  checks.push({ name: 'signals', status: 'pass', value: signalCount });
  checks.push({ name: 'people', status: 'pass', value: personCount });
  checks.push({ name: 'insights', status: 'pass', value: insightCount });
  checks.push({ name: 'briefings', status: 'pass', value: briefingCount });
  checks.push({ name: 'evidence', status: 'pass', value: evidenceCount });

  // 3. AI usage stats
  const [latestAiLog, aiErrorCount] = await Promise.all([
    db.aIUsageLog.findFirst({ orderBy: { createdAt: 'desc' } }),
    db.aIUsageLog.count({ where: { error: { not: null } } }),
  ]);

  checks.push({
    name: 'ai_latest_entry',
    status: latestAiLog ? 'pass' : 'fail',
    value: latestAiLog?.createdAt?.toISOString() || 'none',
  });
  if (!latestAiLog) allPassed = false;

  checks.push({
    name: 'ai_error_count',
    status: aiErrorCount === 0 ? 'pass' : 'warn',
    value: aiErrorCount,
  });

  return apiSuccess({
    status: allPassed ? 'healthy' : 'degraded',
    checks,
  });
}

export const POST = withErrorHandler(_postHandler);
