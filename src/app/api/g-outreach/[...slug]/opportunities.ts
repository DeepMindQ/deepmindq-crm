import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/g-outreach/opportunities
   Opportunity-level review queue — replaces draft-level queue.

   Returns all pending_review OpportunityRecommendations enriched
   with company, signal, capability, evidence quality, and scoring.

   Query params:
     ?status=pending_review|accepted|rejected|monitored|all
     ?priority=high|medium|low
     ?companyId=xxx
     ?limit=50
   ═══════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending_review';
    const priorityFilter = searchParams.get('priority');
    const companyIdFilter = searchParams.get('companyId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    // ── Build where clause ──
    const whereClause: Record<string, unknown> = {};
    if (statusFilter === 'all') {
      // No status filter
    } else {
      whereClause.status = statusFilter;
    }
    if (priorityFilter) {
      whereClause.priority = priorityFilter;
    }
    if (companyIdFilter) {
      whereClause.companyId = companyIdFilter;
    }

    // ── Fetch opportunities with relations ──
    const opportunities = await db.opportunityRecommendation.findMany({
      where: whereClause,
      include: {
        company: {
          select: { id: true, rawName: true, normalizedName: true, industry: true, sizeRange: true, domain: true, intelligenceScore: true },
        },
        signal: {
          select: { id: true, signalType: true, title: true, description: true, impact: true, confidence: true, status: true },
        },
        capabilityMatch: {
          select: { id: true, matchScore: true, reason: true, businessProblem: true, salesAngle: true, capabilityId: true },
        },
        pursuits: {
          select: { id: true, owner: true, status: true, outcomeStage: true, nextAction: true, nextActionAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (opportunities.length === 0) {
      return NextResponse.json({
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        opportunities: [],
      });
    }

    // ── Batch fetch capability titles ──
    const capabilityIds = [
      ...new Set(
        opportunities
          .map(o => o.capabilityMatch?.capabilityId)
          .filter((id): id is string => !!id),
      ),
    ];

    const capabilities = capabilityIds.length > 0
      ? await db.capabilityAsset.findMany({
          where: { id: { in: capabilityIds } },
          select: { id: true, title: true, category: true },
        })
      : [];

    const capMap = new Map(capabilities.map(c => [c.id, c]));

    // ── Enrich each opportunity ──
    const enriched = opportunities.map(opp => {
      const cap = opp.capabilityMatch?.capabilityId ? capMap.get(opp.capabilityMatch.capabilityId) : undefined;
      const activePursuit = opp.pursuits.find(p => p.status === 'active');

      // Parse recommendedStakeholders
      let stakeholders: string[] = [];
      try { stakeholders = JSON.parse(opp.recommendedStakeholders); } catch { /* empty */ }

      // Parse evidenceIds
      let evidenceIds: string[] = [];
      try { evidenceIds = JSON.parse(opp.evidenceIds); } catch { /* empty */ }

      return {
        id: opp.id,
        opportunityTitle: opp.opportunityTitle,
        businessTrigger: opp.businessTrigger,
        whyNow: opp.whyNow,
        businessProblem: opp.businessProblem,
        recommendedCapability: opp.recommendedCapability,
        recommendedStakeholders: stakeholders,
        suggestedConversation: opp.suggestedConversation,
        status: opp.status,
        rejectionReason: opp.rejectionReason,
        rejectionFeedback: opp.rejectionFeedback,
        reviewedBy: opp.reviewedBy,
        reviewedAt: opp.reviewedAt?.toISOString() || null,

        // Scoring (explainable to sales users)
        scoring: {
          signalConfidence: Math.round(opp.confidenceScore * 100),
          capabilityMatch: Math.round(opp.matchScore * 100),
          freshnessScore: opp.freshnessScore,
          evidenceQuality: null as number | null, // Not stored on opp, can be computed on demand
          opportunityScore: opp.opportunityScore,
          priority: opp.priority,
        },

        company: {
          id: opp.company.id,
          name: opp.company.normalizedName || opp.company.rawName,
          industry: opp.company.industry,
          sizeRange: opp.company.sizeRange,
          domain: opp.company.domain,
          intelligenceScore: opp.company.intelligenceScore,
        },

        signal: {
          id: opp.signal.id,
          signalType: opp.signal.signalType,
          title: opp.signal.title,
          impact: opp.signal.impact,
          confidence: opp.signal.confidence,
        },

        capability: {
          id: opp.capabilityMatch.id,
          title: cap?.title || opp.recommendedCapability,
          category: cap?.category || null,
          matchScore: opp.capabilityMatch.matchScore,
          salesAngle: opp.capabilityMatch.salesAngle,
        },

        pursuit: activePursuit || null,
        evidenceCount: evidenceIds.length,
        createdAt: opp.createdAt.toISOString(),
      };
    });

    // ── Summary counts ──
    const summary = {
      total: enriched.length,
      high: enriched.filter(o => o.scoring.priority === 'high').length,
      medium: enriched.filter(o => o.scoring.priority === 'medium').length,
      low: enriched.filter(o => o.scoring.priority === 'low').length,
    };

    return NextResponse.json({ summary, opportunities: enriched });
  } catch (error) {
    console.error('[opportunities] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load opportunity queue', detail: String(error) },
      { status: 500 },
    );
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/g-outreach/opportunities
   Generate opportunity recommendations.

   Body:
     companyId: string           (required)
     signalId: string            (required — generate for one signal+match)
     capabilityMatchId: string   (required)
   OR
     companyId: string           (required)
     mode: "batch"               (generate all opportunities for company)
     minMatchScore?: number      (default 0.25)
   ═══════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, signalId, capabilityMatchId, mode, minMatchScore } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    // Dynamic import to avoid circular deps
    const { generateOpportunityRecommendation, generateOpportunityRecommendationsBatch } =
      await import('@/lib/research-engine/opportunity-recommendation');

    if (mode === 'batch') {
      // Batch generation for a company
      const result = await generateOpportunityRecommendationsBatch({
        companyId,
        minMatchScore: minMatchScore ?? 0.25,
      });
      return NextResponse.json({
        success: true,
        generated: result.generated,
        opportunities: result.results.map(r => ({
          id: r.opportunity.id,
          opportunityTitle: r.opportunity.opportunityTitle,
          opportunityScore: r.scoring.compositeScore,
          priority: r.scoring.priority,
          status: r.opportunity.status,
        })),
      });
    }

    // Single opportunity generation
    if (!signalId || !capabilityMatchId) {
      return NextResponse.json(
        { error: 'signalId and capabilityMatchId are required (or use mode=batch)' },
        { status: 400 },
      );
    }

    const result = await generateOpportunityRecommendation({
      companyId,
      signalId,
      capabilityMatchId,
    });

    return NextResponse.json({
      success: true,
      opportunity: {
        id: result.opportunity.id,
        opportunityTitle: result.opportunity.opportunityTitle,
        businessTrigger: result.opportunity.businessTrigger,
        whyNow: result.opportunity.whyNow,
        businessProblem: result.opportunity.businessProblem,
        recommendedCapability: result.opportunity.recommendedCapability,
        recommendedStakeholders: result.opportunity.recommendedStakeholders,
        suggestedConversation: result.opportunity.suggestedConversation,
        status: result.opportunity.status,
      },
      scoring: {
        signalConfidence: result.scoring.signalConfidence,
        capabilityMatch: result.scoring.capabilityMatch,
        freshnessScore: result.scoring.freshnessScore,
        evidenceQuality: result.scoring.evidenceQuality,
        businessImpact: result.scoring.businessImpact,
        compositeScore: result.scoring.compositeScore,
        priority: result.scoring.priority,
      },
      signalInfo: result.signalInfo,
      capabilityInfo: result.capabilityInfo,
    });
  } catch (error) {
    console.error('[opportunities] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to generate opportunity recommendation', detail: String(error) },
      { status: 500 },
    );
  }
}