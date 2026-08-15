import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { parseStringArray } from '@/lib/json-fields';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

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
  } catch (error) {
    console.error('[system/export] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
