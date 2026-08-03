import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import type { SignalType, SignalSeverity, SignalStatus, SignalMeaningCategory } from '@prisma/client';
import { checkApiAuth } from '@/lib/api-auth';

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
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

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
        take: 1000,
      }),

      // Evidence counts per signal (from evidenceIds JSON array)
      db.companySignal.findMany({
        where,
        select: { id: true, evidenceIds: true },
        take: 1000,
      }),
    ]);

    /* ── Build evidenceCounts: count actual resolvable Evidence records ── */
    // Collect all evidence IDs across all signals in this result set
    const allEvidenceIds: string[] = [];
    const signalEvidenceIdsMap: Record<string, string[]> = {};
    for (const s of evidenceCountsRaw) {
      let ids: string[] = [];
      try {
        const raw = typeof s.evidenceIds === 'string'
          ? JSON.parse(s.evidenceIds)
          : s.evidenceIds;
        if (Array.isArray(raw)) {
          ids = raw.filter((eid: unknown) => typeof eid === 'string' && eid.length > 0);
        }
      } catch { /* skip malformed JSON */ }
      signalEvidenceIdsMap[s.id] = ids;
      allEvidenceIds.push(...ids);
    }

    // Batch-resolve: count Evidence records that actually exist in DB
    const existingEvidenceIds = new Set<string>();
    if (allEvidenceIds.length > 0) {
      const uniqueIds = [...new Set(allEvidenceIds)];
      const existingRecords = await db.evidence.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      for (const rec of existingRecords) {
        existingEvidenceIds.add(rec.id);
      }
    }

    const evidenceCounts: Record<string, number> = {};
    for (const [signalId, ids] of Object.entries(signalEvidenceIdsMap)) {
      evidenceCounts[signalId] = ids.filter(eid => existingEvidenceIds.has(eid)).length;
    }

    /* ── Build categories list with correct type ── */
    const categories: SignalMeaningCategory[] = categoriesRaw
      .map(c => c.meaningCategory)
      .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined) as SignalMeaningCategory[];

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
