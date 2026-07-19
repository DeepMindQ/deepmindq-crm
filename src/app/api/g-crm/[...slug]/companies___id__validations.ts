import { NextRequest } from 'next/server';
import { apiSuccess, apiError, validateBody, sanitizeFields } from '@/lib/apiHelpers';
import { submitValidationSchema } from '@/lib/validations';
import { getCompanyValidations, submitValidation } from '@/lib/intelligence-validation';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/companies/:id/validations

   Retrieve intelligence validations for a company.
   Query params: artifactType, limit, offset
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    const url = new URL(_request.url);
    const artifactType = url.searchParams.get('artifactType') as any || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const result = await getCompanyValidations(companyId, {
      artifactType,
      limit: Math.min(limit, 200),
      offset,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error('[validations] GET error:', error);
    return apiError('Failed to fetch validations');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/g-crm/companies/:id/validations

   Submit a human validation rating for an intelligence artifact.
   Snapshots the artifact at validation time.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;
    const rawBody = await request.json();
    const data = validateBody(submitValidationSchema, rawBody);
    if (data instanceof Response) return data;

    const result = await submitValidation({
      companyId,
      artifactType: data.artifactType,
      artifactId: data.artifactId,
      rating: data.rating,
      accuracy: data.accuracy ?? null,
      relevance: data.relevance ?? null,
      actionability: data.actionability ?? null,
      feedback: data.feedback ?? null,
      validatorContext: data.validatorContext ?? null,
      validatedBy: data.validatedBy ?? null,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    console.error('[validations] POST error:', error);
    return apiError('Failed to submit validation');
  }
}