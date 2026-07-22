import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { getBrief } from '@/lib/revenue-intelligence/brief-generator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) return apiError('No brief found. Generate one first.', 404);

  return apiSuccess({
    ...brief,
    keySignals: safeJsonParse(brief.keySignals),
    themes: safeJsonParse(brief.themes),
    risks: safeJsonParse(brief.risks),
    recommendations: safeJsonParse(brief.recommendations),
  });
}

function safeJsonParse(str: string): any {
  try { return JSON.parse(str); } catch { return str; }
}
