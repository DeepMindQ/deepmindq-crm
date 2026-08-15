import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const ingestions = await db.dataIngestion.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 50,
    });

    const statusMap: Record<string, 'queued' | 'sending' | 'sent' | 'failed'> = {
      pending: 'queued',
      processing: 'sending',
      completed: 'sent',
      failed: 'failed',
      partial: 'sent',
    };

    const data = ingestions.map((ing, i) => ({
      id: ing.id,
      to: `import-${i + 1}@internal.batch`,
      subject: `Data Import: ${ing.fileName}`,
      company: 'Internal',
      sequence: 'Data Import',
      scheduledFor: ing.uploadedAt.toISOString().slice(0, 16).replace('T', ' '),
      status: statusMap[ing.status] ?? 'queued',
      priority: (i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low') as
        'high' | 'medium' | 'low',
    }));

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list queue', details: message }, { status: 500 });
  }
}
