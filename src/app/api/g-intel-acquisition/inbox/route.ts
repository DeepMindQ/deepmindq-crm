import { NextRequest } from 'next/server';
import { apiSuccess, apiError, safeInt } from '@/lib/apiHelpers';
import { getInboxItems, getInboxStats } from '@/lib/intelligence-sources/human-intelligence';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox List API

   GET /api/g-intel-acquisition/inbox?page=1&limit=20&status=pending&priority=high&search=...
   POST /api/g-intel-acquisition/inbox — submit new human intelligence

   GET Response: { success, data: { items, stats, pagination }, timestamp }
   POST Response: { success, data: HumanIntelligenceInbox, timestamp }
   ═══════════════════════════════════════════════════════════════ */

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'converted'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, safeInt(searchParams.get('page'), 1, 1));
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20, 1)));
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const companyId = searchParams.get('companyId');
    const search = searchParams.get('search');

    // Validate filter values
    const filters: Record<string, unknown> = { page, limit };
    if (status && VALID_STATUSES.includes(status)) filters.status = status;
    if (priority && VALID_PRIORITIES.includes(priority)) filters.priority = priority;
    if (companyId) filters.companyId = companyId;
    if (search && search.trim()) filters.search = search.trim();

    const [result, stats] = await Promise.all([
      getInboxItems(filters as any),
      getInboxStats(),
    ]);

    return apiSuccess({
      items: result.items,
      stats,
      pagination: {
        page,
        pageSize: limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inbox items';
    return apiError(message, 500);
  }
}
