import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   POST /api/leads/lookalike — Find leads similar to
   a set of reference leads using pattern extraction.
   ═══════════════════════════════════════════════════ */

function extractCountry(location: string | null | undefined): string {
  if (!location) return 'Unknown';
  const parts = location.split(',').map(s => s.trim());
  // Last part is usually the country
  const candidate = parts[parts.length - 1].toUpperCase();
  return candidate;
}

function getMostCommon<T>(items: T[], topN = 5): T[] {
  if (items.length === 0) return [];
  const freq = new Map<T, number>();
  for (const item of items) {
    if (item == null || (typeof item === 'string' && item.trim() === '')) continue;
    freq.set(item, (freq.get(item) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([val]) => val);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactIds, limit, minScore } = body as {
      contactIds: string[];
      limit?: number;
      minScore?: number;
    };

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds array is required with at least one ID' },
        { status: 400 },
      );
    }

    // ── 1. Fetch reference contacts with company data ───────────
    const references = await db.contact.findMany({
      where: { id: { in: contactIds } },
      include: { company: true },
    });

    if (references.length === 0) {
      return NextResponse.json({ query: null, results: [], totalFound: 0 });
    }

    // ── 2. Extract common patterns from reference leads ─────────
    const industries = references
      .map(r => r.company?.industry)
      .filter(Boolean) as string[];

    const roles = references
      .map(r => r.role)
      .filter(Boolean) as string[];

    const sizeRanges = references
      .map(r => r.company?.sizeRange)
      .filter(Boolean) as string[];

    const countries = references
      .map(r => extractCountry(r.location))
      .filter(c => c !== 'Unknown');

    const scores = references
      .map(r => r.leadScore)
      .filter(s => s > 0);

    // ── 3. Build similarity profile ─────────────────────────────
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 50;

    const profile = {
      industries: getMostCommon(industries, 10),
      roles: getMostCommon(roles, 10),
      sizeRanges: getMostCommon(sizeRanges, 5),
      countries: getMostCommon(countries, 10),
      targetScoreThreshold: Math.round(avgScore * 0.7),
    };

    // ── 4. Search for matching UNDRAFTED, UNQUEUED contacts ─────
    const whereClause: any = {
      id: { notIn: contactIds },
      status: { in: ['imported', 'cleaned'] },
      leadScore: { gte: profile.targetScoreThreshold },
    };

    // Only add optional filters if we have data
    if (profile.industries.length > 0) {
      whereClause.company = {
        ...(whereClause.company || {}),
        industry: { in: profile.industries },
      };
    }
    if (profile.roles.length > 0) {
      whereClause.role = { in: profile.roles };
    }

    const take = Math.min(limit || 20, 100);

    const candidates = await db.contact.findMany({
      where: whereClause,
      include: { company: true },
      orderBy: { leadScore: 'desc' },
      take,
    });

    // ── 5. Calculate matchScore for each candidate ──────────────
    const maxScore = 100;

    const results = candidates.map(contact => {
      const matchedAttributes: string[] = [];
      let score = 0;

      // Industry match: +25
      const contactIndustry = contact.company?.industry;
      if (contactIndustry && profile.industries.includes(contactIndustry)) {
        score += 25;
        matchedAttributes.push('industry');
      }

      // Role match: +25
      if (contact.role && profile.roles.includes(contact.role)) {
        score += 25;
        matchedAttributes.push('role');
      }

      // Size match: +20
      const contactSize = contact.company?.sizeRange;
      if (contactSize && profile.sizeRanges.length > 0 && profile.sizeRanges.includes(contactSize)) {
        score += 20;
        matchedAttributes.push('company_size');
      }

      // Country match: +15
      const contactCountry = extractCountry(contact.location);
      if (contactCountry !== 'Unknown' && profile.countries.includes(contactCountry)) {
        score += 15;
        matchedAttributes.push('country');
      }

      // Score proximity: +15 (how close to the average score)
      if (scores.length > 0) {
        const maxPossibleScore = 100;
        const proximity = 1 - Math.abs(contact.leadScore - avgScore) / maxPossibleScore;
        score += Math.round(proximity * 15);
        if (proximity > 0.5) matchedAttributes.push('score_proximity');
      }

      return {
        contact,
        matchScore: Math.min(score, maxScore),
        matchedAttributes,
      };
    });

    // Sort by matchScore descending
    results.sort((a, b) => b.matchScore - a.matchScore);

    // ── 6. Return ───────────────────────────────────────────────
    return NextResponse.json({
      query: profile,
      results,
      totalFound: results.length,
    });
  } catch (error) {
    console.error('Lookalike discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to find lookalike leads' },
      { status: 500 },
    );
  }
}