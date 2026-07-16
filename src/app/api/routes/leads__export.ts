import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   L-05: Lead Export to CSV
   ═══════════════════════════════════════════════════ */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter params (same as GET /api/leads)
    const search = searchParams.get('search') || '';
    const countries = searchParams.get('country')?.split(',').filter(Boolean) || [];
    const industries = searchParams.get('industry')?.split(',').filter(Boolean) || [];
    const statuses = searchParams.get('status')?.split(',').filter(Boolean) || [];
    const roles = searchParams.get('role')?.split(',').filter(Boolean) || [];
    const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

    const where: any = {};

    // If specific IDs provided, use them
    if (ids.length > 0) {
      where.id = { in: ids };
    } else {
      if (search) {
        where.OR = [
          { rawName: { contains: search } },
          { email: { contains: search } },
          { title: { contains: search } },
          { company: { rawName: { contains: search } } },
          { location: { contains: search } },
        ];
      }
      if (countries.length > 0) {
        where.location = { contains: countries[0] };
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
    }

    const contacts = await db.contact.findMany({
      where,
      include: {
        company: { select: { rawName: true, industry: true } },
      },
      orderBy: { leadScore: 'desc' },
      take: 50000, // Safety limit
    });

    // Build CSV
    const header = 'Name,Email,Title,Company,Industry,City,State,Country,Lead Score,Email Health,Status,Source';
    const rows = (contacts as any[]).map((c: any) => {
      const loc = (c.location || '').split(',').map((s: string) => s.trim());
      const name = c.rawName.replace(/"/g, '""');
      const email = (c.email || '').replace(/"/g, '""');
      const title = (c.title || '').replace(/"/g, '""');
      const company = (c.company?.rawName || '').replace(/"/g, '""');
      const industry = (c.company?.industry || '').replace(/"/g, '""');
      const city = (loc[0] || '').replace(/"/g, '""');
      const state = (loc[1] || '').replace(/"/g, '""');
      const country = (loc[2] || loc[1] || '').replace(/"/g, '""');

      return `"${name}","${email}","${title}","${company}","${industry}","${city}","${state}","${country}",${c.leadScore},${c.emailHealth},${c.status},${c.source || ''}`;
    });

    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="deepmindq-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}