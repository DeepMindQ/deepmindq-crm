import { NextResponse } from 'next/server';
import { recordSignalFeedback, computeLearningInsights } from '@/lib/intelligence-sources/learning-loop';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signalId, companyId, type, userId, comment } = body;
    if (!signalId || !companyId || !type) {
      return NextResponse.json({ error: 'signalId, companyId, and type are required' }, { status: 400 });
    }
    await recordSignalFeedback({ signalId, companyId, type, userId, comment });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json({ error: 'Feedback recording failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const insights = await computeLearningInsights(companyId || undefined);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[feedback] Error:', error);
    return NextResponse.json({ error: 'Learning insights failed' }, { status: 500 });
  }
}
