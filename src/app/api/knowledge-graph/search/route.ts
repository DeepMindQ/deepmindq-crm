import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { resolveEntity } from '@/lib/intelligence/knowledge-graph';

const searchSchema = z.object({
  query: z.string().min(2),
  type: z.enum(['organization', 'person', 'all']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = searchSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { query, type, limit } = parsed.data;

    // resolveEntity searches by name (with fuzzy matching), domain, and email.
    // It does not natively support type filtering or limit, so we apply those here.
    const allResults = await resolveEntity({ name: query, fuzzy: true });

    let filtered = allResults;
    if (type !== 'all') {
      filtered = allResults.filter((m) => m.nodeType === type);
    }

    return NextResponse.json({
      success: true,
      data: filtered.slice(0, limit),
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 });
  }
}
