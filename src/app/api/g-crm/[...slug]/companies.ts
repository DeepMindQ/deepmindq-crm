import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validate';
import { z } from 'zod/v4';
import { csrfMiddleware } from '@/lib/csrf';

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

    // No filters applied and no data — return empty result
    // (previously returned demo data; now returns real empty state)

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