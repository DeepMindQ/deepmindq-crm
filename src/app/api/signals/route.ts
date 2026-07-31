import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import type { SignalType, SignalSeverity, SignalStatus, SignalMeaningCategory } from '@prisma/client';

/* ═══════════════════════════════════════════════════════════════
   Ticket 8 — Signal Intelligence Screen API

   Contract (per ARCHITECTURE.md):
   GET /api/signals?companyId={id}&type=funding&severity=high&status=active&page=1
   Response: {
     signals: CompanySignal[],
     evidenceCounts: Record<string, number>,
     categories: SignalMeaningCategory[]
   }
   ═══════════════════════════════════════════════════════════════ */

const VALID_TYPES: string[] = [
  'funding', 'hiring', 'leadership_change', 'leadership', 'tech_change',
  'technology', 'news', 'mention', 'partnership', 'expansion',
  'people_change', 'internal_memory',
];
const VALID_SEVERITIES: string[] = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES: string[] = ['detected', 'validated', 'active', 'aging', 'expired', 'archived'];

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    /* ── Parse query params ── */
    const companyId = searchParams.get('companyId') || undefined;
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const meaningCategory = searchParams.get('meaningCategory');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    /* ── Build Prisma where clause ── */
    const where: Record<string, unknown> = {};

    if (companyId) where.companyId = companyId;
    if (type && VALID_TYPES.includes(type)) where.signalType = type as SignalType;
    if (severity && VALID_SEVERITIES.includes(severity)) where.severity = severity as SignalSeverity;
    if (status && VALID_STATUSES.includes(status)) where.status = status as SignalStatus;
    if (meaningCategory) where.meaningCategory = meaningCategory as SignalMeaningCategory;

    /* ── Fetch signals with company + capability matches ── */
    const [signals, total, categoriesRaw, evidenceCountsRaw] = await Promise.all([
      // Signals paginated
      db.companySignal.findMany({
        where,
        include: {
          company: {
            select: { id: true, normalizedName: true, website: true },
          },
          signalCapabilityMatches: {
            include: {
              capability: {
                select: { id: true, title: true, category: true },
              },
            },
            take: 5,
            orderBy: { matchScore: 'desc' },
          },
        },
        orderBy: [
          { severity: 'desc' },
          { confidence: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),

      // Total count
      db.companySignal.count({ where }),

      // Distinct meaning categories present in result set
      db.companySignal.findMany({
        where,
        select: { meaningCategory: true },
        distinct: ['meaningCategory'],
      }),

      // Evidence counts per signal (from evidenceIds JSON array)
      db.companySignal.findMany({
        where,
        select: { id: true, evidenceIds: true },
      }),
    ]);

    /* ── Build evidenceCounts map ── */
    const evidenceCounts: Record<string, number> = {};
    for (const s of evidenceCountsRaw) {
      let count = 0;
      try {
        const ids = typeof s.evidenceIds === 'string'
          ? JSON.parse(s.evidenceIds)
          : s.evidenceIds;
        if (Array.isArray(ids)) count = ids.length;
      } catch { /* skip malformed JSON */ }
      evidenceCounts[s.id] = count;
    }

    /* ── Build categories list ── */
    const categories: string[] = categoriesRaw
      .map(c => c.meaningCategory)
      .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined);

    return apiSuccess({
      signals,
      evidenceCounts,
      categories,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch signals';
    return apiError(message, 500);
  }
}
