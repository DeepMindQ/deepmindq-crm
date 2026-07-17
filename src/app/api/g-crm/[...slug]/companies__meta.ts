import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/apiHelpers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const MAX_FILTER_OPTIONS = 200;

    const [industries, countries] = await Promise.all([
      db.company.findMany({
        where: { status: { not: "archived" }, industry: { not: null } },
        distinct: ["industry"],
        select: { industry: true },
        orderBy: { industry: "asc" },
        take: MAX_FILTER_OPTIONS,
      }),
      db.company.findMany({
        where: { status: { not: "archived" }, country: { not: null } },
        distinct: ["country"],
        select: { country: true },
        orderBy: { country: "asc" },
        take: MAX_FILTER_OPTIONS,
      }),
    ]);

    return apiSuccess({
      industries: industries.map((i) => i.industry).filter(Boolean) as string[],
      countries: countries.map((c) => c.country).filter(Boolean) as string[],
    });
  } catch (error) {
    console.error("Failed to fetch filter metadata:", error);
    return apiError("Failed to fetch filter metadata", 500);
  }
}

/* ═══════════════════════════════════════════════════
   POST — One-time data cleanup operations (#27, #28)
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action: string };

    if (action === 'cleanupSizeRange') {
      // Fix all garbage sizeRange values across entire DB (#27)
      const VALID_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1,000', '1,001-5,000', '5,001-10,000', '10,001+'];

      // Map garbage patterns to valid ranges using a single bulk query approach
      // First, get distinct garbage values and their counts
      const allCompanies = await db.company.findMany({
        where: { sizeRange: { not: null, notIn: VALID_RANGES } },
        select: { id: true, sizeRange: true },
      });

      // Group by mapped range, then batch update
      const rangeMap = new Map<string, string[]>();
      for (const row of allCompanies) {
        const sr = (row as any).sizeRange as string;
        const num = parseInt(sr.replace(/[^0-9]/g, ''), 10);
        let mapped: string | null = null;
        if (!isNaN(num)) {
          if (num <= 10) mapped = '1-10';
          else if (num <= 50) mapped = '11-50';
          else if (num <= 200) mapped = '51-200';
          else if (num <= 500) mapped = '201-500';
          else if (num <= 1000) mapped = '501-1,000';
          else if (num <= 5000) mapped = '1,001-5,000';
          else if (num <= 10000) mapped = '5,001-10,000';
          else mapped = '10,001+';
        }
        if (mapped) {
          const ids = rangeMap.get(mapped) || [];
          ids.push(row.id);
          rangeMap.set(mapped, ids);
        }
      }

      let cleaned = 0;
      // Batch update each range group (max 100 IDs per query for safety)
      for (const [range, ids] of rangeMap) {
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await db.company.updateMany({
            where: { id: { in: batch } },
            data: { sizeRange: range },
          });
          cleaned += batch.length;
        }
      }

      return NextResponse.json({ success: true, action: 'cleanupSizeRange', totalGarbage: allCompanies.length, cleaned });
    }

    if (action === 'cleanupBrokenEnrichment') {
      // Delete research cards with empty/null businessOverview and re-flag for enrichment (#28)
      const broken = await db.companyResearchCard.findMany({
        where: {
          OR: [
            { businessOverview: null },
            { businessOverview: '' },
            { businessOverview: { contains: 'operates in the' } },
          ],
        },
        select: { id: true, companyId: true },
      });

      if (broken.length > 0) {
        await db.companyResearchCard.deleteMany({
          where: { id: { in: broken.map((r) => r.id) } },
        });
        // Reset intelligenceScore for re-calculation on next enrichment
        await db.company.updateMany({
          where: { id: { in: broken.map((r) => r.companyId) } },
          data: { intelligenceScore: 0 },
        });
      }

      return NextResponse.json({ success: true, action: 'cleanupBrokenEnrichment', deletedCards: broken.length });
    }

    return NextResponse.json({ error: 'Unknown action. Valid: cleanupSizeRange, cleanupBrokenEnrichment' }, { status: 400 });
  } catch (error) {
    console.error('Meta cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}