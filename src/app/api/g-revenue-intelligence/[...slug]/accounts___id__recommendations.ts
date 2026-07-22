import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { generateRecommendations } from '@/lib/revenue-intelligence/recommendation-generator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const recommendations = await generateRecommendations(id);
    return apiSuccess(recommendations);
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('not found')) return apiError(msg, 404);
    return apiError(`Recommendation generation failed: ${msg}`, 500);
  }
}
