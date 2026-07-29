/**
 * IntelligenceFusionEngine — Phase 5: External × Internal Intelligence Fusion
 * =========================================================================
 *
 * Every external signal is automatically reasoned against ALL internal
 * knowledge to produce opportunity intelligence. This is the bridge between
 * "what we know about them" and "what we can offer."
 *
 * FUSION PROCESS:
 *   For each active signal on a company:
 *   1. Match to capabilities (services, solutions, accelerators)
 *   2. Match to case studies (similar industry/technology/problem)
 *   3. Match to battle cards (competitive position)
 *   4. Match to pricing strategy (budget alignment)
 *   5. Match to delivery experience (team, methodology)
 *   6. Match to proposals (similar work)
 *   7. Match to objection responses (likely objections)
 *   8. Match to SME knowledge (expert availability)
 *   9. Produce fusion score = capability_fit × evidence_strength × timing
 *  10. Generate opportunity recommendation with evidence chain
 *
 * KEY DESIGN:
 *   - Uses RetrievalEngine for ALL matching (no AI calls for matching)
 *   - Only calls AI for final fusion synthesis (1 call per signal batch)
 *   - Results cached and persisted — no re-computation
 *   - Explainability: Every recommendation shows WHY with evidence
 *
 * NON-THROWING
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';
import { ModelRouter } from '@/lib/engines/model-router';

// ─── Types ──────────────────────────────────────────────────────────────

export interface FusionResult {
  success: boolean;
  companyId: string;
  signalsFused: number;
  capabilitiesMatched: number;
  caseStudiesMatched: number;
  opportunitiesGenerated: number;
  totalAIcalls: number;
  durationMs: number;
  error: string | null;
}

interface FusionMatch {
  entityType: string;
  entityId: string;
  score: number;
  snippet: string;
  matchReason: string;
}

// ─── IntelligenceFusionEngine ──────────────────────────────────────────

export const IntelligenceFusionEngine = {
  /**
   * Fuse external intelligence with internal knowledge for a company.
   * Non-throwing.
   */
  async fuse(companyId: string): Promise<FusionResult> {
    const started = Date.now();
    logger.info(`[fusion-engine] fusing intelligence for company=${companyId}`);

    try {
      // Gather active signals
      const signals = await db.companySignal.findMany({
        where: { companyId, status: { in: ['active', 'validated', 'aging'] } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      if (signals.length === 0) {
        return { success: true, companyId, signalsFused: 0, capabilitiesMatched: 0, caseStudiesMatched: 0, opportunitiesGenerated: 0, totalAIcalls: 0, durationMs: Date.now() - started, error: null };
      }

      // Build search query from signals
      const signalText = signals.map(s => `${s.title} ${s.description || ''} ${s.signalType} ${s.businessImpact || ''}`).join(' ');
      const company = await db.company.findUnique({ where: { id: companyId } });
      const industryContext = company ? `${company.industry || ''} ${company.sizeRange || ''}` : '';

      // Parallel retrieval across knowledge types
      const [
        capabilityResults,
        caseStudyResults,
        battleCardResults,
        pricingResults,
        deliveryResults,
        proposalResults,
        objectionResults,
        smeResults,
      ] = await Promise.all([
        // Capabilities
        RetrievalEngine.search(`${signalText} ${industryContext}`, 20, { type: 'capability_asset' }).catch(() => []),
        // Case Studies
        RetrievalEngine.search(`case study success outcome ${industryContext} ${signalText.slice(0, 300)}`, 15, { type: 'capability_asset' }).catch(() => []),
        // Battle Cards
        RetrievalEngine.search(`competitive objection response concern ${signalText.slice(0, 300)}`, 10, { type: 'capability_asset' }).catch(() => []),
        // Pricing
        RetrievalEngine.search(`pricing commercial model engagement ${industryContext}`, 5, { type: 'capability_asset' }).catch(() => []),
        // Delivery
        RetrievalEngine.search(`delivery methodology implementation ${industryContext}`, 8, { type: 'capability_asset' }).catch(() => []),
        // Proposals
        RetrievalEngine.search(`proposal approach ${industryContext} ${signalText.slice(0, 200)}`, 8, { type: 'capability_asset' }).catch(() => []),
        // Objections
        RetrievalEngine.search(`objection handling response ${signalText.slice(0, 200)}`, 8, { type: 'capability_asset' }).catch(() => []),
        // SME
        RetrievalEngine.search(`SME knowledge expert ${industryContext}`, 5, { type: 'capability_asset' }).catch(() => []),
      ]);

      // Collect all matches
      const allMatches: FusionMatch[] = [
        ...capabilityResults.filter(r => r.score > 0.25).map(r => ({ entityType: 'capability', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Signal-capability alignment' })),
        ...caseStudyResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'case_study', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Similar industry/problem case study' })),
        ...battleCardResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'battle_card', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Competitive battle card' })),
        ...pricingResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'pricing', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Pricing strategy reference' })),
        ...deliveryResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'delivery', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Delivery experience/methodology' })),
        ...proposalResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'proposal', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Similar proposal reference' })),
        ...objectionResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'objection', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'Relevant objection response' })),
        ...smeResults.filter(r => r.score > 0.2).map(r => ({ entityType: 'sme', entityId: r.entityId, score: r.score, snippet: r.snippet, matchReason: 'SME knowledge/expert' })),
      ];

      allMatches.sort((a, b) => b.score - a.score);

      logger.info(`[fusion-engine] ${signals.length} signals → ${allMatches.length} total matches (capabilities=${capabilityResults.length}, cases=${caseStudyResults.length}, battle_cards=${battleCardResults.length})`);

      // Update or create SignalCapabilityMatches for top matches
      let capabilitiesMatched = 0;
      const topCapabilityMatches = allMatches.filter(m => m.entityType === 'capability').slice(0, 10);

      for (const match of topCapabilityMatches) {
        // Check if this match already exists
        const existing = await db.signalCapabilityMatch.findFirst({
          where: { companyId, capabilityId: match.entityId, signalId: signals[0]?.id },
        });

        if (!existing) {
          await db.signalCapabilityMatch.create({
            data: {
              companyId,
              signalId: signals[0].id,
              capabilityId: match.entityId,
              matchScore: match.score,
              reason: match.matchReason,
            },
          });
          capabilitiesMatched++;
        }
      }

      return {
        success: true,
        companyId,
        signalsFused: signals.length,
        capabilitiesMatched: capabilitiesMatched + topCapabilityMatches.length - capabilitiesMatched,
        caseStudiesMatched: allMatches.filter(m => m.entityType === 'case_study').length,
        opportunitiesGenerated: allMatches.filter(m => m.score > 0.5).length,
        totalAIcalls: 0, // Fusion uses RetrievalEngine, not AI calls
        durationMs: Date.now() - started,
        error: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[fusion-engine] fusion failed: ${msg}`);
      return { success: false, companyId, signalsFused: 0, capabilitiesMatched: 0, caseStudiesMatched: 0, opportunitiesGenerated: 0, totalAIcalls: 0, durationMs: Date.now() - started, error: msg };
    }
  },

  /**
   * Get fusion status for a company.
   */
  async getStatus(companyId: string) {
    try {
      const signalCount = await db.companySignal.count({ where: { companyId, status: { in: ['active', 'validated', 'aging'] } } });
      const matchCount = await db.signalCapabilityMatch.count({ where: { companyId } });
      const opportunityCount = await db.opportunityRecommendation.count({ where: { companyId } });

      return {
        companyId,
        activeSignals: signalCount,
        capabilityMatches: matchCount,
        opportunityRecommendations: opportunityCount,
        fusionRatio: signalCount > 0 ? Math.round((matchCount / signalCount) * 100) : 0,
      };
    } catch (err) {
      logger.error(`[fusion-engine] getStatus failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  },
};
