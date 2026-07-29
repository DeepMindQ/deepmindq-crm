/**
 * ContinuousLearningLoop — Phase 12: Learning from Every Interaction
 * ================================================================
 *
 * Every interaction (win, loss, feedback, email reply, meeting note)
 * creates a LearningEvent that updates organizational memory.
 *
 * KEY DESIGN:
 *   - Knowledge from HSBC engagement auto-reusable for next bank prospect
 *   - Feedback on AI recommendations improves future matching
 *   - Win/loss patterns adjust scoring weights
 *   - New documents ingested become searchable knowledge
 *   - Nothing is lost — every interaction improves the platform
 *
 * LEARNING SOURCES:
 *   - Win/Loss outcomes → Update capability weights, industry fit
 *   - Feedback on recommendations → Improve matching confidence
 *   - Email replies → Extract objections, language patterns
 *   - Meeting notes → Extract client priorities, concerns
 *   - Document uploads → Ingest into knowledge graph
 *   - Signal validation → Improve source reliability scores
 *
 * NON-THROWING
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RetrievalEngine } from '@/lib/engines/retrieval-engine';

// ─── ContinuousLearningLoop ────────────────────────────────────────────

export const ContinuousLearningLoop = {
  /**
   * Record a learning event from any interaction.
   */
  async record(params: {
    companyId?: string;
    eventType: string;
    source: string;
    description: string;
    learnedInsight: string;
    applicableContext?: Record<string, unknown>;
    applicableTags?: string[];
    confidence?: number;
  }): Promise<string | null> {
    try {
      const event = await db.learningEvent.create({
        data: {
          companyId: params.companyId,
          eventType: params.eventType,
          source: params.source,
          description: params.description,
          learnedInsight: params.learnedInsight,
          applicableContext: JSON.stringify(params.applicableContext || {}),
          applicableTags: JSON.stringify(params.applicableTags || []),
          confidence: params.confidence ?? 0.5,
        },
      });

      // If this is a high-confidence learning, create/update a CapabilityAsset
      if (params.confidence && params.confidence >= 0.7 && (params.eventType === 'win' || params.eventType === 'lesson_learned' || params.eventType === 'new_case_study')) {
        try {
          const existingAsset = await db.capabilityAsset.findFirst({
            where: { contentHash: await simpleHash(params.learnedInsight) },
          });

          if (!existingAsset) {
            const category = params.eventType === 'win' ? 'case_study' : params.eventType === 'lesson_learned' ? 'lesson_learned' : 'proof_point';
            const tags = params.applicableTags || [];

            const asset = await db.capabilityAsset.create({
              data: {
                title: params.description.slice(0, 200),
                summary: params.learnedInsight,
                category,
                tags: JSON.stringify(tags),
                isActive: true,
              },
            });

            // Update learning event with capability reference
            await db.learningEvent.update({
              where: { id: event.id },
              data: { createdCapabilityAssetId: asset.id },
            });

            // Embed the new capability for search
            await RetrievalEngine.embedEntity('capability_asset', asset.id, `${asset.title} ${asset.summary} ${tags.join(' ')}`).catch(() => {});

            logger.info(`[learning] created new CapabilityAsset ${asset.id} from learning event`);
          }
        } catch (err) {
          logger.error(`[learning] failed to create CapabilityAsset: ${err instanceof Error ? err.message : err}`);
        }
      }

      logger.info(`[learning] recorded ${params.eventType} event: ${params.description.slice(0, 100)}`);
      return event.id;
    } catch (err) {
      logger.error(`[learning] record failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  },

  /**
   * Find reusable learnings for a company (based on industry, size, technology).
   */
  async findReusableLearnings(context: {
    industry?: string;
    companySize?: string;
    technology?: string;
    serviceLine?: string;
  }): Promise<{ id: string; insight: string; source: string; confidence: number; applicableContext: unknown; reuseCount: number }[]> {
    try {
      const learnings = await db.learningEvent.findMany({
        where: {
          confidence: { gte: 0.5 },
          verified: true,
        },
        orderBy: [{ reuseCount: 'desc' }, { confidence: 'desc' }],
        take: 20,
      });

      // Filter by context similarity
      const contextTags = [context.industry, context.companySize, context.technology, context.serviceLine].filter(Boolean);
      const scored = learnings.map(l => {
        let applicableContext: unknown = {};
        try { applicableContext = JSON.parse(l.applicableContext); } catch { /* empty */ }
        let tags: string[] = [];
        try { tags = JSON.parse(l.applicableTags); } catch { /* empty */ }

        // Score based on tag overlap
        const overlap = tags.filter(t => contextTags.some(ct => ct != null && t.toLowerCase().includes(ct.toLowerCase())));
        return {
          id: l.id,
          insight: l.learnedInsight,
          source: l.source,
          confidence: l.confidence,
          applicableContext,
          reuseCount: l.reuseCount,
          relevanceScore: overlap.length > 0 ? Math.min(1, 0.5 + overlap.length * 0.15) : 0,
        };
      });

      return scored.filter(s => s.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
    } catch (err) {
      logger.error(`[learning] findReusableLearnings failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  },

  /**
   * Increment reuse count when a learning is applied.
   */
  async markReused(learningId: string): Promise<void> {
    try {
      await db.learningEvent.update({
        where: { id: learningId },
        data: { reuseCount: { increment: 1 }, lastReusedAt: new Date() },
      });
    } catch { /* ignore */ }
  },

  /**
   * Get learning statistics.
   */
  async getStats() {
    try {
      const total = await db.learningEvent.count();
      const verified = await db.learningEvent.count({ where: { verified: true } });
      const withCapability = await db.learningEvent.count({ where: { createdCapabilityAssetId: { not: null } } });
      const totalReuses = await db.learningEvent.aggregate({ _sum: { reuseCount: true } });
      const byType = await db.learningEvent.groupBy({ by: ['eventType'], _count: true });

      return {
        totalLearnings: total,
        verifiedLearnings: verified,
        capabilitiesCreated: withCapability,
        totalReuses: totalReuses._sum.reuseCount || 0,
        byType: byType.map(g => ({ type: g.eventType, count: g._count })),
      };
    } catch (err) {
      logger.error(`[learning] getStats failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────

async function simpleHash(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return `fallback_${Math.abs(h).toString(16)}`;
  }
}
