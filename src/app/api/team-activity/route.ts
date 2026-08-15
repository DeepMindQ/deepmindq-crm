import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = schema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { limit } = parsed.data;

    // Fetch recent activities from multiple sources
    const [ingestions, signals, briefings] = await Promise.all([
      db.dataIngestion.findMany({
        orderBy: { uploadedAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: { id: true, fileName: true, status: true, uploadedAt: true, fileType: true },
      }),
      db.signal.findMany({
        orderBy: { detectedAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          signalType: true,
          severity: true,
          title: true,
          detectedAt: true,
          organization: { select: { name: true } },
        },
      }),
      db.briefing.findMany({
        orderBy: { generatedAt: 'desc' },
        take: Math.ceil(limit / 3),
        select: {
          id: true,
          executiveSummary: true,
          generatedAt: true,
          organization: { select: { name: true } },
        },
      }),
    ]);

    const activities = [
      ...ingestions.map((i) => ({
        id: `ingestion-${i.id}`,
        type: 'ingestion_upload' as const,
        title: `Import: ${i.fileName}`,
        description: `${i.fileType.toUpperCase()} file — ${i.status}`,
        timestamp: i.uploadedAt,
        entityType: 'ingestion',
        entityId: i.id,
      })),
      ...signals.map((s) => ({
        id: `signal-${s.id}`,
        type: 'signal_detected' as const,
        title: s.title,
        description: `${s.severity} ${s.signalType} signal — ${s.organization?.name || 'Unknown'}`,
        timestamp: s.detectedAt,
        entityType: 'signal',
        entityId: s.id,
      })),
      ...briefings.map((b) => ({
        id: `briefing-${b.id}`,
        type: 'briefing_generated' as const,
        title: `Briefing — ${b.organization?.name || 'Organization'}`,
        description: b.executiveSummary.slice(0, 120),
        timestamp: b.generatedAt,
        entityType: 'briefing',
        entityId: b.id,
      })),
    ];

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ data: activities.slice(0, limit) });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch team activity' }, { status: 500 });
  }
}
