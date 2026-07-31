import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma, CompanyStatus, CompanyPriorityTier } from '@prisma/client';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   GET — List companies with search, filter, sort, paginate
   
   T6 API Contract (ARCHITECTURE.md:865):
   GET /api/companies?sortBy=accountPriorityScore&sortOrder=desc&page=1&limit=50&tier=HOT
   Response: {
     companies: Company[],
     pagination: { page, limit, total, totalPages },
     filters: { tiers: CompanyPriorityTier[], statuses: CompanyStatus[] }
   }
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const industry = searchParams.get('industry');
    const status = searchParams.get('status');
    const sizeRange = searchParams.get('sizeRange');
    const tier = searchParams.get('tier');
    const sortBy = searchParams.get('sortBy') || 'accountPriorityScore';
    // T6 spec uses sortOrder; also accept legacy sortDir for backward compat
    const sortOrder = searchParams.get('sortOrder') || searchParams.get('sortDir') || 'desc';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    // Cursor-based pagination: accept cursor param, fall back to offset
    const cursor = searchParams.get('cursor');

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

    if (industry) where.industry = industry;
    if (status) where.status = status as CompanyStatus;
    if (sizeRange) where.sizeRange = sizeRange;
    if (tier && Object.values(CompanyPriorityTier).includes(tier as CompanyPriorityTier)) {
      where.priorityTier = tier as CompanyPriorityTier;
    }

    // Build orderBy — T6: all three score dimensions + signals + activity
    let orderBy: Prisma.CompanyOrderByWithRelationInput;
    switch (sortBy) {
      case 'accountPriorityScore':
        orderBy = { accountPriorityScore: { sort: sortDir, nulls: 'last' } };
        break;
      case 'intelligenceScore':
      case 'score':
        orderBy = { intelligenceScore: sortDir };
        break;
      case 'opportunityScore':
        // Prisma limitation: cannot orderBy nested relation field directly.
        // Sort by recommendation count as proxy for opportunity strength.
        orderBy = { opportunityRecommendations: { _count: sortDir } };
        break;
      case 'accountScore':
        orderBy = { accountScore: { score: sortDir } };
        break;
      case 'contacts':
        orderBy = { contacts: { _count: sortDir } };
        break;
      case 'signals':
        orderBy = { signals: { _count: sortDir } };
        break;
      case 'lastActivityAt':
        orderBy = { lastActivityAt: { sort: sortDir, nulls: 'last' } };
        break;
      case 'updatedAt':
        orderBy = { updatedAt: sortDir };
        break;
      default:
        orderBy = { rawName: sortDir };
    }

    // Cursor-based skip: if cursor provided, decode base64 cursor to get offset
    let skip = cursor ? (() => {
      try { return parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10) || 0; }
      catch { return 0; }
    })() : (page - 1) * limit;

    const [companies, total, tierDist, statusDist] = await Promise.all([
      db.company.findMany({
        where,
        include: {
          _count: {
            select: {
              contacts: true,
              signals: true,
              opportunityRecommendations: true,
            },
          },
          researchCard: { select: { id: true } },
          accountScore: { select: { score: true, category: true } },
          opportunityRecommendations: {
            where: { status: { in: ['pending_review', 'accepted', 'monitored'] } },
            orderBy: { opportunityScore: 'desc' },
            take: 1,
            select: { opportunityScore: true },
          },
          signals: {
            where: { status: { in: ['detected', 'validated', 'active'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, title: true, signalType: true, impact: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.company.count({ where }),
      // Tier distribution for filters metadata
      db.company.groupBy({
        by: ['priorityTier'],
        _count: true,
      }),
      // Status distribution for filters metadata
      db.company.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    // Generate next cursor (base64-encoded offset of next page)
    const nextOffset = skip + companies.length;
    const nextCursor = nextOffset < total ? Buffer.from(String(nextOffset)).toString('base64') : null;

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
      opportunityScore: c.opportunityRecommendations?.[0]?.opportunityScore ?? null,
      accountScore: c.accountScore?.score ?? null,
      accountCategory: c.accountScore?.category ?? null,
      contactCount: c._count.contacts,
      signalCount: c._count.signals,
      opportunityCount: c._count.opportunityRecommendations ?? 0,
      isEnriched: !!c.researchCard,
      topSignal: c.signals[0] ?? null,
      lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
      updatedAt: c.updatedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      companies: result,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        ...(nextCursor && { nextCursor }),
      },
      filters: {
        tiers: tierDist
          .filter(t => t.priorityTier != null)
          .map(t => ({ tier: t.priorityTier as string, count: t._count }))
          .sort((a, b) => {
            const order: Record<string, number> = { HOT: 0, ACTIVE: 1, NURTURE: 2, LOW: 3 };
            return (order[a.tier] ?? 99) - (order[b.tier] ?? 99);
          }),
        statuses: statusDist
          .map(s => ({ status: s.status as string, count: s._count })),
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
