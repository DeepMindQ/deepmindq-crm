import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const plans = await db.conversationPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(plans);
  } catch (error) {
    // If the table doesn't exist yet, return empty array instead of 500
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table')) {
      logger.warn('[conversation-plans GET] Table may not exist, returning empty array');
      return NextResponse.json([]);
    }
    logger.error('[conversation-plans GET]', { error: error });
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { companyName, executiveRole, executiveName, industry, context, capabilities, plan } = body;

    if (!companyName || !executiveRole || !plan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const saved = await db.conversationPlan.create({
      data: {
        companyName,
        executiveRole,
        executiveName: executiveName || null,
        industry: industry || null,
        context: context || null,
        capabilities: capabilities || null,
        plan,
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('table')) {
      logger.warn('[conversation-plans POST] Table may not exist, returning error');
      return NextResponse.json({ error: 'Conversation plans feature is being set up. Please try again shortly.' }, { status: 503 });
    }
    logger.error('[conversation-plans POST]', { error: error });
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}