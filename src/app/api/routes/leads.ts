import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Unified Leads API — merges DB contacts + static JSON

   Priority:
   1. If DB has contacts → serve from DB (real uploaded data)
   2. If DB is empty → fall back to static JSON chunks
   3. `?source=db` or `?source=excel` to force one source
   ═══════════════════════════════════════════════════ */

type LeadRecord = {
  fn: string; ln: string; email: string; title: string; dept: string;
  li: string; company: string; web: string; empCat: string; empNum: string;
  industry: string; cli: string; city: string; state: string; country: string;
};

let cachedLeads: LeadRecord[] | null = null;
let cachedMeta: any = null;

const TOTAL_CHUNKS = 9;

async function loadAllLeads(): Promise<LeadRecord[]> {
  if (cachedLeads) return cachedLeads;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const all: LeadRecord[] = [];
  for (let i = 0; i < TOTAL_CHUNKS; i++) {
    try {
      const url = `${baseUrl}/data/leads-chunk-${i}.json`;
      const res = await fetch(url);
      if (res.ok) {
        const chunk = await res.json();
        all.push(...chunk);
      }
    } catch (err) {
      console.error(`Failed to load chunk ${i}:`, err);
    }
  }
  cachedLeads = all;
  return all;
}

async function loadMeta() {
  if (cachedMeta) return cachedMeta;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  try {
    const res = await fetch(`${baseUrl}/data/leads-metadata.json`);
    if (res.ok) {
      cachedMeta = await res.json();
    }
  } catch { /* ignore */ }
  return cachedMeta;
}

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
      include: {
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

/* ── Filter helpers for static JSON ── */
function matchesText(record: LeadRecord, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = `${record.fn} ${record.ln}`.toLowerCase();
  return (
    name.includes(q) ||
    record.email.toLowerCase().includes(q) ||
    record.title.toLowerCase().includes(q) ||
    record.company.toLowerCase().includes(q) ||
    record.city.toLowerCase().includes(q) ||
    record.state.toLowerCase().includes(q) ||
    record.country.toLowerCase().includes(q) ||
    record.dept.toLowerCase().includes(q) ||
    record.industry.toLowerCase().includes(q)
  );
}

function matchesMulti(value: string, filterValues: string[]): boolean {
  if (!filterValues || filterValues.length === 0) return true;
  return filterValues.some(f => f.toLowerCase() === value.toLowerCase());
}

/* ── Static JSON lead query ── */
async function fetchLeadsFromStatic(params: {
  search: string;
  countries: string[];
  industries: string[];
  departments: string[];
  empCats: string[];
  cities: string[];
  states: string[];
  titles: string[];
  page: number;
  limit: number;
  sortBy: string;
}) {
  const { search, countries, industries, departments, empCats, cities, states, titles, page, limit, sortBy } = params;

  const leads = await loadAllLeads();

  const filtered = leads.filter(r => {
    if (search && !matchesText(r, search)) return false;
    if (countries.length > 0 && !matchesMulti(r.country, countries)) return false;
    if (industries.length > 0 && !matchesMulti(r.industry, industries)) return false;
    if (departments.length > 0 && !matchesMulti(r.dept, departments)) return false;
    if (empCats.length > 0 && !matchesMulti(r.empCat, empCats)) return false;
    if (cities.length > 0 && !matchesMulti(r.city, cities)) return false;
    if (states.length > 0 && !matchesMulti(r.state, states)) return false;
    if (titles.length > 0 && !matchesMulti(r.title, titles)) return false;
    return true;
  });

  const sortKey = sortBy as keyof LeadRecord;
  filtered.sort((a, b) => {
    const va = (a[sortKey] || '').toString().toLowerCase();
    const vb = (b[sortKey] || '').toString().toLowerCase();
    return va.localeCompare(vb);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const pageData = filtered.slice(start, start + limit);

  const results = pageData.map((r, i) => ({
    id: `lead-${start + i}`,
    rawName: `${r.fn} ${r.ln}`.trim(),
    email: r.email,
    title: r.title,
    department: r.dept,
    linkedin: r.li,
    company: r.company,
    website: r.web,
    employeeCategory: r.empCat,
    employeeNumber: r.empNum,
    industry: r.industry,
    city: r.city,
    state: r.state,
    country: r.country,
  }));

  return { leads: results, total, page, totalPages, _source: 'excel' };
}

/* ── DB metadata builder (for filter dropdowns) ── */
async function fetchDBMeta() {
  const [allContacts, allCompanies] = await Promise.all([
    db.contact.findMany({ select: { role: true, status: true, location: true, consentStatus: true, assignedTo: true, source: true } }),
    db.company.findMany({ select: { industry: true, sizeRange: true, location: true } }),
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
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter params
    const search = searchParams.get('search') || '';
    const countries = searchParams.get('country')?.split(',').filter(Boolean) || [];
    const industries = searchParams.get('industry')?.split(',').filter(Boolean) || [];
    const departments = searchParams.get('department')?.split(',').filter(Boolean) || [];
    const empCats = searchParams.get('empCat')?.split(',').filter(Boolean) || [];
    const cities = searchParams.get('city')?.split(',').filter(Boolean) || [];
    const states = searchParams.get('state')?.split(',').filter(Boolean) || [];
    const titles = searchParams.get('title')?.split(',').filter(Boolean) || [];
    const statuses = searchParams.get('status')?.split(',').filter(Boolean) || [];
    const roles = searchParams.get('role')?.split(',').filter(Boolean) || [];
    const source = searchParams.get('source') || '';

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'company';
    const sortDir = searchParams.get('sortDir') || 'asc';
    const metaOnly = searchParams.get('meta') === 'true';

    // Return metadata only
    if (metaOnly) {
      // Try DB meta first, fall back to static
      try {
        const dbCount = await db.contact.count();
        if (dbCount > 0) {
          const meta = await fetchDBMeta();
          return NextResponse.json({ meta, _source: 'db' });
        }
      } catch { /* DB not available, fall through */ }

      const meta = await loadMeta();
      return NextResponse.json({ meta, _source: 'excel' });
    }

    // Forced source
    if (source === 'excel') {
      const result = await fetchLeadsFromStatic({
        search, countries, industries, departments, empCats, cities, states, titles, page, limit, sortBy,
      });
      return NextResponse.json(result);
    }

    if (source === 'db') {
      const consentStatuses = searchParams.get('consentStatus')?.split(',').filter(Boolean) || [];
      const assignees = searchParams.get('assignee')?.split(',').filter(Boolean) || [];
      const sources = searchParams.get('source')?.split(',').filter(Boolean) || [];
      const result = await fetchLeadsFromDB({
        search, countries, industries, departments, cities, states, titles, statuses, roles, page, limit, sortBy, sortDir, consentStatuses, assignees, sources,
      });
      return NextResponse.json(result);
    }

    // Auto-detect: try DB first, if it has data, use it
    try {
      const dbCount = await db.contact.count();
      if (dbCount > 0) {
        const consentStatuses = searchParams.get('consentStatus')?.split(',').filter(Boolean) || [];
        const assignees = searchParams.get('assignee')?.split(',').filter(Boolean) || [];
        const sources = searchParams.get('source')?.split(',').filter(Boolean) || [];
        const result = await fetchLeadsFromDB({
          search, countries, industries, departments, cities, states, titles, statuses, roles, page, limit, sortBy, sortDir, consentStatuses, assignees, sources,
        });
        return NextResponse.json(result);
      }
    } catch { /* DB not available */ }

    // Fall back to static JSON
    const result = await fetchLeadsFromStatic({
      search, countries, industries, departments, empCats, cities, states, titles, page, limit, sortBy,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to load leads', leads: [], total: 0, page: 1, totalPages: 0 },
      { status: 500 }
    );
  }
}