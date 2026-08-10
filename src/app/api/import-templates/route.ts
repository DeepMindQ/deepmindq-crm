/**
 * Import Templates API Routes — Task 4.6: Bulk Import/Export Pipeline
 *
 * GET    /api/import-templates          — List available templates
 * POST   /api/import-templates          — Create custom template
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiPaginated, safeInt } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { validateRequest } from '@/lib/with-validation';
import { genericBodySchema } from '@/lib/validation-schemas';
import {
  listImportTemplates,
  createImportTemplate,
} from '@/lib/data-import/enhanced-import';
import { logAction } from '@/lib/audit';

// ═══════════════════════════════════════════════════════════════
// GET /api/import-templates — List templates
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') ?? undefined;
    const entityType = searchParams.get('entityType') ?? undefined;
    const isActive = searchParams.get('isActive')
      ? searchParams.get('isActive') === 'true'
      : undefined;

    const templates = await listImportTemplates({
      source,
      entityType,
      isActive,
    });

    return apiSuccess(templates);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list import templates';
    return apiError(message);
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/import-templates — Create custom template
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const validated = await validateRequest(req, genericBodySchema);
    if (validated instanceof Response) return validated;
    const body = validated.data as { name?: unknown; source?: unknown; entityType?: unknown; columnMap?: unknown };
    const { name, source, entityType, columnMap } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('name is required and must be a non-empty string', 400);
    }
    if (!entityType || typeof entityType !== 'string') {
      return apiError('entityType is required (companies or contacts)', 400);
    }
    if (!columnMap || typeof columnMap !== 'object' || Array.isArray(columnMap)) {
      return apiError('columnMap is required and must be an object', 400);
    }

    const validEntityTypes = ['companies', 'contacts'];
    if (!validEntityTypes.includes(entityType)) {
      return apiError(`entityType must be one of: ${validEntityTypes.join(', ')}`, 400);
    }

    const template = await createImportTemplate({
      name: name.trim(),
      source: (source as string) || 'custom',
      entityType: entityType as string,
      columnMap: columnMap as Record<string, string>,
    });

    // Audit log (fire-and-forget)
    logAction('create', 'import_template', template.id, {
      name: template.name,
      source: template.source,
      entityType: template.entityType,
    }, session?.id).catch(() => {});

    return apiSuccess(template);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create import template';
    return apiError(message);
  }
}
