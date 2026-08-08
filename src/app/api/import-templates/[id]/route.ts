/**
 * Import Templates Detail API — Task 4.6
 *
 * DELETE /api/import-templates/[id] — Delete template
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { deleteImportTemplate } from '@/lib/data-import/enhanced-import';
import { logAction } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    const deleted = await deleteImportTemplate(id);
    if (!deleted) {
      return apiNotFound('ImportTemplate');
    }

    // Audit log (fire-and-forget)
    logAction('delete', 'import_template', id, {}, session?.id).catch(() => {});

    return apiSuccess({ id, deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete import template';
    return apiError(message);
  }
}
