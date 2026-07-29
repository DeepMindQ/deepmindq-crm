import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectCorrelations } from '@/lib/intelligence-sources/cross-signal-correlation';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 50,
    });

    const correlations = detectCorrelations(signals);
    return NextResponse.json({ companyId, correlations, signalCount: signals.length });
  } catch (error) {
    logger.error('[correlations] Error:', { error: error });
    return NextResponse.json({ error: 'Correlation analysis failed' }, { status: 500 });
  }
}
