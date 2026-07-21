import { NextRequest, NextResponse } from 'next/server';
import { buildTrustReport } from '@/lib/trust-report-builder';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const report = await buildTrustReport(id);

    if (!report) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}