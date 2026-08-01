/**
 * Ticket 11 — Data Import Detail API
 *
 * GET /api/data-import/[id] — Get upload with rows and quality scores
 */

import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { getUploadWithDetails } from '@/lib/data-import/pipeline';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
