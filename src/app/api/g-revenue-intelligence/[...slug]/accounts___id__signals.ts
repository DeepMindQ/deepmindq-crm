import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess } from '@/lib/apiHelpers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');

  const where: any = { companyId: id };
  if (status) where.status = status;
  if (type) where.signalType = type;

  const signals = await db.opportunitySignal.findMany({ where, orderBy: { score: 'desc' } });

  return apiSuccess(signals.map(s => ({ ...s, supportingIntelligenceIds: safeJsonParse(s.supportingIntelligenceIds) })));
}

function safeJsonParse(str: string): any {
  try { return JSON.parse(str); } catch { return str; }
}
