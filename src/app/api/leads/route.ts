import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   Leads API — DB-backed only

   P1.5: Removed static JSON fallback. All lead data
   is now served exclusively from the database.
   ═══════════════════════════════════════════════════ */

/* ── DB-backed lead query ── */
async function fetchLeadsFromDB(params: {
  search: string;
  countries: string[];
  industries: string[];
  departments: string[];
  cities: string[];
  states: string[];
  titles: string[];
  statuses: string[];
  roles: string[];
  page: number;
  limit: number;
  sortBy: string;
  sortDir: string;
  consentStatuses?: string[];
  assignees?: string[];
  sources?: string[];
}) {
  const { search, countries, industries, departments, cities, states, titles, statuses, roles, page, limit, sortBy, sortDir, consentStatuses, assignees, sources } = params;

  const where: any = {};

  // Text search across multiple fields
  if (search) {
    where.OR = [
      { rawName: { contains: search } },
      { email: { contains: search } },
      { title: { contains: search } },
      { company: { rawName: { contains: search } } },
      { location: { contains: search } },
    ];
  }

  // Exact filters
  if (countries.length > 0) {
    // For DB contacts, we need to match on location field
    // Since location is a free text field, we use contains for country
    where.OR = where.OR || [];
    if (countries.length === 1) {
      where.location = { contains: countries[0] };
    }
  }
  if (industries.length > 0) {
    where.company = { ...where.company, industry: { in: industries } };
  }
  if (statuses.length > 0) {
    where.status = { in: statuses };
  }
  if (roles.length > 0) {
    where.role = { in: roles };
  }
  if (consentStatuses && consentStatuses.length > 0) {
    where.consentStatus = { in: consentStatuses };
  }
  if (assignees && assignees.length > 0) {
    where.assignedTo = { in: assignees };
  }
  if (sources && sources.length > 0) {
    where.source = { in: sources };
  }

  // Sorting
  const sortField: any = {};
  const validSortFields: Record<string, string> = {
    company: 'company', name: 'rawName', email: 'email', title: 'title',
    score: 'leadScore', status: 'status', country: 'location',
  };
  const prismaSortField = validSortFields[sortBy] || 'createdAt';
  sortField[prismaSortField] = sortDir === 'desc' ? 'desc' : 'asc';

  const skip = (page - 1) * limit;

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      // P5.1: Explicit select to avoid SELECT * and heavy JSON fields (metadata, enrichmentData, aiData)
      select: {
        id: true,
        rawName: true,
        email: true,
        title: true,
        role: true,
        linkedinUrl: true,
        phone: true,
        location: true,
        companyId: true,
        batchId: true,
        leadScore: true,
        emailHealth: true,
        emailHealthScore: true,
        status: true,
        consentStatus: true,
        assignedTo: true,
        source: true,
        companyFitScore: true,
        engagementScore: true,
        enrichmentScore: true,
        createdAt: true,
        company: {
          select: { rawName: true, industry: true, domain: true, location: true, sizeRange: true, researchCard: { select: { enrichmentSource: true } } },
        },
      },
      orderBy: sortField,
      skip,
      take: limit,
    }),
    db.contact.count({ where }),
  ]);

  // Transform DB contacts to the Lead interface format
  const leads = contacts.map((c: any) => {
    // Parse location into city/state/country if possible
    const loc = c.location || '';
    const locationParts = loc.split(',').map((s: string) => s.trim());
    const city = locationParts[0] || '';
    const state = locationParts[1] || '';
    const country = locationParts[2] || locationParts[1] || '';

    return {
      id: c.id,
      rawName: c.rawName,
      email: c.email,
      title: c.title || '',
      department: c.role || '',
      linkedin: c.linkedinUrl || '',
      company: c.company?.rawName || '',
      website: c.company?.domain ? `https://${c.company.domain}` : '',
      employeeCategory: c.company?.sizeRange || '',
      employeeNumber: c.company?.sizeRange || '',
      industry: c.company?.industry || '',
      city,
      state,
      country,
      // DB-specific fields
      _dbFields: {
        leadScore: c.leadScore,
        emailHealth: c.emailHealth,
        emailHealthScore: c.emailHealthScore,
        status: c.status,
        role: c.role,
        phone: c.phone,
        companyId: c.companyId,
        batchId: c.batchId,
        companyFitScore: c.companyFitScore,
        engagementScore: c.engagementScore,
        enrichmentScore: c.enrichmentScore,
        consentStatus: c.consentStatus,
        assignedTo: c.assignedTo,
        source: c.source,
        hasEnrichedCompany: !!c.company?.researchCard?.enrichmentSource,
      },
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { leads, total, page, totalPages, _source: 'db' };
}

/* ── DB metadata builder (for filter dropdowns) ── */
async function fetchDBMeta() {
  const [allContacts, allCompanies] = await Promise.all([
    db.contact.findMany({ select: { role: true, status: true, location: true, consentStatus: true, assignedTo: true, source: true }, take: 10_000 }),
    db.company.findMany({ select: { industry: true, sizeRange: true, location: true }, take: 10_000 }),
  ]);

  // Count by field values
  const countBy = (arr: any[], field: string) => {
    const map: Record<string, number> = {};
    for (const item of arr) {
      const val = item[field];
      if (val) map[val] = (map[val] || 0) + 1;
    }
    return Object.entries(map)
      .map(([v, c]) => ({ v, c }))
      .sort((a, b) => b.c - a.c);
  };

  // Build country/city/state from location
  const countries: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const states: Record<string, number> = {};
  for (const c of allContacts) {
    if (c.location) {
      const parts = c.location.split(',').map((s: string) => s.trim());
      if (parts[0]) cities[parts[0]] = (cities[parts[0]] || 0) + 1;
      if (parts[1]) states[parts[1]] = (states[parts[1]] || 0) + 1;
      if (parts[2]) countries[parts[2]] = (countries[parts[2]] || 0) + 1;
      else if (parts[1]) countries[parts[1]] = (countries[parts[1]] || 0) + 1;
    }
  }

  return {
    countries: Object.entries(countries).map(([v, c]) => ({ v, c })).sort((a, b) => b.c - a.c),
    industries: countBy(allCompanies, 'industry'),
    departments: countBy(allContacts, 'role'),
    employeeCategories: countBy(allCompanies, 'sizeRange'),
    titles: [], // DB doesn't have separate title metadata
    cities: Object.entries(cities).map(([v, c]) => ({ v, c })).sort((a, b) => b.c - a.c),
    states: Object.entries(states).map(([v, c]) => ({ v, c })).sort((a, b) => b.c - a.c),
    consentStatuses: countBy(allContacts, 'consentStatus'),
    assignees: countBy(allContacts, 'assignedTo'),
    sources: countBy(allContacts, 'source'),
    totalRecords: allContacts.length,
  };
}

/* ── GET /api/leads ── */
export async function GET(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);

    // Parse filter params
    const search = searchParams.get('search') || '';
    const countries = searchParams.get('country')?.split(',').filter(Boolean) || [];
    const industries = searchParams.get('industry')?.split(',').filter(Boolean) || [];
    const departments = searchParams.get('department')?.split(',').filter(Boolean) || [];
    const cities = searchParams.get('city')?.split(',').filter(Boolean) || [];
    const states = searchParams.get('state')?.split(',').filter(Boolean) || [];
    const titles = searchParams.get('title')?.split(',').filter(Boolean) || [];
    const statuses = searchParams.get('status')?.split(',').filter(Boolean) || [];
    const roles = searchParams.get('role')?.split(',').filter(Boolean) || [];
    const sourceParam = searchParams.get('source') || '';

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'company';
    const sortDir = searchParams.get('sortDir') || 'asc';
    const metaOnly = searchParams.get('meta') === 'true';

    // Deprecation warning for `?source=excel`
    if (sourceParam === 'excel') {
      logger.warn('[leads] ?source=excel is deprecated and no longer supported; returning empty result.');
      return NextResponse.json({
        leads: [],
        total: 0,
        page: 1,
        totalPages: 0,
        _source: 'none',
        deprecationWarning: 'The ?source=excel parameter is no longer supported. Leads are now served exclusively from the database.',
      });
    }

    // Return metadata only
    if (metaOnly) {
      const meta = await fetchDBMeta();
      return NextResponse.json({ meta, _source: 'db' });
    }

    // Fetch from DB
    const consentStatuses = searchParams.get('consentStatus')?.split(',').filter(Boolean) || [];
    const assignees = searchParams.get('assignee')?.split(',').filter(Boolean) || [];
    const sources = searchParams.get('source')?.split(',').filter(Boolean) || [];
    const result = await fetchLeadsFromDB({
      search, countries, industries, departments, cities, states, titles, statuses, roles, page, limit, sortBy, sortDir, consentStatuses, assignees, sources,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Leads API error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load leads', leads: [], total: 0, page: 1, totalPages: 0 },
      { status: 500 }
    );
  }
}
