import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/config/column-rules — List all column mapping rules
 * POST /api/g-data/config/column-rules — Create a new rule
 */
export async function GET() {
  try {
    const rules = await db.columnMappingRule.findMany({
      orderBy: [{ priority: 'desc' }, { targetField: 'asc' }],
    });
    return NextResponse.json(rules);
  } catch (error: any) {
    console.error('[config/column-rules GET]', error.message);
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, pattern, targetField, priority, isActive } = body;

    if (!name || !pattern || !targetField) {
      return NextResponse.json({ error: 'name, pattern, and targetField are required' }, { status: 400 });
    }

    // Validate regex
    try { new RegExp(pattern, 'i'); } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }

    const rule = await db.columnMappingRule.create({
      data: {
        name, pattern, targetField,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
    });

    invalidateCache();
    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    console.error('[config/column-rules POST]', error.message);
    return NextResponse.json({ error: 'Failed to create rule', detail: error.message }, { status: 500 });
  }
}