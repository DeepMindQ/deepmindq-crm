import { NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { IntelligencePipeline } from '@/lib/intelligence-pipeline';
import { db } from '@/lib/db';

// ────────────────────────────────────────────────────────────────────────
// GET /api/intelligence/stats
//
// Pipeline statistics
// ────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const stats = await IntelligencePipeline.getStats();
    return apiSuccess(stats);
  } catch (err) {
    return apiError('Failed to get intelligence stats');
  }
}
