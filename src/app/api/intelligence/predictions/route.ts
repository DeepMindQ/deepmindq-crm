import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePredictions } from '@/lib/intelligence-sources/predictive-intelligence';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const signals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });

    const predictions = generatePredictions(signals);
    return NextResponse.json({ companyId, predictions, signalsAnalyzed: signals.length });
  } catch (error) {
    console.error('[predictions] Error:', error);
    return NextResponse.json({ error: 'Prediction analysis failed' }, { status: 500 });
  }
}
