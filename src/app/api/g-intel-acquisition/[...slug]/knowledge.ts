// GET /api/g-intel-acquisition/knowledge?companyId=xxx          → get company knowledge (grouped)
// GET /api/g-intel-acquisition/knowledge/search?companyId=xxx&keyword=yyy → search knowledge

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyKnowledge, searchKnowledge } from '@/lib/intelligence-sources';

// ─── GET knowledge (grouped by category) ──────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const companyId = id || searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId query parameter is required' },
      { status: 400 },
    );
  }

  try {
    if (id === 'search') {
      // ── GET /knowledge/search ──
      const keyword = searchParams.get('keyword');
      if (!keyword) {
        return NextResponse.json(
          { error: 'keyword query parameter is required for search' },
          { status: 400 },
        );
      }

      const results = await searchKnowledge(companyId, keyword);
      return NextResponse.json({
        companyId,
        keyword,
        results,
        count: results.length,
      });
    }

    // ── GET /knowledge?companyId=xxx ──
    const { entries, grouped } = await getCompanyKnowledge(companyId);
    return NextResponse.json({
      companyId,
      totalEntries: entries.length,
      grouped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Knowledge query failed';
    console.error('[g-intel-acquisition:knowledge]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}