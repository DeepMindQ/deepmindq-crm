import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   Lead data is stored as static JSON chunks in
   /public/data/leads-chunk-{n}.json

   The API loads them on first request (cached in-memory
   within the serverless function lifecycle), then applies
   all filters server-side and returns paginated results.

   Supports filtering by:
   - search (text): name, email, title, company, city, country
   - country, industry, department, empCat, city, state (exact or multi)
   - title (designation)
   - page, limit, sortBy
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

/* ── Filter helpers ── */
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

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'company';
    const metaOnly = searchParams.get('meta') === 'true';

    // Return metadata only (for building filter dropdowns)
    if (metaOnly) {
      const meta = await loadMeta();
      return NextResponse.json({ meta, _source: 'excel' });
    }

    // Load all leads
    const leads = await loadAllLeads();

    // Apply filters
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

    // Sort
    const sortKey = sortBy as keyof LeadRecord;
    filtered.sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      return va.localeCompare(vb);
    });

    // Paginate
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageData = filtered.slice(start, start + limit);

    // Transform to API format
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

    return NextResponse.json({
      leads: results,
      total,
      page,
      totalPages,
      _source: 'excel',
    });
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to load leads', leads: [], total: 0, page: 1, totalPages: 0 },
      { status: 500 }
    );
  }
}