import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateEmailDraft } from '@/lib/email-generation';
import { generateMessageId } from '@/lib/email-tracking';

/* ═══════════════════════════════════════════════════
   GET /api/ab-tests
   List A/B tests with variant stats
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    const tests = await db.aBTest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        drafts: {
          include: {
            queueItem: { select: { id: true, openCount: true, clickCount: true, status: true } },
          },
        },
      },
    });

    const enriched = tests.map(test => {
      const variantStats: Record<string, { sends: number; opens: number; clicks: number; openRate: number; clickRate: number }> = {};
      let totalSends = 0;

      for (const draft of test.drafts) {
        const label = draft.variantLabel || 'unknown';
        const qi = draft.queueItem;
        const sends = qi && qi.status === 'sent' ? 1 : 0;
        const opens = qi?.openCount || 0;
        const clicks = qi?.clickCount || 0;

        if (!variantStats[label]) {
          variantStats[label] = { sends: 0, opens: 0, clicks: 0, openRate: 0, clickRate: 0 };
        }
        variantStats[label].sends += sends;
        variantStats[label].opens += opens;
        variantStats[label].clicks += clicks;
        totalSends += sends;
      }

      for (const stat of Object.values(variantStats)) {
        stat.openRate = stat.sends > 0 ? Math.round((stat.opens / stat.sends) * 100) : 0;
        stat.clickRate = stat.sends > 0 ? Math.round((stat.clicks / stat.sends) * 100) : 0;
      }

      return {
        id: test.id,
        name: test.name,
        status: test.status,
        winnerVariant: test.winnerVariant,
        totalSends,
        variantStats,
        variantCount: test.drafts.length,
        createdAt: test.createdAt,
        completedAt: test.completedAt,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('AB Tests GET error:', error);
    return NextResponse.json([]);
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/ab-tests
   Create an A/B test with AI-generated subject line variants

   Body: { name, contactIds, serviceLine, tone? }
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, contactIds, serviceLine, tone = 'professional' } = body;

    if (!name || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'name and contactIds are required' }, { status: 400 });
    }

    // Create the ABTest record
    const abTest = await db.aBTest.create({
      data: { name, status: 'running' },
    });

    // Generate 3 subject line variants using AI for the first contact
    const firstContact = await db.contact.findUnique({
      where: { id: contactIds[0] },
      include: { company: true },
    });

    const contactInfo = firstContact
      ? {
          name: firstContact.rawName,
          company: firstContact.company?.rawName,
          industry: firstContact.company?.industry,
        }
      : { name: 'Prospect' };

    const variants: { label: string; subject: string }[] = [];
    const variantLabels = ['variant_a', 'variant_b', 'control'];

    // Generate base email, then create variant subject lines
    const baseDraft = await generateEmailDraft({
      ...contactInfo,
      tone,
      serviceLine,
    });

    // Use AI to generate 3 subject line variants
    let ZAI: any;
    try {
      ZAI = (await import('z-ai-web-dev-sdk')).default;
      const { ensureZaiConfig } = await import('@/lib/zai-config');
      await ensureZaiConfig();
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an email subject line expert for B2B outreach. Generate 3 different subject line variants for an A/B test.

The email body topic: "${baseDraft.body.slice(0, 200)}..."
Company: ${contactInfo.company || 'Unknown'}
Industry: ${contactInfo.industry || 'Unknown'}

Generate 3 subject lines with different strategies:
- variant_a: Curiosity/gap driven (create information gap)
- variant_b: Value/result driven (highlight specific outcome)
- control: Direct/standard professional approach

Keep each subject line under 60 characters. Respond with JSON only: {"variant_a": "...", "variant_b": "...", "control": "..."}`,
          },
        ],
        thinking: { type: 'disabled' },
      });

      let aiText = completion.choices[0]?.message?.content || '';
      aiText = aiText.trim();
      if (aiText.startsWith('```')) {
        aiText = aiText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(aiText);
      for (const label of variantLabels) {
        if (parsed[label]) {
          variants.push({ label, subject: parsed[label].slice(0, 100) });
        }
      }
    } catch {
      // Fallback: use AI-generated subject + two manual variants
      variants.push(
        { label: 'variant_a', subject: baseDraft.subject },
        { label: 'variant_b', subject: `Quick question about ${contactInfo.company || 'your team'}` },
        { label: 'control', subject: `DeepMindQ — ${serviceLine || 'Technology Services'} for ${contactInfo.company || 'your company'}` },
      );
    }

    // Create a Draft for each contact × variant combination
    const createdDrafts = [];
    for (const contactId of contactIds) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      });

      if (!contact) continue;

      const contactDraft = await generateEmailDraft({
        name: contact.rawName,
        email: contact.email,
        title: contact.title || undefined,
        company: contact.company?.rawName || undefined,
        industry: contact.company?.industry || undefined,
        tone,
        serviceLine,
      });

      // Assign a random variant to each contact
      const variant = variants[Math.floor(Math.random() * variants.length)];

      const draft = await db.draft.create({
        data: {
          contactId: contact.id,
          subject: variant.subject,
          body: contactDraft.body,
          cta: contactDraft.cta,
          confidenceScore: contactDraft.confidenceScore,
          status: 'pending_review',
          variantLabel: variant.label,
          abTestId: abTest.id,
          messageId: generateMessageId(),
          sourceSnippetsUsed: JSON.stringify(contactDraft.sourceSnippets || []),
          assumptionFlags: JSON.stringify(
            (contactDraft.assumptions || []).map((a: string, i: number) => ({
              id: `af-${i}`,
              assumption: a,
              confidence: 'Medium',
            }))
          ),
        },
      });
      createdDrafts.push(draft);
    }

    // Update total sends count
    await db.aBTest.update({
      where: { id: abTest.id },
      data: { totalSends: createdDrafts.length },
    });

    return NextResponse.json({
      success: true,
      test: {
        id: abTest.id,
        name: abTest.name,
        status: abTest.status,
        totalSends: createdDrafts.length,
        variants: variants.map(v => ({ label: v.label, subject: v.subject })),
        drafts: createdDrafts.map(d => ({ id: d.id, contactId: d.contactId, variantLabel: d.variantLabel })),
      },
    });
  } catch (error) {
    console.error('AB Test POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create A/B test: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PATCH /api/ab-tests
   Complete a test and declare winner

   Body: { id, action: "complete" }
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || action !== 'complete') {
      return NextResponse.json({ error: 'id and action:"complete" are required' }, { status: 400 });
    }

    // Fetch test with drafts and queue items
    const test = await db.aBTest.findUnique({
      where: { id },
      include: {
        drafts: {
          include: {
            queueItem: { select: { id: true, openCount: true, clickCount: true, status: true } },
          },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Calculate open rates per variant
    const variantStats: Record<string, { sends: number; opens: number; clicks: number }> = {};

    for (const draft of test.drafts) {
      const label = draft.variantLabel || 'unknown';
      const qi = draft.queueItem;
      const sends = qi && qi.status === 'sent' ? 1 : 0;

      if (!variantStats[label]) {
        variantStats[label] = { sends: 0, opens: 0, clicks: 0 };
      }
      variantStats[label].sends += sends;
      variantStats[label].opens += qi?.openCount || 0;
      variantStats[label].clicks += qi?.clickCount || 0;
    }

    // Find winner by highest open rate
    let bestVariant = 'control';
    let bestRate = 0;

    for (const [label, stats] of Object.entries(variantStats)) {
      const rate = stats.sends > 0 ? stats.opens / stats.sends : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestVariant = label;
      }
    }

    const updated = await db.aBTest.update({
      where: { id },
      data: {
        status: 'completed',
        winnerVariant: bestVariant,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      test: { ...updated, variantStats },
    });
  } catch (error) {
    console.error('AB Test PATCH error:', error);
    return NextResponse.json({ error: 'Failed to complete test' }, { status: 500 });
  }
}