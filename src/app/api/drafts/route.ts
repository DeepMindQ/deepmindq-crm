import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { generateEmailDraft } from '@/lib/email-generation';
import { generateMessageId, signQueueId } from '@/lib/email-tracking';

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
    messageId: '<demo-d1@deepmindq.com>',
    inReplyTo: null,
    references: null,
    variantLabel: null,
    abTestId: null,
    sequenceId: null,
    sequenceStepId: null,
    createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString(),
    contact: { id: 'demo-2', rawName: 'Michael Torres', email: 'm.torres@salesforce.com', title: 'Chief Technology Officer', role: 'executive', company: { id: 'demo-c2', rawName: 'Salesforce', normalizedName: 'salesforce', industry: 'Technology', domain: 'salesforce.com', researchCard: null } },
  },
  {
    id: 'demo-d2', contactId: 'demo-5', subject: 'Digital Health Infrastructure for Apollo Hospitals', status: 'approved', confidenceScore: 88,
    body: 'Hi Aisha,\n\nApollo Hospitals has been at the forefront of healthcare digitization in India. As CIO, you\'re likely navigating the complex intersection of patient data security, AI-driven diagnostics, and regulatory compliance.\n\nDeepMindQ has helped healthcare organizations build HIPAA-compliant data platforms and deploy AI diagnostic tools that reduced radiology report turnaround by 60%. Our healthcare-specific expertise could accelerate your digital roadmap significantly.',
    cta: 'Could we schedule a 20-minute call to discuss your 2026 digital priorities?',
    sourceSnippetsUsed: '[{"id":"s1","title":"Data Engineering","content":"Enterprise data platform design","snippetType":"service_line"},{"id":"s3","title":"Healthcare Platform Migration","content":"99.99% uptime for healthcare platform","snippetType":"case_study"}]',
    assumptionFlags: '[{"id":"a1","assumption":"Apollo is expanding digital health capabilities","confidence":"High"}]',
    messageId: '<demo-d2@deepmindq.com>',
    inReplyTo: null,
    references: null,
    variantLabel: null,
    abTestId: null,
    sequenceId: null,
    sequenceStepId: null,
    createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date().toISOString(),
    contact: { id: 'demo-5', rawName: 'Aisha Patel', email: 'aisha.p@apollohospital.com', title: 'Chief Information Officer', role: 'executive', company: { id: 'demo-c5', rawName: 'Apollo Hospitals', normalizedName: 'apollo hospitals', industry: 'Healthcare', domain: 'apollohospital.com', researchCard: null } },
  },
  {
    id: 'demo-d3', contactId: 'demo-10', subject: 'Cloud-Native Manufacturing at Siemens', status: 'pending_review', confidenceScore: 79,
    body: 'Hi Robert,\n\nSiemens\' commitment to Industry 4.0 is well documented. As you drive digital transformation across manufacturing operations, the challenge of modernizing legacy SCADA and MES systems while maintaining 24/7 production uptime is critical.\n\nDeepMindQ recently helped a manufacturing client migrate 200+ microservices to a cloud-native architecture while achieving zero-downtime cutover — a challenge very similar to what Siemens faces with its factory automation platforms.',
    cta: 'Would a brief call this week work to explore parallels with your transformation roadmap?',
    sourceSnippetsUsed: '[{"id":"s1","title":"Cloud Engineering","content":"Multi-cloud architecture design","snippetType":"service_line"},{"id":"s4","title":"Digital Transformation","content":"Legacy system modernization","snippetType":"service_line"}]',
    assumptionFlags: '[{"id":"a1","assumption":"Siemens is modernizing factory automation systems","confidence":"Medium"}]',
    messageId: '<demo-d3@deepmindq.com>',
    inReplyTo: null,
    references: null,
    variantLabel: null,
    abTestId: null,
    sequenceId: null,
    sequenceStepId: null,
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
   1. contactId: Look up contact from DB, use shared generateEmailDraft
   2. prospect fields (name, email, title, company, industry, etc.):
      Generate email directly, create a virtual contact + company in DB, save draft.

   E-06: Sets messageId on draft. Optionally sets inReplyTo/references
         if inReplyToDraftId is provided (follow-up).
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contactId, inReplyToDraftId } = body;

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

      // E-06: Compute thread headers
      let messageId = generateMessageId();
      let inReplyTo: string | null = null;
      let references: string[] = [];

      if (inReplyToDraftId) {
        try {
          const parentDraft = await db.draft.findUnique({ where: { id: inReplyToDraftId } });
          if (parentDraft) {
            inReplyTo = parentDraft.messageId || null;
            const parentRefs: string[] = parentDraft.references ? JSON.parse(parentDraft.references) : [];
            references = [...parentRefs, parentDraft.messageId || inReplyToDraftId].filter(Boolean);
          }
        } catch { /* parent not found — proceed without thread */ }
      }

      // Create or find company + contact in DB for record-keeping
      let companyId = `lead-co-${Date.now()}`;
      let contactIdResult = `lead-ct-${Date.now()}`;

      try {
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
            messageId,
            inReplyTo,
            references: references.length > 0 ? JSON.stringify(references) : null,
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
          messageId,
          inReplyTo,
          references,
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

    // Use the shared generateEmailDraft (E-13: deduplicated)
    const draftData = await generateEmailDraft({
      name: contact.rawName || 'Unknown',
      email: contact.email,
      title: contact.title || undefined,
      company: company?.rawName || undefined,
      industry: company?.industry || undefined,
      companySize: company?.sizeRange || undefined,
      tone: body.tone || 'professional',
      additionalContext: body.additionalContext,
      serviceLine: body.serviceLine,
      problems: body.problems,
    });

    // E-06: Compute thread headers
    let messageId = generateMessageId();
    let inReplyTo: string | null = null;
    let references: string[] = [];

    if (inReplyToDraftId) {
      try {
        const parentDraft = await db.draft.findUnique({ where: { id: inReplyToDraftId } });
        if (parentDraft) {
          inReplyTo = parentDraft.messageId || null;
          const parentRefs: string[] = parentDraft.references ? JSON.parse(parentDraft.references) : [];
          references = [...parentRefs, parentDraft.messageId || inReplyToDraftId].filter(Boolean);
        }
      } catch { /* parent not found */ }
    }

    // Save draft to DB
    const draft = await db.draft.create({
      data: {
        contactId: contact.id,
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
        messageId,
        inReplyTo,
        references: references.length > 0 ? JSON.stringify(references) : null,
      },
    });

    // Update contact status
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
        generationMethod: draftData.generationMethod || 'ai',
        generatedAt: draftData.generatedAt,
        messageId,
        inReplyTo,
        references,
        sourceSnippets: draftData.sourceSnippets || [],
        assumptionFlags: (draftData.assumptions || []).map((a: string, i: number) => ({
          id: `af-${i}`,
          assumption: a,
          confidence: 'Medium',
        })),
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
                researchCard: company.researchCard
                  ? {
                      businessOverview: company.researchCard.businessOverview,
                      relevantServices: company.researchCard.relevantServices,
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
   PATCH — Single draft update OR bulk operations (E-12)

   Single: { id, status, subject, body, cta, rejectReason }
   Bulk:   { ids: string[], action: "approve" | "reject" | "regenerate" | "delete" }
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // ── E-12: Bulk operations ──
    if (body.ids && Array.isArray(body.ids) && body.action) {
      const { ids, action } = body;
      if (ids.length === 0) {
        return NextResponse.json({ error: 'ids array is empty' }, { status: 400 });
      }

      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const draftId of ids) {
        try {
          switch (action) {
            case 'approve': {
              const draft = await db.draft.update({
                where: { id: draftId },
                data: { status: 'approved' },
              });
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
              results.push({ id: draftId, success: true });
              break;
            }
            case 'reject': {
              const draft = await db.draft.update({
                where: { id: draftId },
                data: { status: 'rejected', rejectReason: 'Bulk rejected' },
              });
              await db.contact.update({
                where: { id: draft.contactId },
                data: { status: 'cleaned' },
              });
              results.push({ id: draftId, success: true });
              break;
            }
            case 'regenerate': {
              const existingDraft = await db.draft.findUnique({
                where: { id: draftId },
                include: {
                  contact: { include: { company: true } },
                },
              });
              if (!existingDraft) {
                results.push({ id: draftId, success: false, error: 'Draft not found' });
                break;
              }
              const contact = existingDraft.contact;
              const company = contact.company;
              const draftData = await generateEmailDraft({
                name: contact.rawName || 'Unknown',
                email: contact.email,
                title: contact.title || undefined,
                company: company?.rawName || undefined,
                industry: company?.industry || undefined,
                companySize: company?.sizeRange || undefined,
              });
              await db.draft.update({
                where: { id: draftId },
                data: {
                  subject: draftData.subject || 'Draft email',
                  body: draftData.body || '',
                  cta: draftData.cta || '',
                  confidenceScore: draftData.confidenceScore || 50,
                  status: 'pending_review',
                  sourceSnippetsUsed: JSON.stringify(draftData.sourceSnippets || []),
                  assumptionFlags: JSON.stringify(
                    (draftData.assumptions || []).map((a: string, i: number) => ({
                      id: `af-${i}`,
                      assumption: a,
                      confidence: 'Medium',
                    }))
                  ),
                  messageId: generateMessageId(),
                },
              });
              results.push({ id: draftId, success: true });
              break;
            }
            case 'delete': {
              await db.sendQueue.deleteMany({ where: { draftId } });
              await db.draft.delete({ where: { id: draftId } });
              results.push({ id: draftId, success: true });
              break;
            }
            default:
              results.push({ id: draftId, success: false, error: `Unknown action: ${action}` });
          }
        } catch (err) {
          results.push({ id: draftId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    // ── Single draft update (E-05: supports scheduledAt for scheduling) ──
    const { id, status, subject, body: emailBody, cta, rejectReason, scheduledAt } = body as {
      id: string;
      status: string;
      subject?: string;
      body?: string;
      cta?: string;
      rejectReason?: string;
      scheduledAt?: string | null; // ISO string or null for "send now"
    };

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

    if (subject !== undefined) updateData.subject = subject;
    if (emailBody !== undefined) updateData.body = emailBody;
    if (cta !== undefined) updateData.cta = cta;

    const draft = await db.draft.update({
      where: { id },
      data: updateData,
    });

    // If approved, create a queue item and update contact status (E-05: scheduling support)
    if (status === 'approved') {
      const hasSchedule = scheduledAt && scheduledAt !== 'now' && scheduledAt !== null;
      const queueScheduledAt = hasSchedule ? new Date(scheduledAt) : new Date();
      const queueStatus = hasSchedule ? 'scheduled' : 'pending';

      await db.sendQueue.create({
        data: {
          draftId: draft.id,
          status: queueStatus,
          scheduledAt: queueScheduledAt,
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
   DELETE — Remove a draft
   ═══════════════════════════════════════════════════ */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.sendQueue.deleteMany({ where: { draftId: id } });
    await db.draft.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}