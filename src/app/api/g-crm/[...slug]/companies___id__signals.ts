import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET — List signals for a company
   ═══════════════════════════════════════════════════ */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const where: Record<string, any> = { companyId };
    if (type) {
      where.signalType = type;
    }

    const signals = await db.companySignal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('Company signals list error:', error);
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a signal for a company
   ═══════════════════════════════════════════════════ */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const body = await request.json();
    const { signalType, title, description, source, sourceUrl, severity } = body;

    if (!signalType || typeof signalType !== 'string' || signalType.trim().length === 0) {
      return NextResponse.json({ error: 'signalType is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const validTypes = ['funding', 'hiring', 'leadership_change', 'technology', 'news', 'mention', 'partnership', 'expansion', 'product', 'acquisition', 'regulatory', 'financial_pressure'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    const signal = await db.companySignal.create({
      data: {
        companyId,
        signalType: validTypes.includes(signalType) ? signalType : signalType.trim(),
        title: title.trim(),
        description: description?.trim() || null,
        source: source?.trim() || null,
        sourceUrl: sourceUrl?.trim() || null,
        severity: validSeverities.includes(severity) ? severity : 'medium',
        isRead: false,
      },
    });

    return NextResponse.json({ signal }, { status: 201 });
  } catch (error) {
    console.error('Company signal create error:', error);
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
  }
}