import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { generateEmailDraft } from '@/lib/email-generation';

/* ═══════════════════════════════════════════════════
   Direct API config — no SDK needed.
   Falls back to template-based generation if the
   internal API is unreachable (e.g. on Vercel).
   ═══════════════════════════════════════════════════ */
const ZAI_CONFIG = {
  baseUrl: 'https://internal-api.z.ai/v1',
  apiKey: 'Z.ai',
  chatId: 'chat-bcc95057-6e3d-4891-9d71-30debaafe997',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYTRkNTAxNWItY2VmMS00N2M0LTkwNDEtMzVhYWZkZTk4MGMwIiwiY2hhdF9pZCI6ImNoYXQtYmNjOTUwNTctNmUzZC00ODkxLTlkNzEtMzBkZWJhYWZlOTk3IiwicGxhdGZvcm0iOiJ6YWkifQ.OcGXf_gxSR6l_aqYzCqOAuZA-GDFKkOVfU65Z8giCso',
  userId: 'a4d5015b-cef1-47c4-9041-35aafde980c0',
};

/* ═══════════════════════════════════════════════════
   Demo drafts — shown when no real DB data exists
   ═══════════════════════════════════════════════════ */
const DEMO_DRAFTS = [
  {
    id: 'demo-d1', contactId: 'demo-2', subject: 'AI-Powered Transformation at Salesforce', status: 'pending_review', confidenceScore: 82,
    body: 'Hi Michael,\n\nWith Salesforce\'s recent expansion into AI-driven analytics, I noticed your team is pushing the boundaries of what CRM platforms can do. Many CTOs in the enterprise SaaS space are facing the same challenge: scaling AI infrastructure without slowing down product velocity.\n\nDeepMindQ recently helped a Fortune 500 financial services company reduce their AI model processing time by 85% through purpose-built MLOps pipelines. The approach is directly applicable to high-throughput SaaS environments like yours.',
    cta: 'Would you be open to a brief 15-minute call this week?',
    sourceSnippetsUsed: '[{"id":"s1","title":"AI & Machine Learning","content":"End-to-end ML pipeline development","snippetType":"service_line"},{"id":"s2","title":"Fortune 500 Document Automation","content":"Reduced processing time by 85%","snippetType":"case_study"}]',
    assumptionFlags: '[{"id":"a1","assumption":"Salesforce is investing in AI capabilities","confidence":"High"}]',
    createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString(),
    contact: { id: 'demo-2', rawName: 'Michael Torres', email: 'm.torres@salesforce.com', title: 'Chief Technology Officer', role: 'executive', company: { id: 'demo-c2', rawName: 'Salesforce', normalizedName: 'salesforce', industry: 'Technology', domain: 'salesforce.com', researchCard: null } },
  },
  {
    id: 'demo-d2', contactId: 'demo-5', subject: 'Digital Health Infrastructure for Apollo Hospitals', status: 'approved', confidenceScore: 88,
    body: 'Hi Aisha,\n\nApollo Hospitals has been at the forefront of healthcare digitization in India. As CIO, you\'re likely navigating the complex intersection of patient data security, AI-driven diagnostics, and regulatory compliance.\n\nDeepMindQ has helped healthcare organizations build HIPAA-compliant data platforms and deploy AI diagnostic tools that reduced radiology report turnaround by 60%. Our healthcare-specific expertise could accelerate your digital roadmap significantly.',
    cta: 'Could we schedule a 20-minute call to discuss your 2026 digital priorities?',
    sourceSnippetsUsed: '[{"id":"s1","title":"Data Engineering","content":"Enterprise data platform design","snippetType":"service_line"},{"id":"s3","title":"Healthcare Platform Migration","content":"99.99% uptime for healthcare platform","snippetType":"case_study"}]',
    assumptionFlags: '[{"id":"a1","assumption":"Apollo is expanding digital health capabilities","confidence":"High"}]',
    createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date().toISOString(),
    contact: { id: 'demo-5', rawName: 'Aisha Patel', email: 'aisha.p@apollohospital.com', title: 'Chief Information Officer', role: 'executive', company: { id: 'demo-c5', rawName: 'Apollo Hospitals', normalizedName: 'apollo hospitals', industry: 'Healthcare', domain: 'apollohospital.com', researchCard: null } },
  },
  {
    id: 'demo-d3', contactId: 'demo-10', subject: 'Cloud-Native Manufacturing at Siemens', status: 'pending_review', confidenceScore: 79,
    body: 'Hi Robert,\n\nSiemens\' commitment to Industry 4.0 is well documented. As you drive digital transformation across manufacturing operations, the challenge of modernizing legacy SCADA and MES systems while maintaining 24/7 production uptime is critical.\n\nDeepMindQ recently helped a manufacturing client migrate 200+ microservices to a cloud-native architecture while achieving zero-downtime cutover — a challenge very similar to what Siemens faces with its factory automation platforms.',
    cta: 'Would a brief call this week work to explore parallels with your transformation roadmap?',
    sourceSnippetsUsed: '[{"id":"s1","title":"Cloud Engineering","content":"Multi-cloud architecture design","snippetType":"service_line"},{"id":"s4","title":"Digital Transformation","content":"Legacy system modernization","snippetType":"service_line"}]',
    assumptionFlags: '[{"id":"a1","assumption":"Siemens is modernizing factory automation systems","confidence":"Medium"}]',
    createdAt: new Date(Date.now() - 14400000).toISOString(), updatedAt: new Date().toISOString(),
    contact: { id: 'demo-10', rawName: 'Robert Fischer', email: 'r.fischer@siemens.com', title: 'Chief Digital Officer', role: 'executive', company: { id: 'demo-c10', rawName: 'Siemens AG', normalizedName: 'siemens ag', industry: 'Manufacturing', domain: 'siemens.com', researchCard: null } },
  },
];

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

    // If no real data, return demo drafts
    if (drafts.length === 0) {
      let filtered = DEMO_DRAFTS;
      if (status) filtered = filtered.filter(d => d.status === status);
      return NextResponse.json(filtered);
    }

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Drafts GET error:', error);
    let filtered = DEMO_DRAFTS;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    if (status) filtered = filtered.filter(d => d.status === status);
    return NextResponse.json(filtered);
  }
}

/* ── Derive a role category from job title ── */
function deriveRole(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('chief executive') || t.includes('ceo')) return 'executive';
  if (t.includes('chief technology') || t.includes('cto')) return 'executive';
  if (t.includes('chief information') || t.includes('cio')) return 'executive';
  if (t.includes('chief operating') || t.includes('coo')) return 'executive';
  if (t.includes('chief financial') || t.includes('cfo')) return 'executive';
  if (t.includes('chief digital') || t.includes('cdo')) return 'executive';
  if (t.includes('chief') || t.includes('vp') || t.includes('vice president')) return 'vp';
  if (t.includes('director') || t.includes('head')) return 'director';
  if (t.includes('manager') || t.includes('lead')) return 'manager';
  if (t.includes('architect') || t.includes('engineer') || t.includes('developer')) return 'individual_contributor';
  if (t.includes('analyst') || t.includes('specialist')) return 'individual_contributor';
  return 'other';
}

/* ═══════════════════════════════════════════════════
   POST — AI-Generate a draft for a contact

   Two modes:
   1. contactId: Look up contact from DB (existing flow)
   2. prospect fields (name, email, title, company, industry, etc.):
      Generate email directly using /api/ai/generate logic,
      create a virtual contact + company in DB, save draft.
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactId } = body;

    // ── Mode 2: Direct prospect generation (no contactId) ──
    if (!contactId) {
      const { name, email, title, company, industry, companySize, tone, problems, serviceLine } = body;
      if (!name) {
        return NextResponse.json({ error: 'contactId or name is required' }, { status: 400 });
      }

      // Generate email using shared logic (no HTTP self-call)
      const draftData = await generateEmailDraft({
        name,
        email,
        title,
        company,
        industry,
        companySize,
        tone: tone || 'professional',
        problems,
        serviceLine,
        searchMode: 'hybrid',
        minScore: 15,
      });

      // Create or find company + contact in DB for record-keeping
      let companyId = `lead-co-${Date.now()}`;
      let contactIdResult = `lead-ct-${Date.now()}`;

      try {
        // Try to create company
        const domain = email ? email.split('@')[1] : null;
        const existingCompany = domain
          ? await db.company.findFirst({ where: { domain } })
          : null;

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const newCompany = await db.company.create({
            data: {
              rawName: company || 'Unknown',
              normalizedName: (company || 'unknown').toLowerCase(),
              domain,
              industry: industry || null,
              sizeRange: companySize || null,
            },
          });
          companyId = newCompany.id;
        }

        // Try to create contact
        const existingContact = email
          ? await db.contact.findFirst({ where: { email } })
          : null;

        if (existingContact) {
          contactIdResult = existingContact.id;
        } else {
          const newContact = await db.contact.create({
            data: {
              rawName: name,
              normalizedName: name.toLowerCase(),
              email: email || 'unknown@example.com',
              title: title || null,
              role: title ? deriveRole(title) : null,
              companyId,
              batchId: 'lead-gen',
              status: 'drafted',
              emailHealth: email ? 'valid' : 'unknown',
            },
          });
          contactIdResult = newContact.id;
        }
      } catch (dbErr) {
        console.log('DB contact creation skipped (demo mode):', dbErr instanceof Error ? dbErr.message : '');
        // Continue with virtual IDs — draft will still be saved
      }

      // Save draft to DB
      let savedDraft: Record<string, unknown> | null = null;
      try {
        savedDraft = await db.draft.create({
          data: {
            contactId: contactIdResult,
            subject: draftData.subject || 'Draft email',
            body: draftData.body || '',
            cta: draftData.cta || '',
            confidenceScore: draftData.confidenceScore || 50,
            sourceSnippetsUsed: JSON.stringify(draftData.sourceSnippets || []),
            assumptionFlags: JSON.stringify(
              (draftData.assumptions || []).map((a: string, i: number) => ({
                id: `af-${i}`,
                assumption: a,
                confidence: 'Medium',
              }))
            ),
            status: 'pending_review',
          },
        }) as Record<string, unknown>;
      } catch {
        // Fallback: return generated draft without DB save
      }

      return NextResponse.json({
        success: true,
        draft: {
          id: (savedDraft as any)?.id || `draft-${Date.now()}`,
          subject: draftData.subject,
          body: draftData.body,
          cta: draftData.cta,
          confidenceScore: draftData.confidenceScore,
          status: 'pending_review',
          generationMethod: draftData.generationMethod || 'ai',
          generatedAt: draftData.generatedAt,
          sourceSnippets: draftData.sourceSnippets || [],
          assumptionFlags: (draftData.assumptions || []).map((a: string, i: number) => ({
            id: `af-${i}`,
            assumption: a,
            confidence: 'Medium',
          })),
          contact: {
            id: contactIdResult,
            rawName: name,
            email: email || '',
            title: title || '',
            role: title ? deriveRole(title) : '',
            company: company ? {
              id: companyId,
              rawName: company,
              industry: industry || '',
              normalizedName: (company || '').toLowerCase(),
              domain: email ? email.split('@')[1] : '',
              researchCard: null,
            } : null,
          },
        },
      });
    }

    // ── Mode 1: Existing contactId-based generation ──
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
      .join('\n') || 'No specific capability matches found — write a general introductory email.';

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

**Relevant DeepMindQ Capabilities:**
${capabilityContext}

Write the email now. Respond with JSON only.`;

    // 5. Try direct API call first, fall back to template
    let aiResponse = '';
    let usedAI = false;

    try {
      const response = await fetch(`${ZAI_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZAI_CONFIG.token}`,
          'x-api-key': ZAI_CONFIG.apiKey,
        },
        body: JSON.stringify({
          model: 'default',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices?.[0]?.message?.content || '';
        if (aiResponse.trim()) {
          usedAI = true;
        }
      }
    } catch (fetchError) {
      console.log('Direct AI API call failed, using template fallback:', fetchError instanceof Error ? fetchError.message : 'Unknown');
    }

    // 6. Parse AI response — handle markdown code fences
    let parsed: { subject: string; body: string; cta: string; confidence_score: number; assumptions?: string[] };

    if (usedAI && aiResponse) {
      aiResponse = aiResponse.trim();
      if (aiResponse.startsWith('```')) {
        aiResponse = aiResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

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
    } else {
      // Template-based fallback
      parsed = generateTemplateDraftForContact({
        name: contact.rawName || 'Unknown',
        title: contact.title,
        company: company?.rawName,
        industry: company?.industry,
        companySize: company?.sizeRange,
        researchContext,
        topCapabilities,
      });
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
        generationMethod: usedAI ? 'ai' : 'template',
        ...(usedAI ? { generatedAt: new Date().toISOString() } : {}),
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

/* ═══════════════════════════════════════════════════
   Template-based draft generator for contact-based
   generation. Uses DB capabilities + research context.
   ═══════════════════════════════════════════════════ */
function generateTemplateDraftForContact(params: {
  name: string;
  title?: string | null;
  company?: string | null;
  industry?: string | null;
  companySize?: string | null;
  researchContext: string;
  topCapabilities: Array<{ id: string; title: string; summary: string; category: string; relevanceScore: number }>;
}): { subject: string; body: string; cta: string; confidence_score: number; assumptions: string[] } {
  const { name, title, company, industry, researchContext, topCapabilities } = params;
  const personName = name.split(' ')[0] || 'there';
  const companyName = company || 'your company';
  const industryLabel = industry || '';
  const jobTitle = title || '';

  // Pick the top relevant capability
  const relevantCap = topCapabilities.find(c => c.relevanceScore > 0) || { title: 'our technology solutions', summary: 'enterprise-grade AI and cloud solutions' };

  // Industry-specific case study mapping
  const caseStudyMap: Record<string, string> = {
    'financial services': 'reduced processing time by 85% for a Fortune 500 financial services company',
    'finance': 'reduced processing time by 85% for a Fortune 500 financial services company',
    'banking': 'built a real-time fraud detection system processing 2M+ transactions per minute',
    'healthcare': 'helped a healthcare platform achieve 99.99% uptime with HIPAA-compliant architecture',
    'manufacturing': 'migrated 200+ microservices to cloud-native architecture with zero-downtime cutover',
    'technology': 'helped a SaaS company achieve 3x ROI within 12 months through ML pipeline optimization',
    'saas': 'achieved 3x ROI within 12 months through AI and cloud infrastructure modernization',
    'retail': 'built a real-time analytics platform processing 50M+ events daily for personalized recommendations',
    'ecommerce': 'built a real-time analytics platform processing 50M+ events daily for personalized recommendations',
  };

  const industryLower = industryLabel.toLowerCase();
  const matchedCase = Object.entries(caseStudyMap).find(([key]) =>
    industryLower.includes(key) || key.includes(industryLower)
  );

  const caseStudy = matchedCase?.[1] || relevantCap.summary;

  // Research-aware opening
  let opening = '';
  if (researchContext) {
    opening = `I've been researching ${companyName}'s recent developments${industryLabel ? ` in the ${industryLabel} space` : ''}, and your team's direction caught my attention.`;
  } else {
    opening = `${companyName}'s trajectory${industryLabel ? ` in the ${industryLabel} market` : ''} caught my attention — particularly the way your team is approaching digital transformation.`;
  }

  // Role-aware middle
  const roleLower = jobTitle.toLowerCase();
  let roleAngle = '';
  if (roleLower.includes('cto') || roleLower.includes('chief technology')) {
    roleAngle = `As someone leading the technology vision at ${companyName}, you're likely weighing infrastructure decisions that will scale for years.`;
  } else if (roleLower.includes('cio') || roleLower.includes('chief information')) {
    roleAngle = `As CIO, you're navigating the intersection of innovation and operational stability.`;
  } else if (roleLower.includes('ceo') || roleLower.includes('chief executive')) {
    roleAngle = `At your level, the right technology partnership can unlock growth without diverting your team's focus.`;
  } else if (roleLower.includes('vp') || roleLower.includes('director') || roleLower.includes('head')) {
    roleAngle = `Teams in your position often find that the right technology partner can accelerate initiatives that otherwise stall internally.`;
  }

  const bodyParts = [
    `Hi ${personName},`,
    '',
    opening,
    '',
    roleAngle ? `${roleAngle}` : '',
    roleAngle ? '' : '',
    `DeepMindQ recently ${caseStudy}. ${relevantCap.summary}.`,
    '',
    `I'd love to share a relevant case study that might spark some ideas for your team.`,
    '',
    'Best regards',
  ].filter(Boolean);

  const assumptions: string[] = [];
  if (company) assumptions.push(`Assumed ${personName} is involved in technology decisions at ${companyName}`);
  if (industry) assumptions.push(`Assumed ${companyName} faces challenges common in the ${industry} sector`);
  if (title) assumptions.push(`Assumed ${personName}'s role (${title}) involves evaluating technology solutions`);
  if (researchContext) assumptions.push('Draft incorporates company research context');
  assumptions.push('Template-generated — specific pain points should be validated in conversation');

  return {
    subject: `${companyName}'s next step${industryLabel ? ' in ' + industryLabel : ''}`,
    body: bodyParts.join('\n'),
    cta: 'Would you be open to a brief 15-minute call this week to explore whether this is relevant?',
    confidence_score: (company && industry && researchContext) ? 72 : (company && industry) ? 65 : 55,
    assumptions,
  };
}