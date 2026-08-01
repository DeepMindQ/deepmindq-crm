/**
 * Ticket 11 — Data Import Detail API
 *
 * GET /api/data-import/[id] — Get upload with rows and quality scores
 */

import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { getUploadWithDetails } from '@/lib/data-import/pipeline';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate: authenticated users only for data import detail
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    const { upload, qualityScores } = await getUploadWithDetails(id);

    return apiSuccess({
      upload,
      qualityScores,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}
