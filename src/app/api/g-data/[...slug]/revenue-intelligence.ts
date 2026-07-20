import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

// ---------------------------------------------------------------------------
// Theme keyword map for message intelligence (no theme table needed)
// ---------------------------------------------------------------------------
const THEME_KEYWORDS: Record<string, string[]> = {
  'cloud cost optimization': ['cloud cost', 'cost optimization', 'reduce cloud', 'cloud spend', 'cloud savings'],
  'AI analytics': ['AI analytics', 'machine learning', 'data analytics', 'ML platform', 'AI capability', 'artificial intelligence'],
  'digital transformation': ['digital transformation', 'digital journey', 'modernization', 'legacy migration', 'digital roadmap'],
  'data engineering': ['data platform', 'data engineering', 'data pipeline', 'data lake', 'data infrastructure'],
  'security compliance': ['security', 'compliance', 'GDPR', 'HIPAA', 'SOC 2', 'data protection'],
  'scalability': ['scale', 'scalability', 'growth infrastructure', 'high availability', 'performance'],
  'cloud migration': ['cloud migration', 'move to cloud', 'cloud adoption', 'migrate to', 'cloud transition'],
};

// Signal type human-readable descriptions
const SIGNAL_DESCRIPTIONS: Record<string, string> = {
  funding: 'Funding rounds & investment activity',
  hiring: 'Key hiring & talent acquisition signals',
  leadership_change: 'Executive leadership changes',
  technology: 'Technology adoption & infrastructure changes',
  product: 'Product launches & feature releases',
  acquisition: 'Acquisitions & merger activity',
  regulatory: 'Regulatory compliance & audit signals',
  financial_pressure: 'Financial pressure & restructuring signals',
  news: 'Company news & announcements',
  mention: 'Industry mentions & press coverage',
  partnership: 'Strategic partnerships & alliances',
  expansion: 'Market expansion & geographic growth',
};

// ---------------------------------------------------------------------------
// Period helper
// ---------------------------------------------------------------------------
function getPeriodDate(period: string): Date | null {
  if (period === 'all') return null;
  const days = period === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 86400000);
}

function periodWhere(period: string): { createdAt?: { gte: Date } } {
  const date = getPeriodDate(period);
  if (!date) return {};
  return { createdAt: { gte: date } };
}

// ---------------------------------------------------------------------------
// Theme extraction from draft text
// ---------------------------------------------------------------------------
function extractTheme(subject: string, body: string): string | null {
  const text = `${subject} ${(body || '').substring(0, 200)}`.toLowerCase();
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) return theme;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Safe query wrapper — returns fallback if table doesn't exist yet
// ---------------------------------------------------------------------------
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    // If table doesn't exist, Prisma throws with a known error pattern
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes('no such table') || msg.includes('unknown table')) {
      return fallback;
    }
    throw err; // Re-throw unexpected errors
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '90d';
    const dateFilter = periodWhere(period);

    // ── Parallel data fetches (all wrapped in safeQuery) ──

    const [
      signalsByType,
      opportunityRecs,
      pursuits,
      signalDetails,
      capabilities,
      allDrafts,
      replyEvents,
      evidenceRecords,
    ] = await Promise.all([
      // 1. Signals grouped by signalType (active/validated in period)
      db.companySignal.groupBy({
        by: ['signalType'],
        where: {
          status: { in: ['active', 'validated'] },
          ...dateFilter,
        },
        _count: { id: true },
      }),

      // 2. OpportunityRecommendations in period (may not exist yet)
      safeQuery(
        () => db.opportunityRecommendation.findMany({
          where: dateFilter,
          select: {
            id: true,
            companyId: true,
            signalId: true,
            capabilityMatchId: true,
            opportunityScore: true,
            opportunityTitle: true,
            status: true,
            rejectionReason: true,
            freshnessScore: true,
            recommendedCapability: true,
            createdAt: true,
            signal: {
              select: { signalType: true, title: true },
            },
            capabilityMatch: {
              select: { capabilityId: true },
            },
            company: {
              select: { rawName: true },
            },
          },
        }),
        [],
      ),

      // 3. Pursuits in period (may not exist yet)
      safeQuery(
        () => db.pursuit.findMany({
          where: dateFilter,
          select: {
            id: true,
            opportunityId: true,
            companyId: true,
            outcomeStage: true,
            status: true,
            createdAt: true,
          },
        }),
        [],
      ),

      // 4. All active/validated signals for company-signal mapping
      db.companySignal.findMany({
        where: {
          status: { in: ['active', 'validated'] },
          ...dateFilter,
        },
        select: {
          id: true,
          companyId: true,
          signalType: true,
          title: true,
          sourceUrl: true,
          confidence: true,
          impact: true,
        },
      }),

      // 5. All active capabilities
      db.capabilityAsset.findMany({
        where: { isActive: true },
        select: { id: true, title: true, category: true },
      }),

      // 6. Non-rejected drafts in period for message intelligence
      db.draft.findMany({
        where: {
          status: { not: 'rejected' },
          ...dateFilter,
        },
        select: {
          id: true,
          contactId: true,
          subject: true,
          body: true,
          status: true,
          contact: {
            select: { companyId: true },
          },
        },
      }),

      // 7. Reply events in period
      db.emailEvent.findMany({
        where: {
          eventType: 'reply',
          ...dateFilter,
        },
        select: {
          id: true,
          contactId: true,
          draftId: true,
        },
      }),

      // 8. Evidence records for source effectiveness
      safeQuery(
        () => db.evidence.findMany({
          select: {
            id: true,
            companyId: true,
            sourceUrl: true,
            sourceQualityTier: true,
            status: true,
          },
        }),
        [],
      ),
    ]);

    // ── Build lookup maps ──

    // Signal ID → signalType map
    const signalTypeMap = new Map<string, string>();
    for (const s of signalDetails) {
      signalTypeMap.set(s.id, s.signalType);
    }

    // Signal ID → signal record
    const signalRecordMap = new Map<string, typeof signalDetails[number]>();
    for (const s of signalDetails) {
      signalRecordMap.set(s.id, s);
    }

    // Company ID → company name map
    const companyNameMap = new Map<string, string>();
    for (const rec of opportunityRecs) {
      if (rec.company?.rawName) {
        companyNameMap.set(rec.companyId, rec.company.rawName);
      }
    }

    // Capability ID → capability info map
    const capMap = new Map<string, typeof capabilities[number]>();
    for (const c of capabilities) {
      capMap.set(c.id, c);
    }

    // Opportunity ID → pursuit map
    const pursuitByOppId = new Map<string, typeof pursuits[number]>();
    for (const p of pursuits) {
      pursuitByOppId.set(p.opportunityId, p);
    }

    // Company IDs with pursuits at meeting+ stages (qualification, proposal, negotiation)
    const meetingCompanyIds = new Set<string>();
    for (const p of pursuits) {
      if (['qualification', 'proposal', 'negotiation', 'closed_won'].includes(p.outcomeStage || '')) {
        meetingCompanyIds.add(p.companyId);
      }
    }

    // ── DIMENSION 1: Signal Intelligence ──

    // 1a. By Signal Type Funnel
    const oppRecsBySignalType = new Map<string, typeof opportunityRecs>();
    for (const rec of opportunityRecs) {
      const sigType = rec.signal?.signalType || signalTypeMap.get(rec.signalId) || 'unknown';
      if (!oppRecsBySignalType.has(sigType)) {
        oppRecsBySignalType.set(sigType, []);
      }
      oppRecsBySignalType.get(sigType)!.push(rec);
    }

    // Collect all signal types seen
    const allSignalTypes = new Set<string>();
    for (const s of signalsByType) allSignalTypes.add(s.signalType);
    for (const key of oppRecsBySignalType.keys()) allSignalTypes.add(key);

    const bySignalType = Array.from(allSignalTypes).map((signalType) => {
      const recs = oppRecsBySignalType.get(signalType) || [];
      const signalCount = signalsByType.find((s) => s.signalType === signalType)?._count.id || 0;
      const oppCreated = recs.length;
      const oppAccepted = recs.filter((r) => r.status === 'accepted').length;

      // Qualified conversations: pursuits with outcomeStage in [qualification, proposal, negotiation]
      const qualifiedConvos = recs.filter((r) => {
        const p = pursuitByOppId.get(r.id);
        return p && ['qualification', 'proposal', 'negotiation'].includes(p.outcomeStage || '');
      }).length;

      // Pipeline created: pursuits with outcomeStage in [proposal, negotiation, closed_won]
      const pipelineCreated = recs.filter((r) => {
        const p = pursuitByOppId.get(r.id);
        return p && ['proposal', 'negotiation', 'closed_won'].includes(p.outcomeStage || '');
      }).length;

      // Revenue won: pursuits with outcomeStage = 'closed_won'
      const revenueWon = recs.filter((r) => {
        const p = pursuitByOppId.get(r.id);
        return p && p.outcomeStage === 'closed_won';
      }).length;

      return {
        signalType,
        description: SIGNAL_DESCRIPTIONS[signalType] || `${signalType} signals`,
        funnel: {
          signalsDetected: signalCount,
          opportunitiesCreated: oppCreated,
          opportunitiesAccepted: oppAccepted,
          qualifiedConversations: qualifiedConvos,
          pipelineCreated: pipelineCreated,
          revenueWon: revenueWon,
        },
      };
    }).sort((a, b) => b.funnel.signalsDetected - a.funnel.signalsDetected);

    // 1b. Top Converting Signals
    const topConvertingSignals = opportunityRecs
      .filter((r) => r.status === 'accepted')
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 20)
      .map((r) => {
        const pursuit = pursuitByOppId.get(r.id);
        return {
          signalTitle: r.signal?.title || 'Unknown Signal',
          companyId: r.companyId,
          companyName: r.company?.rawName || 'Unknown',
          signalType: r.signal?.signalType || 'unknown',
          opportunityScore: r.opportunityScore,
          opportunityStatus: r.status,
          pursuitStage: pursuit?.outcomeStage || null,
          engagedAt: r.createdAt?.toISOString().split('T')[0] || null,
        };
      });

    // ── DIMENSION 2: Capability Intelligence ──

    // Group opportunity recommendations by capability (via capabilityMatchId → capabilityId)
    const oppRecsByCapability = new Map<string, typeof opportunityRecs>();
    for (const rec of opportunityRecs) {
      const capId = rec.capabilityMatch?.capabilityId;
      if (!capId) continue;
      if (!oppRecsByCapability.has(capId)) {
        oppRecsByCapability.set(capId, []);
      }
      oppRecsByCapability.get(capId)!.push(rec);
    }

    const byCapability = capabilities
      .filter((cap) => oppRecsByCapability.has(cap.id))
      .map((cap) => {
        const recs = oppRecsByCapability.get(cap.id)!;
        const oppAccepted = recs.filter((r) => r.status === 'accepted').length;
        const oppRejected = recs.filter((r) => r.status === 'rejected');

        // Rejection reason breakdown
        const rejectionReasons: Record<string, number> = {};
        for (const r of oppRejected) {
          const reason = r.rejectionReason || 'OTHER';
          rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
        }

        // Pursuits for this capability's accepted opportunities
        const acceptedIds = new Set(recs.filter((r) => r.status === 'accepted').map((r) => r.id));
        const capPursuits = pursuits.filter((p) => acceptedIds.has(p.opportunityId));
        const pursuitsActive = capPursuits.filter((p) => p.status === 'active').length;
        const pursuitsWon = capPursuits.filter((p) => p.outcomeStage === 'closed_won').length;

        return {
          capabilityId: cap.id,
          capabilityTitle: cap.title,
          category: cap.category,
          opportunitiesCreated: recs.length,
          opportunitiesAccepted: oppAccepted,
          acceptanceRate: recs.length > 0
            ? parseFloat(((oppAccepted / recs.length) * 100).toFixed(1)) / 100
            : 0,
          pursuitsActive,
          pursuitsWon,
          rejectionReasons,
        };
      })
      .sort((a, b) => b.opportunitiesCreated - a.opportunitiesCreated);

    // ── DIMENSION 3: Message Intelligence ──
    const themePerformance = getThemePerformance(allDrafts, replyEvents, meetingCompanyIds);

    // ── DIMENSION 4: Recommendation Effectiveness ──
    const totalRecommended = opportunityRecs.length;
    const totalAccepted = opportunityRecs.filter((r) => r.status === 'accepted').length;
    const totalRejected = opportunityRecs.filter((r) => r.status === 'rejected').length;
    const totalMonitored = opportunityRecs.filter((r) => r.status === 'monitored').length;
    const acceptanceRate = totalRecommended > 0
      ? parseFloat(((totalAccepted / totalRecommended) * 100).toFixed(1))
      : 0;

    // Rejection breakdown
    const rejectionBreakdown: Record<string, number> = {};
    for (const r of opportunityRecs) {
      if (r.status === 'rejected') {
        const reason = r.rejectionReason || 'OTHER';
        rejectionBreakdown[reason] = (rejectionBreakdown[reason] || 0) + 1;
      }
    }

    // Outcome distribution from Pursuit.outcomeStage
    const outcomeByStage: Record<string, number> = {
      discovery: 0,
      qualification: 0,
      proposal: 0,
      negotiation: 0,
      closed_won: 0,
      closed_lost: 0,
    };
    for (const p of pursuits) {
      if (p.outcomeStage && p.outcomeStage in outcomeByStage) {
        outcomeByStage[p.outcomeStage]++;
      }
    }

    // ── DIMENSION 5: Intelligence Quality Metrics ──

    // 5a. Signals generating opportunities
    const signalIdsWithOpps = new Set(opportunityRecs.map((r) => r.signalId));
    const totalActiveSignals = signalDetails.length;
    const withOpportunities = signalDetails.filter((s) => signalIdsWithOpps.has(s.id)).length;
    const conversionRate = totalActiveSignals > 0
      ? parseFloat(((withOpportunities / totalActiveSignals) * 100).toFixed(1))
      : 0;

    // 5b. Evidence source effectiveness
    // Group by evidence source URL, count opportunities created and accepted per source
    // Build evidence source → opportunity mapping via company
    const sourceOpportunities = new Map<string, {
      sourceUrl: string;
      sourceQualityTier: string;
      opportunitiesCreated: number;
      opportunitiesAccepted: number;
    }>();

    for (const rec of opportunityRecs) {
      // Find evidence for this company
      const companyEvidence = evidenceRecords.filter((e) => e.companyId === rec.companyId && e.sourceUrl);
      const seenSources = new Set<string>();
      for (const ev of companyEvidence) {
        if (seenSources.has(ev.sourceUrl)) continue;
        seenSources.add(ev.sourceUrl);

        if (!sourceOpportunities.has(ev.sourceUrl)) {
          sourceOpportunities.set(ev.sourceUrl, {
            sourceUrl: ev.sourceUrl,
            sourceQualityTier: ev.sourceQualityTier,
            opportunitiesCreated: 0,
            opportunitiesAccepted: 0,
          });
        }
        const entry = sourceOpportunities.get(ev.sourceUrl)!;
        entry.opportunitiesCreated++;
        if (rec.status === 'accepted') {
          entry.opportunitiesAccepted++;
        }
      }
    }

    const evidenceSourceEffectiveness = Array.from(sourceOpportunities.values())
      .sort((a, b) => b.opportunitiesCreated - a.opportunitiesCreated)
      .map((entry) => ({
        sourceUrl: entry.sourceUrl,
        sourceQualityTier: entry.sourceQualityTier,
        opportunitiesCreated: entry.opportunitiesCreated,
        opportunitiesAccepted: entry.opportunitiesAccepted,
        acceptanceRate: entry.opportunitiesCreated > 0
          ? parseFloat(((entry.opportunitiesAccepted / entry.opportunitiesCreated) * 100).toFixed(1))
          : 0,
      }));

    // 5c. Freshness impact on acceptance
    const freshRecs = opportunityRecs.filter((r) => r.freshnessScore >= 70 && r.freshnessScore <= 100);
    const agingRecs = opportunityRecs.filter((r) => r.freshnessScore >= 40 && r.freshnessScore < 70);
    const staleRecs = opportunityRecs.filter((r) => r.freshnessScore >= 0 && r.freshnessScore < 40);

    const freshnessBucket = (recs: typeof opportunityRecs) => {
      const total = recs.length;
      const accepted = recs.filter((r) => r.status === 'accepted').length;
      return {
        recommended: total,
        accepted,
        acceptanceRate: total > 0
          ? parseFloat(((accepted / total) * 100).toFixed(1))
          : 0,
      };
    };

    const freshnessImpactOnAcceptance = {
      fresh: freshnessBucket(freshRecs),
      aging: freshnessBucket(agingRecs),
      stale: freshnessBucket(staleRecs),
    };

    return apiSuccess({
      signalIntelligence: {
        bySignalType,
        topConvertingSignals,
      },
      capabilityIntelligence: {
        byCapability,
      },
      messageIntelligence: {
        themePerformance,
      },
      recommendationEffectiveness: {
        totalRecommended,
        totalAccepted,
        totalRejected,
        totalMonitored,
        acceptanceRate,
        rejectionBreakdown,
        outcomeByStage,
      },
      intelligenceQualityMetrics: {
        signalsGeneratingOpportunities: {
          withOpportunities,
          totalActiveSignals,
          conversionRate,
        },
        evidenceSourceEffectiveness,
        freshnessImpactOnAcceptance,
      },
    });
  } catch (err: any) {
    console.error('[revenue-intelligence]', err.message);
    return apiError('Failed to compute revenue intelligence', 500);
  }
}

// ---------------------------------------------------------------------------
// Message Intelligence Helpers
// ---------------------------------------------------------------------------

function getThemePerformance(
  drafts: { id: string; contactId: string; subject: string; body: string; contact: { companyId: string } | null }[],
  replyEvents: { id: string; contactId: string; draftId: string | null }[],
  meetingCompanyIds: Set<string>,
) {
  // Build reply set by draftId
  const repliedDraftIds = new Set<string>();
  for (const evt of replyEvents) {
    if (evt.draftId) repliedDraftIds.add(evt.draftId);
  }

  // Build theme buckets
  const themeData = new Map<string, { totalSent: number; replies: number; meetings: number; repliedContactIds: Set<string> }>();

  for (const draft of drafts) {
    const theme = extractTheme(draft.subject, draft.body);
    if (!theme) continue;

    if (!themeData.has(theme)) {
      themeData.set(theme, { totalSent: 0, replies: 0, meetings: 0, repliedContactIds: new Set() });
    }
    const bucket = themeData.get(theme)!;
    bucket.totalSent++;
    if (repliedDraftIds.has(draft.id)) {
      bucket.replies++;
    }
    // Count meetings: if the contact's company has a pursuit in meeting+ stages
    if (draft.contact?.companyId && meetingCompanyIds.has(draft.contact.companyId)) {
      bucket.meetings++;
    }
  }

  return Array.from(themeData.entries())
    .map(([theme, data]) => ({
      theme,
      totalSent: data.totalSent,
      replies: data.replies,
      replyRate: data.totalSent > 0 ? parseFloat(((data.replies / data.totalSent) * 100).toFixed(1)) : 0,
      meetings: data.meetings,
      meetingRate: data.totalSent > 0 ? parseFloat(((data.meetings / data.totalSent) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.replyRate - a.replyRate);
}