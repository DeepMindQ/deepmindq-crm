import { NextRequest } from 'next/server';
import { apiSuccess, apiError, safeInt, sanitize } from '@/lib/apiHelpers';
import {
  getInboxItems,
  getInboxStats,
  submitToIntelligenceInbox,
} from '@/lib/intelligence-sources/human-intelligence';

/* ═══════════════════════════════════════════════════════════════
   Ticket 10 — Intelligence Inbox API

   GET  /api/g-intel-acquisition/inbox?page=1&limit=20&status=pending&priority=high&search=...
   POST /api/g-intel-acquisition/inbox — submit new human intelligence

   GET  Response: { success, data: { items, stats, pagination }, timestamp }
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

/* ═══════════════════════════════════════════════════════════════
   POST — Submit new human intelligence to the inbox

   Body: {
     companyId: string,       // required — company this intel is about
     submittedBy: string,     // required — userId submitting
     content: string,         // required — the intelligence text
     summary?: string,        // optional short summary
     category?: string,       // optional KnowledgeCategory
     source?: string,         // optional — defaults to "manual"
     sourceUrl?: string,       // optional URL reference
     priority?: string,       // optional — defaults to "normal"
     tags?: string[],          // optional array of string tags
   }

   Response: { success, data: HumanIntelligenceInbox, timestamp }
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, submittedBy, content } = body;

    // Validate required fields
    if (!companyId || typeof companyId !== 'string') {
      return apiError('Missing or invalid "companyId". Must be a non-empty string.', 400);
    }
    if (!submittedBy || typeof submittedBy !== 'string') {
      return apiError('Missing or invalid "submittedBy". Must be a non-empty string.', 400);
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return apiError('Missing or invalid "content". Must be a non-empty string.', 400);
    }

    // Validate optional priority
    const { priority, tags, category, summary, source, sourceUrl } = body;
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return apiError(
        `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`,
        400,
      );
    }

    // Sanitise text fields to prevent stored XSS
    const sanitizedContent = sanitize(content);
    const sanitizedSummary = summary ? sanitize(summary) : undefined;
    const sanitizedSourceUrl = sourceUrl ? sanitize(sourceUrl) : undefined;
    // submittedBy is a userId reference — sanitize to prevent stored XSS
    const sanitizedSubmittedBy = sanitize(submittedBy);

    const created = await submitToIntelligenceInbox({
      companyId,
      submittedBy: sanitizedSubmittedBy,
      content: sanitizedContent,
      summary: sanitizedSummary,
      category: category || undefined,
      source: source || 'manual',
      sourceUrl: sanitizedSourceUrl,
      priority: priority || 'normal',
      tags: Array.isArray(tags) ? tags : undefined,
    });

    return apiSuccess(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit intelligence';
    const status = message.includes('not found') ? 404
      : message.includes('Invalid category') ? 400
      : 500;
    return apiError(message, status);
  }
}
