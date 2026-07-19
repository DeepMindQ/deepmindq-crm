import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/g-outreach/review-queue
   Returns all pending_review drafts enriched with contact,
   company, governance audit data, and priority classification.

   Query params:
     ?priority=high|medium|low  — filter by priority
     ?assigneeId=xxx            — filter by assigned rep
     ?limit=50                  — pagination (default 50)
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const priorityFilter = searchParams.get('priority');
    const assigneeIdFilter = searchParams.get('assigneeId');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    // ── 1. Fetch all pending_review drafts with contact + company ──
    const whereClause: Record<string, unknown> = { status: 'pending_review' };
    if (assigneeIdFilter) {
      whereClause.assigneeId = assigneeIdFilter;
    }

    const drafts = await db.draft.findMany({
      where: whereClause,
      include: {
        contact: {
          include: {
            company: {
              include: {
                researchCard: { select: { id: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 3, // fetch extra to allow for post-filter by priority
    });

    if (drafts.length === 0) {
      return NextResponse.json({
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        drafts: [],
      });
    }

    // ── 2. Collect unique company IDs ──
    const companyIds = [
      ...new Set(
        drafts
          .map(d => d.contact.company?.id)
          .filter((id): id is string => !!id),
      ),
    ];

    // ── 3. Batch-fetch most recent AIGenerationAudit per company (email_draft type) ──
    const governanceAudits = await db.aIGenerationAudit.findMany({
      where: {
        companyId: { in: companyIds },
        generationType: 'email_draft',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map: companyId -> most recent audit
    const auditByCompany = new Map<string, typeof governanceAudits[number]>();
    for (const audit of governanceAudits) {
      if (!auditByCompany.has(audit.companyId!)) {
        auditByCompany.set(audit.companyId!, audit);
      }
    }

    // ── 4. Batch-fetch active signals for priority classification ──
    const activeSignals = await db.companySignal.findMany({
      where: {
        companyId: { in: companyIds },
        status: { in: ['detected', 'validated', 'active'] },
      },
    });

    // Map: companyId -> signals[]
    const signalsByCompany = new Map<string, typeof activeSignals[number][]>();
    for (const signal of activeSignals) {
      const existing = signalsByCompany.get(signal.companyId) || [];
      existing.push(signal);
      signalsByCompany.set(signal.companyId, existing);
    }

    // ── 5. Batch-fetch highest SignalCapabilityMatch per company ──
    const capabilityMatches = await db.signalCapabilityMatch.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { matchScore: 'desc' },
    });

    // Map: companyId -> highest matchScore
    const bestMatchByCompany = new Map<string, number>();
    for (const match of capabilityMatches) {
      if (!bestMatchByCompany.has(match.companyId)) {
        bestMatchByCompany.set(match.companyId, match.matchScore);
      }
    }

    // ── 6. Collect sequence step info (batch) ──
    const sequenceStepIds = [
      ...new Set(
        drafts
          .map(d => d.sequenceStepId)
          .filter((id): id is string => !!id),
      ),
    ];

    const sequenceSteps = sequenceStepIds.length > 0
      ? await db.sequenceStep.findMany({
          where: { id: { in: sequenceStepIds } },
        })
      : [];

    const stepMap = new Map(sequenceSteps.map(s => [s.id, s]));

    // ── 7. Build signal title lookup for governance display ──
    const allSignalIdsUsed = governanceAudits.flatMap(a => {
      try { return JSON.parse(a.signalIdsUsed) as string[]; }
      catch { return []; }
    });
    const uniqueSignalIds = [...new Set(allSignalIdsUsed)];

    const signalTitles = uniqueSignalIds.length > 0
      ? await db.companySignal.findMany({
          where: { id: { in: uniqueSignalIds } },
          select: { id: true, title: true },
        })
      : [];
    const signalTitleMap = new Map(signalTitles.map(s => [s.id, s.title]));

    // ── 8. Enrich and classify each draft ──
    const enrichedDrafts = drafts.map(draft => {
      const company = draft.contact.company;
      const companyId = company?.id;

      // Governance data
      const audit = companyId ? auditByCompany.get(companyId) : undefined;
      let evidenceUsed: string[] = [];
      let signalUsedTitle: string | null = null;

      if (audit) {
        try { evidenceUsed = JSON.parse(audit.evidenceIdsUsed) as string[]; }
        catch { /* ignore parse error */ }
        try {
          const signalIds = JSON.parse(audit.signalIdsUsed) as string[];
          if (signalIds.length > 0) {
            signalUsedTitle = signalTitleMap.get(signalIds[0]) || null;
          }
        } catch { /* ignore parse error */ }
      }

      const governance = {
        researchConfidence: audit?.researchConfidence ?? 0,
        freshnessScore: audit?.freshnessScore ?? 0,
        governancePassed: audit?.governancePassed ?? false,
        evidenceUsed,
        signalUsed: signalUsedTitle,
        capabilityMatchScore: companyId ? (bestMatchByCompany.get(companyId) ?? 0) : 0,
      };

      // Priority classification
      const companySignals = companyId ? (signalsByCompany.get(companyId) || []) : [];
      const hasHighImpactSignal = companySignals.some(s => s.impact === 'high');
      const hasAnyActiveSignal = companySignals.length > 0;
      const intelligenceScore = company?.intelligenceScore ?? 0;

      let priority: 'high' | 'medium' | 'low' = 'low';
      if (
        intelligenceScore >= 70 ||
        hasHighImpactSignal ||
        governance.researchConfidence >= 0.7
      ) {
        priority = 'high';
      } else if (
        intelligenceScore >= 40 ||
        hasAnyActiveSignal ||
        governance.governancePassed
      ) {
        priority = 'medium';
      }

      // Sequence step info
      const step = draft.sequenceStepId ? stepMap.get(draft.sequenceStepId) : undefined;

      return {
        id: draft.id,
        subject: draft.subject,
        body: draft.body,
        cta: draft.cta,
        status: draft.status,
        confidenceScore: draft.confidenceScore,
        priority,
        contact: {
          id: draft.contact.id,
          name: draft.contact.normalizedName || draft.contact.rawName,
          email: draft.contact.email,
          title: draft.contact.title || null,
        },
        company: {
          id: company?.id || null,
          name: company?.normalizedName || company?.rawName || null,
          industry: company?.industry || null,
        },
        governance,
        sequenceInfo: {
          sequenceId: draft.sequenceId || null,
          stepNumber: step?.stepNumber ?? null,
          stepPurpose: step?.subject || null,
        },
        assigneeId: draft.assigneeId || null,
        createdAt: draft.createdAt.toISOString(),
      };
    });

    // ── 9. Filter by priority if requested ──
    const filtered = priorityFilter
      ? enrichedDrafts.filter(d => d.priority === priorityFilter)
      : enrichedDrafts;

    const output = filtered.slice(0, limit);

    // ── 10. Build summary (from full set before priority filter) ──
    const summary = {
      total: enrichedDrafts.length,
      high: enrichedDrafts.filter(d => d.priority === 'high').length,
      medium: enrichedDrafts.filter(d => d.priority === 'medium').length,
      low: enrichedDrafts.filter(d => d.priority === 'low').length,
    };

    return NextResponse.json({ summary, drafts: output });
  } catch (error) {
    console.error('[review-queue] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load review queue', detail: String(error) },
      { status: 500 },
    );
  }
}