import { NextRequest } from 'next/server';
import { SynthesisEngine, ModelRouter } from '@/lib/engines';
import type { BriefType, BriefDepth } from '@/lib/engines';
import { withApiMiddleware } from '@/lib/api-middleware';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';

/**
 * POST /api/engines/brief
 *
 * Generates a depth-first, evidence-grounded brief using the new Phase B
 * SynthesisEngine. Produces long-form (1200+ word) briefs with explicit
 * evidence citations and per-section confidence scores.
 */

interface BriefRequestBody {
  briefType?: BriefType;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  depth?: BriefDepth;
  audience?: 'executive' | 'analyst' | 'sales';
  focusAreas?: string[];
}

const VALID_BRIEF_TYPES = new Set<BriefType>([
  'account_brief',
  'deal_strategy',
  'exec_summary',
  'contact_brief',
  'opportunity_brief',
]);

export async function POST(request: NextRequest) {
  const middleware = await withApiMiddleware(request, {
    requireAuth: true,
    rateLimitKey: 'engines:brief',
    rateLimitMax: 20,
    rateLimitWindowMs: 60_000,
    auditEntity: 'brief',
    auditAction: 'engines_brief_generate',
  });
  if (!middleware.authorized) {
    return middleware.response ?? apiError('Unauthorized', 401);
  }

  try {
    const body = (await request.json()) as BriefRequestBody;

    if (!body.briefType || !VALID_BRIEF_TYPES.has(body.briefType)) {
      return apiError(
        `briefType must be one of: ${Array.from(VALID_BRIEF_TYPES).join(', ')}`,
        400,
      );
    }
    if (!body.companyId && !body.contactId && !body.opportunityId) {
      return apiError(
        'At least one of companyId, contactId, or opportunityId is required.',
        400,
      );
    }

    logger.info(`[api/engines/brief] briefType=${body.briefType} depth=${body.depth ?? 'standard'} company=${body.companyId ?? '-'} contact=${body.contactId ?? '-'}`);

    const brief = await SynthesisEngine.generate({
      briefType: body.briefType,
      context: {
        companyId: body.companyId,
        contactId: body.contactId,
        opportunityId: body.opportunityId,
      },
      depth: body.depth,
      audience: body.audience,
      focusAreas: body.focusAreas,
      compositionId: `api:${Date.now()}`,
    });

    if (!brief.success) {
      logger.info(`[api/engines/brief] brief generation did not succeed: ${brief.error}`);
    } else {
      logger.info(
        `[api/engines/brief] brief generated: ${brief.wordCount} words, ` +
          `confidence=${brief.confidence.toFixed(2)}, citations=${brief.citations.length}`,
      );
    }

    return apiSuccess({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[api/engines/brief] failed: ${msg}`);
    return apiError('Failed to generate brief', 500);
  }
}

/**
 * GET /api/engines/brief
 * Returns the brief type catalog + the current ModelRouter health status.
 */
export async function GET(request: NextRequest) {
  const middleware = await withApiMiddleware(request, {
    requireAuth: true,
    rateLimitKey: 'engines:brief:meta',
    rateLimitMax: 60,
  });
  if (!middleware.authorized) {
    return middleware.response ?? apiError('Unauthorized', 401);
  }

  const health = await ModelRouter.health();

  return apiSuccess({
    briefTypes: [
      {
        id: 'account_brief',
        name: 'Account Brief',
        description: 'Full strategic narrative for an account. 1200-2000 words.',
        depthOptions: ['standard', 'deep'],
      },
      {
        id: 'deal_strategy',
        name: 'Deal Strategy',
        description: 'Pursuit strategy with go/no-go, win themes, risks. 1000-1800 words.',
        depthOptions: ['standard', 'deep'],
      },
      {
        id: 'exec_summary',
        name: 'Executive Summary',
        description: 'Tight 1-page summary for a busy VP. 400-600 words.',
        depthOptions: ['standard', 'deep'],
      },
      {
        id: 'contact_brief',
        name: 'Contact Brief',
        description: 'Person intelligence for engagement prep. 800-1400 words.',
        depthOptions: ['standard', 'deep'],
      },
      {
        id: 'opportunity_brief',
        name: 'Opportunity Brief',
        description: 'Deep-dive on a specific RFP/RFI/signal. 800-1400 words.',
        depthOptions: ['standard', 'deep'],
      },
    ],
    modelHealth: health,
  });
}
