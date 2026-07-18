import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/config/normalization
 * POST /api/g-data/config/normalization
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    const where: any = {};
    if (category) where.category = category;

    const mappings = await db.normalizationMapping.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sourceValue: 'asc' }],
    });

    // Group by category
    const grouped: Record<string, typeof mappings> = {};
    for (const m of mappings) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    }

    return NextResponse.json({ all: mappings, grouped });
  } catch (error: any) {
    console.error('[config/normalization GET]', error.message);
    return NextResponse.json({ error: 'Failed to load mappings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, sourceValue, normalizedValue, isActive } = body;

    if (!category || !sourceValue || !normalizedValue) {
      return NextResponse.json({ error: 'category, sourceValue, and normalizedValue are required' }, { status: 400 });
    }

    const mapping = await db.normalizationMapping.upsert({
      where: { category_sourceValue: { category, sourceValue } },
      update: { normalizedValue, isActive: isActive ?? true },
      create: { category, sourceValue, normalizedValue, isActive: isActive ?? true },
    });

    invalidateCache();
    return NextResponse.json(mapping);
  } catch (error: any) {
    console.error('[config/normalization POST]', error.message);
    return NextResponse.json({ error: 'Failed to upsert mapping', detail: error.message }, { status: 500 });
  }
}