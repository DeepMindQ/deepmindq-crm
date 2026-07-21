import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validate';
import { z } from 'zod/v4';
import { csrfMiddleware } from '@/lib/csrf';

/* ═══════════════════════════════════════════════════
   Demo companies — shown when DB has no real data
   ═══════════════════════════════════════════════════ */
const DEMO_COMPANIES = [
  { id: 'demo-c1', rawName: 'Stripe', normalizedName: 'stripe', domain: 'stripe.com', industry: 'Fintech', sizeRange: '1,001-5,000', location: 'San Francisco, CA', country: 'US', website: 'https://stripe.com', tags: '[]', status: 'active', lifecycleStage: 'qualification', assignedTo: null, intelligenceScore: 82, engagementScore: 65, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 2 }, researchCard: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c2', rawName: 'Salesforce', normalizedName: 'salesforce', domain: 'salesforce.com', industry: 'Technology', sizeRange: '10,001+', location: 'San Francisco, CA', country: 'US', website: 'https://salesforce.com', tags: '["enterprise"]', status: 'engaged', lifecycleStage: 'proposal', assignedTo: 'user-1', intelligenceScore: 91, engagementScore: 78, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c3', rawName: 'Infosys', normalizedName: 'infosys', domain: 'infosys.com', industry: 'IT Services', sizeRange: '10,001+', location: 'Bangalore, India', country: 'IN', website: 'https://infosys.com', tags: '["outsourcing","enterprise"]', status: 'prospect', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 75, engagementScore: 30, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c4', rawName: 'JPMorgan Chase', normalizedName: 'jpmorgan chase', domain: 'jpmorgan.com', industry: 'Financial Services', sizeRange: '10,001+', location: 'New York, NY', country: 'US', website: 'https://jpmorgan.com', tags: '["finance","enterprise","priority"]', status: 'engaged', lifecycleStage: 'negotiation', assignedTo: 'user-2', intelligenceScore: 95, engagementScore: 88, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 3 }, researchCard: null, createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c5', rawName: 'Apollo Hospitals', normalizedName: 'apollo hospitals', domain: 'apollohospital.com', industry: 'Healthcare', sizeRange: '5,001-10,000', location: 'Chennai, India', country: 'IN', website: 'https://apollohospital.com', tags: '["healthcare"]', status: 'researching', lifecycleStage: 'qualification', assignedTo: null, intelligenceScore: 68, engagementScore: 42, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 432000000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c6', rawName: 'Samsung Electronics', normalizedName: 'samsung electronics', domain: 'samsung.com', industry: 'Technology', sizeRange: '10,001+', location: 'Suwon, South Korea', country: 'KR', website: 'https://samsung.com', tags: '["hardware","enterprise"]', status: 'prospect', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 80, engagementScore: 20, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c7', rawName: 'NHS Digital', normalizedName: 'nhs digital', domain: 'nhs.uk', industry: 'Healthcare', sizeRange: '5,001-10,000', location: 'London, UK', country: 'GB', website: 'https://nhs.uk', tags: '["public-sector","healthcare"]', status: 'paused', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 60, engagementScore: 10, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c8', rawName: 'Tata Consultancy Services', normalizedName: 'tata consultancy services', domain: 'tata.com', industry: 'IT Services', sizeRange: '10,001+', location: 'Mumbai, India', country: 'IN', website: 'https://tata.com', tags: '["outsourcing","enterprise"]', status: 'active', lifecycleStage: 'qualification', assignedTo: 'user-1', intelligenceScore: 77, engagementScore: 55, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 2 }, researchCard: null, createdAt: new Date(Date.now() - 691200000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c9', rawName: 'Shopify', normalizedName: 'shopify', domain: 'shopify.com', industry: 'E-commerce', sizeRange: '5,001-10,000', location: 'Ottawa, Canada', country: 'CA', website: 'https://shopify.com', tags: '["saas","mid-market"]', status: 'researching', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 73, engagementScore: 35, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 777600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c10', rawName: 'Siemens AG', normalizedName: 'siemens ag', domain: 'siemens.com', industry: 'Manufacturing', sizeRange: '10,001+', location: 'Munich, Germany', country: 'DE', website: 'https://siemens.com', tags: '["manufacturing","enterprise"]', status: 'prospect', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 84, engagementScore: 25, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 864000000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c11', rawName: 'Paystack', normalizedName: 'paystack', domain: 'paystack.com', industry: 'Fintech', sizeRange: '201-500', location: 'Lagos, Nigeria', country: 'NG', website: 'https://paystack.com', tags: '["fintech","startup"]', status: 'prospect', lifecycleStage: 'discovery', assignedTo: null, intelligenceScore: 62, engagementScore: 15, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 950400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-c12', rawName: 'Boeing', normalizedName: 'boeing', domain: 'boeing.com', industry: 'Aerospace', sizeRange: '10,001+', location: 'Chicago, IL', country: 'US', website: 'https://boeing.com', tags: '["aerospace","enterprise"]', status: 'closed_won', lifecycleStage: 'closed', assignedTo: 'user-2', intelligenceScore: 93, engagementScore: 92, lastEnrichedAt: null, lastActivityAt: null, source: 'import', _count: { contacts: 1 }, researchCard: null, createdAt: new Date(Date.now() - 1036800000).toISOString(), updatedAt: new Date().toISOString() },
];

function filterDemoCompanies(params: URLSearchParams) {
  let filtered = [...DEMO_COMPANIES];

  const search = params.get('search')?.toLowerCase().trim();
  if (search) {
    filtered = filtered.filter(c =>
      c.rawName.toLowerCase().includes(search) ||
      c.domain?.toLowerCase().includes(search) ||
      c.industry?.toLowerCase().includes(search) ||
      c.location?.toLowerCase().includes(search)
    );
  }

  const industry = params.get('industry');
  if (industry) {
    filtered = filtered.filter(c => c.industry === industry);
  }

  const status = params.get('status');
  if (status) {
    filtered = filtered.filter(c => c.status === status);
  }

  const sizeRange = params.get('sizeRange');
  if (sizeRange) {
    filtered = filtered.filter(c => c.sizeRange === sizeRange);
  }

  const sortBy = params.get('sortBy') || 'name';
  const sortDir = params.get('sortDir') === 'desc' ? 'desc' : 'asc';

  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name': cmp = a.rawName.localeCompare(b.rawName); break;
      case 'contacts': cmp = a._count.contacts - b._count.contacts; break;
      case 'score': cmp = (a.intelligenceScore || 0) - (b.intelligenceScore || 0); break;
      case 'updatedAt': cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
      default: cmp = 0;
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(params.get('limit') || '20', 10)));
  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    companies: paginated.map(c => ({ ...c, contactCount: c._count.contacts })),
    total,
    page,
    limit,
  };
}

/* ═══════════════════════════════════════════════════
   GET — List companies with search, filter, sort, paginate
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const industry = searchParams.get('industry');
    const status = searchParams.get('status');
    const sizeRange = searchParams.get('sizeRange');
    const enrichment = searchParams.get('enrichment'); // 'enriched' | 'unenriched'
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));

    // Build where clause
    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      const term = search.toLowerCase();
      where.OR = [
        { rawName: { contains: search } },
        { normalizedName: { contains: term } },
        { domain: { contains: term } },
        { industry: { contains: search } },
        { location: { contains: search } },
      ];
    }

    if (industry) {
      where.industry = industry;
    }

    if (status) {
      where.status = status;
    }

    if (sizeRange) {
      where.sizeRange = sizeRange;
    }

    if (enrichment === 'enriched') {
      where.researchCard = { isNot: null };
    } else if (enrichment === 'unenriched') {
      where.researchCard = null;
    }

    // Build orderBy
    let orderBy: Prisma.CompanyOrderByWithRelationInput;
    switch (sortBy) {
      case 'contacts':
        orderBy = { contacts: { _count: sortDir } };
        break;
      case 'score':
        orderBy = { intelligenceScore: sortDir };
        break;
      case 'updatedAt':
        orderBy = { updatedAt: sortDir };
        break;
      default:
        orderBy = { rawName: sortDir };
    }

    const [companies, total] = await Promise.all([
      db.company.findMany({
        where,
        include: {
          _count: { select: { contacts: true } },
          researchCard: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.company.count({ where }),
    ]);

    // If no real data, fall back to demo data
    if (companies.length === 0 && total === 0 && !search && !industry && !status && !sizeRange) {
      return NextResponse.json(filterDemoCompanies(searchParams));
    }

    const result = companies.map((c: any) => ({
      ...c,
      contactCount: c._count.contacts,
    }));

    return NextResponse.json({ companies: result, total, page, limit });
  } catch (error) {
    console.error('Companies list error:', error);
    return NextResponse.json({ error: 'Failed to load companies' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a new company
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  const csrf = csrfMiddleware(request)
  if (!csrf.valid) return csrf.response!
  try {
    const body = await request.json();
    const createCompanyBody = z.object({
      rawName: z.string().min(1, 'rawName is required'),
      domain: z.string().optional(),
      industry: z.string().optional(),
      sizeRange: z.string().optional(),
      location: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
    });
    const validated = validateBody(createCompanyBody, body);
    if (!validated.success) {
      return NextResponse.json({ error: 'Validation failed', details: validated.error }, { status: 400 });
    }
    const { rawName, domain, industry, sizeRange, location, country, website } = validated.data;

    const normalizedName = rawName.trim().toLowerCase();

    // Check for duplicate by normalized name or domain
    const existingWhere: Prisma.CompanyWhereInput = { normalizedName };
    if (domain && typeof domain === 'string' && domain.trim()) {
      existingWhere.OR = [
        { normalizedName },
        { domain: domain.trim().toLowerCase() },
      ];
    }

    const existing = await db.company.findFirst({ where: existingWhere });
    if (existing) {
      return NextResponse.json(
        { error: 'Company with this name or domain already exists', companyId: existing.id },
        { status: 409 }
      );
    }

    const company = await db.company.create({
      data: {
        rawName: rawName.trim(),
        normalizedName,
        domain: domain ? domain.trim().toLowerCase() : null,
        industry: industry || null,
        sizeRange: sizeRange || null,
        location: location || null,
        country: country || null,
        website: website || null,
        tags: '[]',
        status: 'prospect',
        lifecycleStage: 'discovery',
        source: 'manual',
      },
      include: {
        _count: { select: { contacts: true } },
        researchCard: true,
      },
    });

    return NextResponse.json({ company: { ...company, contactCount: company._count.contacts } }, { status: 201 });
  } catch (error) {
    console.error('Company create error:', error);
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}