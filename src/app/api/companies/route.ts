import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma, CompanyStatus, CompanyPriorityTier } from '@prisma/client';
import { logger } from '@/lib/logger';

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
    const tier = searchParams.get('tier');
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
      where.status = status as CompanyStatus;
    }

    if (sizeRange) {
      where.sizeRange = sizeRange;
    }

    if (tier && Object.values(CompanyPriorityTier).includes(tier as CompanyPriorityTier)) {
      where.priorityTier = tier as CompanyPriorityTier;
    }

    // Build orderBy — T6: support priority, intelligence, opportunity score sorting
    let orderBy: Prisma.CompanyOrderByWithRelationInput;
    switch (sortBy) {
      case 'contacts':
        orderBy = { contacts: { _count: sortDir } };
        break;
      case 'score':
        orderBy = { intelligenceScore: sortDir };
        break;
      case 'accountPriorityScore':
        orderBy = { accountPriorityScore: { sort: sortDir, nulls: 'last' } };
        break;
      case 'accountScore':
        orderBy = { accountScore: { score: sortDir } };
        break;
      case 'signals':
        orderBy = { signals: { _count: sortDir } };
        break;
      case 'updatedAt':
        orderBy = { updatedAt: sortDir };
        break;
      case 'lastActivityAt':
        orderBy = { lastActivityAt: { sort: sortDir, nulls: 'last' } };
        break;
      default:
        orderBy = { rawName: sortDir };
    }

    const [companies, total, globalStats] = await Promise.all([
      db.company.findMany({
        where,
        include: {
          _count: { select: { contacts: true, signals: true } },
          researchCard: { select: { id: true } },
          accountScore: { select: { score: true, category: true } },
          signals: {
            where: { status: { in: ['detected', 'validated', 'active'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, title: true, signalType: true, impact: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.company.count({ where }),
      // Global stats across all companies (ignoring pagination filters)
      db.company.aggregate({
        _avg: { intelligenceScore: true },
        _count: { id: true },
      }),
    ]);

    const withSignals = await db.company.count({
      where: { ...where, signals: { some: {} } },
    });
    const enriched = await db.company.count({
      where: { ...where, researchCard: { isNot: null } },
    });

    const result = companies.map((c: any) => ({
      id: c.id,
      rawName: c.rawName,
      domain: c.domain,
      industry: c.industry,
      sizeRange: c.sizeRange,
      country: c.country,
      status: c.status,
      priorityTier: c.priorityTier ?? null,
      accountPriorityScore: c.accountPriorityScore ?? null,
      intelligenceScore: c.intelligenceScore,
      accountScore: c.accountScore?.score ?? null,
      accountCategory: c.accountScore?.category ?? null,
      contactCount: c._count.contacts,
      signalCount: c._count.signals,
      isEnriched: !!c.researchCard,
      topSignal: c.signals[0] ?? null,
      lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
      updatedAt: c.updatedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      companies: result,
      total,
      page,
      limit,
      stats: {
        total: globalStats._count.id,
        avgScore: Math.round(globalStats._avg.intelligenceScore ?? 0),
        withSignals,
        enriched,
      },
    });
  } catch (error) {
    logger.error('Companies list error:', { error: error });
    return NextResponse.json({ error: 'Failed to load companies' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a new company
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rawName, domain, industry, sizeRange, location, country, website } = body;

    if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
      return NextResponse.json({ error: 'rawName is required' }, { status: 400 });
    }

    const normalizedName = rawName.trim().toLowerCase();

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
        _count: { select: { contacts: true, signals: true } },
        researchCard: { select: { id: true } },
      },
    });

    return NextResponse.json({
      company: {
        ...company,
        contactCount: company._count.contacts,
        signalCount: company._count.signals,
        isEnriched: !!company.researchCard,
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Company create error:', { error: error });
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
  }
}