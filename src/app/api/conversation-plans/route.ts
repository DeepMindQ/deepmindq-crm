import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const plans = await db.conversationPlan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(plans);
  } catch (error) {
    console.error('[conversation-plans GET]', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
        plan, // JSON object stored as Json type
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('[conversation-plans POST]', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}