import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';

/* ═══════════════════════════════════════════════════
   GET — List drafts with optional status filter
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const where: Prisma.DraftWhereInput = {};
    if (status) {
      where.status = status;
    }

    const drafts = await db.draft.findMany({
      where,
      include: {
        contact: {
          include: { company: { include: { researchCard: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Drafts GET error:', error);
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — AI-Generate a draft for a contact
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactId } = body;

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    // 1. Fetch contact + company + research
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      include: {
        company: { include: { researchCard: true } },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const company = contact.company;
    const research = company?.researchCard;

    // 2. Fetch relevant capability assets
    const capabilities = await db.capabilityAsset.findMany({
      where: { isActive: true },
    });

    // 3. Pick the most relevant capabilities based on company industry + contact role
    const industry = company?.industry?.toLowerCase() || '';
    const role = contact.role?.toLowerCase() || '';
    const title = contact.title?.toLowerCase() || '';

    const scored = capabilities.map(cap => {
      let score = 0;
      const capIndustries = (cap.targetIndustries || '').toLowerCase();
      const capRoles = (cap.targetRoles || '').toLowerCase();
      const capKeywords = (cap.summary || '').toLowerCase() + ' ' + (cap.title || '').toLowerCase();

      // Industry match
      if (industry && capIndustries.includes(industry)) score += 10;
      // Role match
      if (role && capRoles.includes(role)) score += 8;
      if (title && capKeywords.includes(role)) score += 5;
      // Category bonus
      if (cap.category === 'service_line') score += 3;
      if (cap.category === 'case_study') score += 2;
      if (cap.category === 'proof_point') score += 2;
      if (cap.category === 'objection') score += 1;

      return { ...cap, relevanceScore: score };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topCapabilities = scored.slice(0, 4);

    // 4. Build the AI prompt
    const capabilityContext = topCapabilities
      .filter(c => c.relevanceScore > 0)
      .map(c => `[${c.category}] ${c.title}: ${c.summary}`)
      .join('\n');

    const researchContext = research
      ? [
          research.businessOverview && `Business: ${research.businessOverview}`,
          research.potentialChallenges && `Challenges: ${research.potentialChallenges}`,
          research.possibleOpportunities && `Opportunities: ${research.possibleOpportunities}`,
          research.relevantServices && `Relevant Services: ${research.relevantServices}`,
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const systemPrompt = `You are an expert B2B sales email writer for DeepMindQ, a technology services company. 
Write a personalized, concise outbound email (under 150 words) that:
- Opens with a specific, relevant observation about the prospect's company or role
- Naturally connects to a DeepMindQ capability (ONLY use the provided capability library — never invent services)
- Ends with a soft, low-friction call-to-action (ask for a brief call, not a sale)
- Sounds human, not AI-generated — no buzzwords like "delve", "leverage", "synergy", "revolutionize"
- Is professional but conversational
- NEVER mention pricing or make unsubstantiated claims

You MUST respond with valid JSON in this exact format (no markdown, no code fences):
{"subject": "email subject line", "body": "email body text", "cta": "call to action text", "confidence_score": 75, "assumptions": ["any assumptions made"]}`;

    const userPrompt = `Write a personalized outreach email for this prospect:

**Contact:** ${contact.rawName || 'Unknown'}
**Title:** ${contact.title || 'Unknown'}
**Company:** ${company?.rawName || 'Unknown'}
**Industry:** ${company?.industry || 'Unknown'}
**Company Size:** ${company?.sizeRange || 'Unknown'}

${researchContext ? `**Company Research:**\n${researchContext}` : ''}

${capabilityContext ? `**Relevant DeepMindQ Capabilities:**\n${capabilityContext}` : 'No specific capability matches found — write a general introductory email.'}

Write the email now. Respond with JSON only.`;

    // 5. Call AI
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    let aiResponse = completion.choices[0]?.message?.content || '';

    // 6. Parse AI response — handle markdown code fences
    aiResponse = aiResponse.trim();
    if (aiResponse.startsWith('```')) {
      aiResponse = aiResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: { subject: string; body: string; cta: string; confidence_score: number; assumptions?: string[] };
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      // Fallback: try to extract subject and body from unstructured response
      const lines = aiResponse.split('\n').filter(Boolean);
      parsed = {
        subject: lines[0]?.replace(/^subject:\s*/i, '').slice(0, 100) || 'Introduction to DeepMindQ',
        body: lines.slice(1).join('\n').slice(0, 1000) || aiResponse,
        cta: 'Would you be open to a brief 15-minute call this week?',
        confidence_score: 50,
        assumptions: ['AI response was not valid JSON — content may need review'],
      };
    }

    // 7. Save draft to DB
    const draft = await db.draft.create({
      data: {
        contactId: contact.id,
        subject: parsed.subject || 'Draft email',
        body: parsed.body || '',
        cta: parsed.cta || '',
        confidenceScore: Math.min(100, Math.max(0, parsed.confidence_score || 50)),
        sourceSnippetsUsed: JSON.stringify(
          topCapabilities.filter(c => c.relevanceScore > 0).map(c => ({
            id: c.id,
            title: c.title,
            content: c.summary,
            snippetType: c.category,
          }))
        ),
        assumptionFlags: JSON.stringify(
          (parsed.assumptions || []).map((a: string, i: number) => ({
            id: `af-${i}`,
            assumption: a,
            confidence: 'Medium',
          }))
        ),
        status: 'pending_review',
      },
    });

    // 8. Update contact status
    await db.contact.update({
      where: { id: contact.id },
      data: { status: 'drafted' },
    });

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        subject: draft.subject,
        body: draft.body,
        cta: draft.cta,
        confidenceScore: draft.confidenceScore,
        status: draft.status,
        sourceSnippets: JSON.parse(draft.sourceSnippetsUsed || '[]'),
        assumptionFlags: JSON.parse(draft.assumptionFlags || '[]'),
        contact: {
          id: contact.id,
          rawName: contact.rawName,
          email: contact.email,
          title: contact.title,
          role: contact.role,
          company: company
            ? {
                id: company.id,
                rawName: company.rawName,
                industry: company.industry,
                researchCard: research
                  ? {
                      businessOverview: research.businessOverview,
                      relevantServices: research.relevantServices,
                    }
                  : null,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Draft generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PATCH — Approve or reject a draft
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, subject, body: emailBody, cta, rejectReason } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status,
      reviewedAt: new Date(),
    };

    if (status === 'rejected' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }

    // Allow editing during approval
    if (subject !== undefined) updateData.subject = subject;
    if (emailBody !== undefined) updateData.body = emailBody;
    if (cta !== undefined) updateData.cta = cta;

    const draft = await db.draft.update({
      where: { id },
      data: updateData,
    });

    // If approved, create a queue item and update contact status
    if (status === 'approved') {
      await db.sendQueue.create({
        data: {
          draftId: draft.id,
          status: 'pending',
          scheduledAt: new Date(),
        },
      });

      await db.contact.update({
        where: { id: draft.contactId },
        data: { status: 'queued' },
      });
    }

    if (status === 'rejected') {
      await db.contact.update({
        where: { id: draft.contactId },
        data: { status: 'cleaned' },
      });
    }

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('Draft PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}