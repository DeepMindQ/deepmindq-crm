/**
 * AI Relationship Mapping API (Wave 5.2)
 *
 * GET /api/contacts/relationship-map?companyId=xxx
 *
 * Returns the complete stakeholder map for a company:
 * - Power-Interest grid positioning
 * - Stakeholder role classification
 * - Coverage gaps and recommendations
 * - Relationship health score
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { buildRelationshipMap } from '@/lib/relationship-mapping-engine';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) return apiError('companyId is required', 400);

    const map = await buildRelationshipMap(companyId);

    // Persist key findings as AI insight
    try {
      await createInsights([{
        companyId,
        type: 'SIGNAL',
        title: `Relationship Map: ${map.companyName} — ${map.mappedContacts} contacts, Health ${map.relationshipHealth}/100`,
        description: `Stakeholder map complete. ${map.economicBuyers.length} economic buyers, ${map.champions.length} champions, ${map.coverage.gaps.length} coverage gaps. ${map.powerGrid.manageClosely} contacts in "manage closely" quadrant.`,
        evidence: map.evidence.map(e => ({
          source: e.source,
          snippet: `${e.signal}: ${e.evidence}`,
          reliability: e.reliability,
        })),
        confidenceScore: map.confidenceScore,
        impactScore: map.relationshipHealth,
        urgencyScore: map.relationshipHealth < 40 ? 70 : map.coverage.gaps.length > 2 ? 50 : 25,
        reasoning: `${map.coverage.gaps.length} gaps identified: ${map.coverage.gaps.slice(0, 3).join('; ')}`,
        recommendedAction: map.coverage.recommendations[0] || 'Monitor relationship health',
        sourceType: 'relationship_mapping_engine',
        sourceRoute: '/api/contacts/relationship-map',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }]);
    } catch (e) {
      logger.warn('[relationship-map] Failed to persist insight:', { error: e });
    }

    return apiSuccess(map);
  } catch (error) {
    logger.error('[contacts/relationship-map] Error:', { error: error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return apiError(message, message.includes('not found') ? 404 : 500);
  }
}
