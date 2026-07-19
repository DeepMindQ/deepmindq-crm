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
  technology: 'Tech stack changes & cloud migrations',
  funding: 'Funding rounds & investment activity',
  hiring: 'Key hiring & talent acquisition signals',
  leadership_change: 'Executive leadership changes',
  tech_change: 'Technology adoption & infrastructure changes',
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
// GET handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '90d';
    const dateFilter = periodWhere(period);

    // ── Parallel data fetches ──

    // 1. Signals grouped by signalType (active/validated in period)
    const [signalsByType, capabilityMatches, allDrafts, replyEvents, meetingCompanies, pipelineCompanies] =
      await Promise.all([
        // Signals by type
        db.companySignal.groupBy({
          by: ['signalType'],
          where: {
            status: { in: ['active', 'validated'] },
            ...dateFilter,
          },
          _count: { id: true },
          _sum: { confidence: true },
        }),

        // Capability matches in period with signal info
        db.signalCapabilityMatch.findMany({
          where: dateFilter,
          select: {
            companyId: true,
            signalId: true,
            capabilityId: true,
            matchScore: true,
            createdAt: true,
            signal: {
              select: { signalType: true, title: true },
            },
          },
        }),

        // Non-rejected drafts in period for engagement counting
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
            sequenceId: true,
            sequenceStepId: true,
            contact: {
              select: { companyId: true },
            },
          },
        }),

        // Reply events in period
        db.emailEvent.findMany({
          where: {
            eventType: 'reply',
            ...dateFilter,
          },
          select: {
            id: true,
            contactId: true,
            draftId: true,
            contact: {
              select: { companyId: true },
            },
          },
        }),

        // Meeting-stage companies (proposal/negotiation)
        db.company.findMany({
          where: {
            lifecycleStage: { in: ['proposal', 'negotiation'] },
          },
          select: { id: true },
        }),

        // Pipeline-stage companies (negotiation/closed)
        db.company.findMany({
          where: {
            lifecycleStage: { in: ['negotiation', 'closed'] },
          },
          select: { id: true },
        }),
      ]);

    // ── Build company sets for each signal type ──
    // For each signal type, collect the set of company IDs that have that signal type
    const companySignalsByType = await db.companySignal.groupBy({
      by: ['companyId', 'signalType'],
      where: {
        status: { in: ['active', 'validated'] },
        ...dateFilter,
      },
    });

    const companiesBySignalType = new Map<string, Set<string>>();
    for (const row of companySignalsByType) {
      if (!companiesBySignalType.has(row.signalType)) {
        companiesBySignalType.set(row.signalType, new Set());
      }
      companiesBySignalType.get(row.signalType)!.add(row.companyId);
    }

    // ── Build company-level metric sets ──
    const engagedCompanyIds = new Set<string>();
    const draftByContactId = new Map<string, { subject: string; body: string; id: string }>();

    for (const draft of allDrafts) {
      if (draft.contact?.companyId) {
        engagedCompanyIds.add(draft.contact.companyId);
      }
      draftByContactId.set(draft.contactId, { subject: draft.subject, body: draft.body, id: draft.id });
    }

    const repliedCompanyIds = new Set<string>();
    for (const evt of replyEvents) {
      if (evt.contact?.companyId) {
        repliedCompanyIds.add(evt.contact.companyId);
      }
    }

    const meetingCompanyIds = new Set(meetingCompanies.map((c) => c.id));
    const pipelineCompanyIds = new Set(pipelineCompanies.map((c) => c.id));

    // ── Capability match counts by signal type ──
    const capMatchBySignalType = new Map<string, number>();
    for (const match of capabilityMatches) {
      const sigType = match.signal?.signalType;
      if (sigType) {
        capMatchBySignalType.set(sigType, (capMatchBySignalType.get(sigType) || 0) + 1);
      }
    }

    // ── Dimension 1: Signal Intelligence Funnel ──
    const allSignalTypes = new Set<string>();
    for (const s of signalsByType) allSignalTypes.add(s.signalType);
    for (const key of companiesBySignalType.keys()) allSignalTypes.add(key);
    for (const key of capMatchBySignalType.keys()) allSignalTypes.add(key);

    const signalTypeDescriptions: Record<string, string> = { ...SIGNAL_DESCRIPTIONS };

    const bySignalType = Array.from(allSignalTypes).map((signalType) => {
      const companies = companiesBySignalType.get(signalType) || new Set<string>();
      return {
        signalType,
        description: signalTypeDescriptions[signalType] || `${signalType} signals`,
        funnel: {
          signalsDetected: signalsByType.find((s) => s.signalType === signalType)?._count.id || 0,
          capabilityMatched: capMatchBySignalType.get(signalType) || 0,
          engaged: countIntersection(companies, engagedCompanyIds),
          replied: countIntersection(companies, repliedCompanyIds),
          meetings: countIntersection(companies, meetingCompanyIds),
          pipeline: countIntersection(companies, pipelineCompanyIds),
        },
      };
    }).sort((a, b) => b.funnel.signalsDetected - a.funnel.signalsDetected);

    // ── Top Converting Signals ──
    const topConvertingSignals = await getTopConvertingSignals(dateFilter);

    // ── Dimension 2: Capability Intelligence ──
    const byCapability = await getCapabilityIntelligence(capabilityMatches, engagedCompanyIds, repliedCompanyIds, meetingCompanyIds);

    // ── Dimension 3: Message Intelligence ──
    const themePerformance = getThemePerformance(allDrafts, replyEvents);

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
    });
  } catch (err: any) {
    console.error('[revenue-intelligence]', err.message);
    return apiError('Failed to compute revenue intelligence', 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countIntersection(setA: Set<string>, setB: Set<string>): number {
  let count = 0;
  for (const id of setA) {
    if (setB.has(id)) count++;
  }
  return count;
}

async function getTopConvertingSignals(dateFilter: Record<string, unknown>) {
  // Find signals from companies that progressed to negotiation or closed stages
  const topCompanies = await db.company.findMany({
    where: {
      lifecycleStage: { in: ['negotiation', 'closed'] },
    },
    select: { id: true, rawName: true, lifecycleStage: true },
    take: 50,
  });

  const topCompanyIds = new Set(topCompanies.map((c) => c.id));

  if (topCompanyIds.size === 0) return [];

  const topMatches = await db.signalCapabilityMatch.findMany({
    where: {
      companyId: { in: Array.from(topCompanyIds) },
      ...dateFilter,
    },
    include: {
      signal: {
        select: { signalType: true, title: true, confidence: true },
      },
    },
    orderBy: { matchScore: 'desc' },
    take: 20,
  });

  const companyMap = new Map(topCompanies.map((c) => [c.id, c]));

  return topMatches.map((m) => {
    const company = companyMap.get(m.companyId);
    return {
      signalTitle: m.signal?.title || 'Unknown Signal',
      companyId: m.companyId,
      companyName: company?.rawName || 'Unknown',
      signalType: m.signal?.signalType || 'unknown',
      matchScore: m.matchScore,
      engagedAt: m.createdAt?.toISOString().split('T')[0] || null,
      currentStage: company?.lifecycleStage || 'discovery',
      revenuePotential: null,
    };
  });
}

async function getCapabilityIntelligence(
  capabilityMatches: { companyId: string; capabilityId: string; matchScore: number }[],
  engagedCompanyIds: Set<string>,
  repliedCompanyIds: Set<string>,
  meetingCompanyIds: Set<string>,
) {
  // Get all active capabilities
  const capabilities = await db.capabilityAsset.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true },
  });

  // Build company sets per capability
  const companiesByCap = new Map<string, Set<string>>();
  for (const m of capabilityMatches) {
    if (!companiesByCap.has(m.capabilityId)) {
      companiesByCap.set(m.capabilityId, new Set());
    }
    companiesByCap.get(m.capabilityId)!.add(m.companyId);
  }

  // Get closed_won company IDs
  const closedWonCompanies = await db.company.findMany({
    where: { status: 'closed_won' },
    select: { id: true },
  });
  const closedWonIds = new Set(closedWonCompanies.map((c) => c.id));

  // Get meeting-stage companies for this capability context
  const meetingStageCompanies = await db.company.findMany({
    where: {
      lifecycleStage: { in: ['proposal', 'negotiation', 'closed'] },
    },
    select: { id: true },
  });
  const meetingStageIds = new Set(meetingStageCompanies.map((c) => c.id));

  return capabilities.map((cap) => {
    const capCompanies = companiesByCap.get(cap.id) || new Set<string>();
    return {
      capabilityId: cap.id,
      capabilityTitle: cap.title,
      category: cap.category,
      companiesDetected: capCompanies.size,
      engagements: countIntersection(capCompanies, engagedCompanyIds),
      replies: countIntersection(capCompanies, repliedCompanyIds),
      meetings: countIntersection(capCompanies, meetingStageIds),
      deals: countIntersection(capCompanies, closedWonIds),
    };
  }).sort((a, b) => b.companiesDetected - a.companiesDetected);
}

function getThemePerformance(
  drafts: { id: string; contactId: string; subject: string; body: string; status: string }[],
  replyEvents: { id: string; contactId: string; draftId: string | null }[],
) {
  // Build reply set by draftId
  const repliedDraftIds = new Set<string>();
  for (const evt of replyEvents) {
    if (evt.draftId) repliedDraftIds.add(evt.draftId);
  }

  // Build theme buckets
  const themeData = new Map<string, { totalSent: number; replies: number; repliedContactIds: Set<string> }>();

  for (const draft of drafts) {
    const theme = extractTheme(draft.subject, draft.body);
    if (!theme) continue;

    if (!themeData.has(theme)) {
      themeData.set(theme, { totalSent: 0, replies: 0, repliedContactIds: new Set() });
    }
    const bucket = themeData.get(theme)!;
    bucket.totalSent++;
    if (repliedDraftIds.has(draft.id)) {
      bucket.replies++;
    }
  }

  // For meetings, we count themes where the contact's company reached meeting stage
  // We approximate: any theme that has replies is a proxy for meetings at this level
  return Array.from(themeData.entries())
    .map(([theme, data]) => ({
      theme,
      totalSent: data.totalSent,
      replies: data.replies,
      replyRate: data.totalSent > 0 ? parseFloat(((data.replies / data.totalSent) * 100).toFixed(1)) : 0,
      meetings: 0, // Would need company lifecycle join; showing 0 as conservative estimate
      meetingRate: 0,
    }))
    .sort((a, b) => b.replyRate - a.replyRate);
}