import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/* ── In-memory demo fallback ── */
let demoStore: Record<string, unknown>[] = [];

const DEMO_CAPABILITIES = [
  { id: 'cap-1', title: 'AI & Machine Learning', summary: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions.', category: 'service_line', serviceLine: 'AI & Data', targetIndustries: 'Financial Services, Healthcare, Manufacturing', targetRoles: 'CTO, VP Engineering, Head of Data', problems: 'Scaling AI infrastructure, model deployment', evidence: '150+ successful implementations', content: 'Our AI & ML practice delivers end-to-end solutions from data strategy through production deployment. We specialize in NLP, computer vision, recommendation systems, and predictive analytics.', isActive: true, version: 1 },
  { id: 'cap-2', title: 'Cloud Engineering', summary: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP.', category: 'service_line', serviceLine: 'Cloud & Infrastructure', targetIndustries: 'Technology, Financial Services, Healthcare', targetRoles: 'CTO, VP Engineering, Cloud Architect', problems: 'Legacy migration, cost optimization', evidence: '200+ cloud migrations completed', content: 'Full-spectrum cloud engineering from assessment and strategy through migration and ongoing optimization. Certified across all major cloud providers.', isActive: true, version: 1 },
  { id: 'cap-3', title: 'Data Engineering', summary: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization.', category: 'service_line', serviceLine: 'AI & Data', targetIndustries: 'Financial Services, Healthcare, Retail', targetRoles: 'CDO, VP Data, Head of Analytics', problems: 'Data silos, poor data quality, slow analytics', evidence: '99.9% platform uptime guarantee', content: 'We build modern data platforms that turn raw data into actionable insights. Expertise in Snowflake, Databricks, dbt, and real-time streaming architectures.', isActive: true, version: 1 },
  { id: 'cap-4', title: 'Fortune 500 Document Automation', summary: 'Reduced processing time by 85% for a Fortune 500 financial services company through AI-powered document automation.', category: 'case_study', serviceLine: 'AI & Data', targetIndustries: 'Financial Services', evidence: '85% processing time reduction, $2M annual savings', isActive: true, version: 1 },
  { id: 'cap-5', title: 'Healthcare Platform Migration', summary: 'Migrated 200+ microservices to cloud-native architecture for a healthcare platform, achieving 99.99% uptime.', category: 'case_study', serviceLine: 'Cloud & Infrastructure', targetIndustries: 'Healthcare', evidence: '99.99% uptime, zero-downtime migration', isActive: true, version: 1 },
  { id: 'cap-6', title: '150+ Enterprise Implementations', summary: '150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors.', category: 'proof_point', evidence: 'Average 3x ROI within 12 months', isActive: true, version: 1 },
  { id: 'cap-7', title: 'Cost vs. In-House Building', summary: 'When prospects say they can build it internally, highlight the hidden costs: hiring specialized talent, months of ramp-up, opportunity cost of delayed time-to-market.', category: 'objection_response', targetRoles: 'CTO, VP Engineering', content: 'Acknowledge their capability, then pivot to speed and focus: "Your team is absolutely capable — the question is whether this is the highest-impact use of their time right now. We deliver in weeks what typically takes 6-12 months to build internally."', isActive: true, version: 1 },
  { id: 'cap-8', title: 'Budget Constraints', summary: 'When prospects say budget is tight, reframe the conversation around ROI and phased approach.', category: 'objection_response', content: 'Refocus on value: "We typically see 3x ROI within the first year. Would it help if we structured this as a phased engagement starting with the highest-impact area?"', isActive: true, version: 1 },
  { id: 'cap-9', title: 'Standard Meeting Request', summary: 'Would you be open to a brief 15-minute call to explore how this might apply to your team?', category: 'cta', isActive: true, version: 1 },
  { id: 'cap-10', title: 'Specific Use Case Discussion', summary: 'Could we schedule 20 minutes to walk through a specific use case relevant to [company]?', category: 'cta', isActive: true, version: 1 },
];

function getDemoCapabilities(category?: string) {
  let source = demoStore.length > 0 ? demoStore : DEMO_CAPABILITIES;
  if (category && category !== 'all') {
    source = source.filter(c => (c as Record<string, unknown>).category === category);
  }
  return source;
}

/* ── GET ── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    const where: Prisma.CapabilityAssetWhereInput = {};
    if (category) {
      where.category = category;
    }

    const capabilities = await db.capabilityAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(capabilities);
  } catch (error) {
    console.error('Capabilities DB error, using demo data:', error);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    return NextResponse.json(getDemoCapabilities(category));
  }
}

/* ── POST (create) ── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, summary, category, serviceLine, targetIndustries, targetRoles, problems, evidence, content } = body;

    if (!title || !summary || !category) {
      return NextResponse.json({ error: 'title, summary, and category are required' }, { status: 400 });
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
      },
    });

    return NextResponse.json(capability, { status: 201 });
  } catch (error) {
    console.error('Create capability DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const id = `cap-${Date.now()}`;
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoStore.unshift(created);
    return NextResponse.json(created, { status: 201 });
  }
}

/* ── PUT (update) ── */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};
    const allowedFields = ['title', 'summary', 'category', 'serviceLine', 'targetIndustries', 'targetRoles', 'problems', 'evidence', 'content', 'isActive'];
    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updateData[field] = fields[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const capability = await db.capabilityAsset.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(capability);
  } catch (error) {
    console.error('Update capability DB error, using in-memory:', error);
    const body = await request.json().catch(() => ({}));
    const idx = demoStore.findIndex(c => (c as Record<string, unknown>).id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }
    demoStore[idx] = { ...demoStore[idx], ...body };
    delete (demoStore[idx] as Record<string, unknown>).id; // keep original id
    demoStore[idx] = { id: body.id, ...demoStore[idx] };
    return NextResponse.json(demoStore[idx]);
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