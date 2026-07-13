import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getVectorIndex } from '@/lib/vector-index';

/* ── In-memory demo fallback ── */
let demoStore: Record<string, unknown>[] = [];

const DEMO_CAPABILITIES = [
  { id: 'cap-1', title: 'AI & Machine Learning', summary: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions.', category: 'service_line', serviceLine: 'AI & Data', targetIndustries: 'Financial Services, Healthcare, Manufacturing', targetRoles: 'CTO, VP Engineering, Head of Data', problems: 'Scaling AI infrastructure, model deployment', evidence: '150+ successful implementations', content: 'Our AI & ML practice delivers end-to-end solutions from data strategy through production deployment. We specialize in NLP, computer vision, recommendation systems, and predictive analytics.', isActive: true, version: 1, tags: '["ai","ml","automation"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-2', title: 'Cloud Engineering', summary: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP.', category: 'service_line', serviceLine: 'Cloud & Infrastructure', targetIndustries: 'Technology, Financial Services, Healthcare', targetRoles: 'CTO, VP Engineering, Cloud Architect', problems: 'Legacy migration, cost optimization', evidence: '200+ cloud migrations completed', content: 'Full-spectrum cloud engineering from assessment and strategy through migration and ongoing optimization. Certified across all major cloud providers.', isActive: true, version: 1, tags: '["cloud","aws","azure","gcp"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-3', title: 'Data Engineering', summary: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization.', category: 'service_line', serviceLine: 'AI & Data', targetIndustries: 'Financial Services, Healthcare, Retail', targetRoles: 'CDO, VP Data, Head of Analytics', problems: 'Data silos, poor data quality, slow analytics', evidence: '99.9% platform uptime guarantee', content: 'We build modern data platforms that turn raw data into actionable insights. Expertise in Snowflake, Databricks, dbt, and real-time streaming architectures.', isActive: true, version: 1, tags: '["data","analytics","snowflake"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-4', title: 'Fortune 500 Document Automation', summary: 'Reduced processing time by 85% for a Fortune 500 financial services company through AI-powered document automation.', category: 'case_study', serviceLine: 'AI & Data', targetIndustries: 'Financial Services', evidence: '85% processing time reduction, $2M annual savings', isActive: true, version: 1, tags: '["ai","automation","financial-services"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-5', title: 'Healthcare Platform Migration', summary: 'Migrated 200+ microservices to cloud-native architecture for a healthcare platform, achieving 99.99% uptime.', category: 'case_study', serviceLine: 'Cloud & Infrastructure', targetIndustries: 'Healthcare', evidence: '99.99% uptime, zero-downtime migration', isActive: true, version: 1, tags: '["cloud","healthcare","migration"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-6', title: '150+ Enterprise Implementations', summary: '150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors.', category: 'proof_point', evidence: 'Average 3x ROI within 12 months', isActive: true, version: 1, tags: '["enterprise","track-record"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-7', title: 'Cost vs. In-House Building', summary: 'When prospects say they can build it internally, highlight the hidden costs: hiring specialized talent, months of ramp-up, opportunity cost of delayed time-to-market.', category: 'objection_response', targetRoles: 'CTO, VP Engineering', content: 'Acknowledge their capability, then pivot to speed and focus: "Your team is absolutely capable — the question is whether this is the highest-impact use of their time right now. We deliver in weeks what typically takes 6-12 months to build internally."', isActive: true, version: 1, tags: '["objection","budget"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-8', title: 'Budget Constraints', summary: 'When prospects say budget is tight, reframe the conversation around ROI and phased approach.', category: 'objection_response', content: 'Refocus on value: "We typically see 3x ROI within the first year. Would it help if we structured this as a phased engagement starting with the highest-impact area?"', isActive: true, version: 1, tags: '["objection","budget"]', upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-9', title: 'Standard Meeting Request', summary: 'Would you be open to a brief 15-minute call to explore how this might apply to your team?', category: 'cta', isActive: true, version: 1, tags: null, upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
  { id: 'cap-10', title: 'Specific Use Case Discussion', summary: 'Could we schedule 20 minutes to walk through a specific use case relevant to [company]?', category: 'cta', isActive: true, version: 1, tags: null, upvotes: 0, downvotes: 0, usedInEmails: 0, parentAssetId: null },
];

function getDemoCapabilities(category?: string) {
  let source = demoStore.length > 0 ? demoStore : DEMO_CAPABILITIES;
  if (category && category !== 'all') {
    source = source.filter(c => (c as Record<string, unknown>).category === category);
  }
  return source;
}

/**
 * Parse tags to JSON string for storage.
 */
function tagsToString(tags: string[] | undefined | null): string | null {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
  // Deduplicate and clean
  const cleaned = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))];
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Parse tags from JSON string for response.
 */
function parseTagsField(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  }
}

/* ── GET ── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';

    const where: Prisma.CapabilityAssetWhereInput = {};
    if (category) {
      where.category = category;
    }
    if (tag) {
      where.tags = { contains: tag.toLowerCase() };
    }

    const capabilities = await db.capabilityAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Parse tags for each capability in response
    const withTags = capabilities.map(c => ({
      ...c,
      tags: parseTagsField(c.tags),
    }));

    return NextResponse.json(withTags);
  } catch (error) {
    console.error('Capabilities DB error, using demo data:', error);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const data = getDemoCapabilities(category);
    const withTags = data.map(c => ({
      ...c,
      tags: parseTagsField((c as Record<string, unknown>).tags as string | null),
    }));
    return NextResponse.json(withTags);
  }
}

/* ── POST (create) ── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, summary, category, serviceLine, targetIndustries, targetRoles, problems, evidence, content, tags, targetCompanySizes, parentAssetId } = body;

    if (!title || !summary || !category) {
      return NextResponse.json({ error: 'title, summary, and category are required' }, { status: 400 });
    }

    // C-08: Validate parentAssetId if provided
    if (parentAssetId) {
      const parentExists = await db.capabilityAsset.findUnique({ where: { id: parentAssetId } }).catch(() => null);
      if (!parentExists) {
        return NextResponse.json({ error: 'Parent capability not found' }, { status: 400 });
      }
    }

    const capability = await db.capabilityAsset.create({
      data: {
        title,
        summary,
        category,
        serviceLine: serviceLine || null,
        targetIndustries: targetIndustries || null,
        targetRoles: targetRoles || null,
        problems: problems || null,
        evidence: evidence || null,
        content: content || null,
        isActive: body.isActive !== false,
        tags: tagsToString(tags),
        targetCompanySizes: targetCompanySizes || null,
        parentAssetId: parentAssetId || null,
        version: 1,
      },
    });

    // Invalidate vector index on create
    try { getVectorIndex().build([]); } catch { /* ignore */ }

    return NextResponse.json({
      ...capability,
      tags: parseTagsField(capability.tags),
    }, { status: 201 });
  } catch (error) {
    console.error('Create capability DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const id = `cap-${Date.now()}`;
    const tagsStr = tagsToString(body.tags);
    const created = {
      id,
      title: body.title || 'Untitled',
      summary: body.summary || '',
      category: body.category || 'service_line',
      serviceLine: body.serviceLine || null,
      targetIndustries: body.targetIndustries || null,
      targetRoles: body.targetRoles || null,
      problems: body.problems || null,
      evidence: body.evidence || null,
      content: body.content || null,
      isActive: body.isActive !== false,
      version: 1,
      tags: parseTagsField(tagsStr),
      targetCompanySizes: body.targetCompanySizes || null,
      parentAssetId: body.parentAssetId || null,
      upvotes: 0, downvotes: 0, usedInEmails: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoStore.unshift(created);
    return NextResponse.json(created, { status: 201 });
  }
}

/* ── PUT (update) — C-07: auto-increment version ── */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // C-07: Read current to detect version-worthy changes
    const current = await db.capabilityAsset.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};
    const allowedFields = ['title', 'summary', 'category', 'serviceLine', 'targetIndustries', 'targetRoles', 'problems', 'evidence', 'content', 'isActive', 'targetCompanySizes', 'parentAssetId'];
    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updateData[field] = fields[field];
      }
    }

    // Handle tags separately (C-15)
    if (fields.tags !== undefined) {
      updateData.tags = tagsToString(fields.tags);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // C-07: Auto-increment version when title, summary, or content changes
    const versionWorthyFields = ['title', 'summary', 'content'];
    const hasVersionChange = versionWorthyFields.some(f =>
      fields[f] !== undefined && String(fields[f] || '') !== String((current as any)[f] || '')
    );
    if (hasVersionChange) {
      updateData.version = ((current as any).version || 0) + 1;
    }

    // C-08: Validate parentAssetId if changing
    if (fields.parentAssetId) {
      const parentExists = await db.capabilityAsset.findUnique({ where: { id: fields.parentAssetId } }).catch(() => null);
      if (!parentExists) {
        return NextResponse.json({ error: 'Parent capability not found' }, { status: 400 });
      }
    }

    const capability = await db.capabilityAsset.update({
      where: { id },
      data: updateData,
    });

    // Invalidate vector index on update
    try { getVectorIndex().build([]); } catch { /* ignore */ }

    return NextResponse.json({
      ...capability,
      tags: parseTagsField(capability.tags),
    });
  } catch (error) {
    console.error('Update capability DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const idx = demoStore.findIndex(c => (c as Record<string, unknown>).id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }
    const existing = demoStore[idx] as Record<string, unknown>;
    if (body.tags !== undefined) {
      body.tags = parseTagsField(tagsToString(body.tags));
    }
    // C-07: In-memory version bump
    const versionWorthy = ['title', 'summary', 'content'];
    const needsVersionBump = versionWorthy.some(f =>
      body[f] !== undefined && String(body[f] || '') !== String(existing[f] || '')
    );
    if (needsVersionBump) {
      body.version = ((existing.version as number) || 0) + 1;
    }
    demoStore[idx] = { ...existing, ...body };
    demoStore[idx] = { id: body.id, ...demoStore[idx] };
    return NextResponse.json(demoStore[idx]);
  }
}

/* ═══════════════════════════════════════════════════
   C-11: PATCH — Bulk Operations
   Body: { ids: string[], action: "activate"|"deactivate"|"delete"|"setCategory", category?: string }
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ids, action, category } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (!action || !['activate', 'deactivate', 'delete', 'setCategory'].includes(action)) {
      return NextResponse.json({ error: 'action must be one of: activate, deactivate, delete, setCategory' }, { status: 400 });
    }
    if (action === 'setCategory' && !category) {
      return NextResponse.json({ error: 'category is required for setCategory action' }, { status: 400 });
    }

    let processed = 0;

    if (action === 'delete') {
      const result = await db.capabilityAsset.deleteMany({
        where: { id: { in: ids } },
      });
      processed = result.count;
    } else if (action === 'activate') {
      const result = await db.capabilityAsset.updateMany({
        where: { id: { in: ids } },
        data: { isActive: true },
      });
      processed = result.count;
    } else if (action === 'deactivate') {
      const result = await db.capabilityAsset.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      });
      processed = result.count;
    } else if (action === 'setCategory') {
      const result = await db.capabilityAsset.updateMany({
        where: { id: { in: ids } },
        data: { category },
      });
      processed = result.count;
    }

    // Invalidate vector index on bulk ops
    try { getVectorIndex().build([]); } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      action,
      requested: ids.length,
      processed,
    });
  } catch (error) {
    console.error('Bulk operation DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const { ids, action, category } = body;
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    let processed = 0;
    for (const id of ids) {
      const idx = demoStore.findIndex(c => (c as Record<string, unknown>).id === id);
      if (idx === -1) continue;
      if (action === 'delete') {
        demoStore.splice(idx, 1);
        processed++;
      } else if (action === 'activate') {
        demoStore[idx] = { ...demoStore[idx], isActive: true };
        processed++;
      } else if (action === 'deactivate') {
        demoStore[idx] = { ...demoStore[idx], isActive: false };
        processed++;
      } else if (action === 'setCategory' && category) {
        demoStore[idx] = { ...demoStore[idx], category };
        processed++;
      }
    }
    return NextResponse.json({ success: true, action, requested: ids.length, processed });
  }
}

/* ── DELETE ── */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.capabilityAsset.delete({
      where: { id },
    });

    // Invalidate vector index on delete
    try { getVectorIndex().build([]); } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete capability DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const idx = demoStore.findIndex(c => (c as Record<string, unknown>).id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }
    demoStore.splice(idx, 1);
    return NextResponse.json({ success: true });
  }
}