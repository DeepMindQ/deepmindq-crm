import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/config/validation-rules
 * POST /api/g-data/config/validation-rules
 */
export async function GET() {
  try {
    const rules = await db.fieldValidationRule.findMany({
      orderBy: [{ priority: 'desc' }, { targetField: 'asc' }],
    });
    return NextResponse.json(rules);
  } catch (error: any) {
    console.error('[config/validation-rules GET]', error.message);
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, targetField, ruleType, config, severity, message, priority, isActive } = body;

    if (!name || !targetField || !ruleType || !message) {
      return NextResponse.json({ error: 'name, targetField, ruleType, and message are required' }, { status: 400 });
    }

    const validTypes = ['required', 'regex', 'format', 'range', 'uniqueness', 'custom'];
    if (!validTypes.includes(ruleType)) {
      return NextResponse.json({ error: `ruleType must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const rule = await db.fieldValidationRule.create({
      data: {
        name, targetField, ruleType,
        config: typeof config === 'object' ? JSON.stringify(config) : (config || '{}'),
        severity: severity || 'error',
        message,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
    });

    invalidateCache();
    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    console.error('[config/validation-rules POST]', error.message);
    return NextResponse.json({ error: 'Failed to create rule', detail: error.message }, { status: 500 });
  }
}