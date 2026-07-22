import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { generateAndPersistBrief } from '@/lib/revenue-intelligence/brief-generator';
import { persistDetectedSignals, detectSignalsForCompany } from '@/lib/revenue-intelligence/signal-detector';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { runSignalDetection?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  try {
    if (body.runSignalDetection) {
      const detected = await detectSignalsForCompany(id);
      await persistDetectedSignals(id, detected);
    }

    const result = await generateAndPersistBrief(id);
    return apiSuccess({ briefId: result.id, summary: result.summary, confidence: result.confidence });
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('not found')) return apiError(msg, 404);
    return apiError(`Brief generation failed: ${msg}`, 500);
  }
}
