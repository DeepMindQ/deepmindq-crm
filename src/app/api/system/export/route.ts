import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { withErrorHandler } from '@/lib/api-error-handler';
import { parseStringArray } from '@/lib/json-fields';
import { apiError } from '@/lib/apiHelpers';

const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
  tables: z.string().optional(),
});

async function _getHandler(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const parsed = exportQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return apiError('Invalid parameters', 400);
  }
  const { format: _format } = parsed.data;

  // Get counts from all tables
  const [
    orgCount,
    signalCount,
    personCount,
    insightCount,
    briefingCount,
    evidenceCount,
    relationshipCount,
    aiLogCount,
    auditCount,
  ] = await Promise.all([
    db.organization.count(),
    db.signal.count(),
    db.person.count(),
    db.insight.count(),
    db.briefing.count(),
    db.evidence.count(),
    db.relationship.count(),
    db.aIUsageLog.count(),
    db.auditLog.count(),
  ]);

  // Top 10 organizations by intelligenceScore
  const topOrganizations = await db.organization.findMany({
    orderBy: { intelligenceScore: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      domain: true,
      industry: true,
      intelligenceScore: true,
      trackingStatus: true,
      employeeCount: true,
      aliases: true,
    },
  });

  // Parse JSON fields for top organizations
  const parsedOrgs = topOrganizations.map((org) => ({
    ...org,
    aliases: parseStringArray(org.aliases),
  }));

  // Latest 10 signals
  const recentSignals = await db.signal.findMany({
    orderBy: { detectedAt: 'desc' },
    take: 10,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    summary: {
      counts: {
        organizations: orgCount,
        signals: signalCount,
        people: personCount,
        insights: insightCount,
        briefings: briefingCount,
        evidence: evidenceCount,
        relationships: relationshipCount,
        aiUsageLogs: aiLogCount,
        auditLogs: auditCount,
      },
    },
    topOrganizations: parsedOrgs,
    recentSignals,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="deepmindq-export.json"',
    },
  });
}

export const GET = withErrorHandler(_getHandler);
