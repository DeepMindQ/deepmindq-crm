import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { detectCrossAccountPatterns } from '@/lib/intelligence-sources/cross-account-intelligence';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('companyIds');
    if (!idsParam) return NextResponse.json({ error: 'companyIds required (comma-separated)' }, { status: 400 });

    const companyIds = idsParam.split(',').filter(Boolean);
    if (companyIds.length < 2) return NextResponse.json({ error: 'At least 2 companyIds required' }, { status: 400 });

    const companies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, rawName: true, industry: true },
    });

    const allSignals = await db.companySignal.findMany({
      where: { companyId: { in: companyIds }, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });

    const companyMap = new Map(companies.map(c => [c.id, c]));
    const accountSignals = allSignals.map(s => ({
      companyId: s.companyId,
      companyName: companyMap.get(s.companyId)?.rawName || 'Unknown',
      industry: companyMap.get(s.companyId)?.industry || null,
      signalType: s.signalType,
      title: s.title,
      createdAt: s.createdAt,
      confidence: s.confidence,
    }));

    const patterns = detectCrossAccountPatterns(accountSignals);
    return NextResponse.json({ companyCount: companies.length, signalCount: allSignals.length, patterns });
  } catch (error) {
    console.error('[cross-account] Error:', error);
    return NextResponse.json({ error: 'Cross-account analysis failed' }, { status: 500 });
  }
}
