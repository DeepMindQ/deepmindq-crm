import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/config/scoring
 * POST /api/g-data/config/scoring
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const dimension = url.searchParams.get('dimension');

    const where: any = {};
    if (dimension) where.dimension = dimension;

    const weights = await db.scoringWeight.findMany({
      where,
      orderBy: [{ dimension: 'asc' }, { field: 'asc' }],
    });

    // Group by dimension
    const grouped: Record<string, typeof weights> = {};
    for (const w of weights) {
      if (!grouped[w.dimension]) grouped[w.dimension] = [];
      grouped[w.dimension].push(w);
    }

    return NextResponse.json({ all: weights, grouped });
  } catch (error: any) {
    console.error('[config/scoring GET]', error.message);
    return NextResponse.json({ error: 'Failed to load weights' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dimension, field, key, weight, maxScore, description, isActive } = body;

    if (!dimension || weight === undefined) {
      return NextResponse.json({ error: 'dimension and weight are required' }, { status: 400 });
    }

    const sw = await db.scoringWeight.upsert({
      where: {
        dimension_field_key: {
          dimension,
          field: field || '',
          key: key || '',
        },
      },
      update: { weight, maxScore: maxScore ?? 100, description, isActive: isActive ?? true },
      create: {
        dimension,
        field: field || null,
        key: key || null,
        weight,
        maxScore: maxScore ?? 100,
        description: description || null,
        isActive: isActive ?? true,
      },
    });

    invalidateCache();
    return NextResponse.json(sw);
  } catch (error: any) {
    console.error('[config/scoring POST]', error.message);
    return NextResponse.json({ error: 'Failed to upsert weight', detail: error.message }, { status: 500 });
  }
}