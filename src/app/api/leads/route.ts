import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/* ═══════════════════════════════════════════════════
   Demo leads — shown when no real DB data exists
   ═══════════════════════════════════════════════════ */
const DEMO_LEADS = [
  { id: 'demo-1', rawName: 'Sarah Chen', normalizedName: 'sarah chen', email: 'sarah.chen@stripe.com', title: 'VP of Engineering', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 92, companyId: 'demo-c1', company: { id: 'demo-c1', rawName: 'Stripe', normalizedName: 'stripe', industry: 'Fintech', domain: 'stripe.com' }, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-2', rawName: 'Michael Torres', normalizedName: 'michael torres', email: 'm.torres@salesforce.com', title: 'Chief Technology Officer', role: 'executive', status: 'drafted', emailHealth: 'valid', leadScore: 95, companyId: 'demo-c2', company: { id: 'demo-c2', rawName: 'Salesforce', normalizedName: 'salesforce', industry: 'Technology', domain: 'salesforce.com' }, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-3', rawName: 'Priya Sharma', normalizedName: 'priya sharma', email: 'priya.sharma@infosys.com', title: 'Director of Digital Transformation', role: 'executive', status: 'queued', emailHealth: 'valid', leadScore: 88, companyId: 'demo-c3', company: { id: 'demo-c3', rawName: 'Infosys', normalizedName: 'infosys', industry: 'IT Services', domain: 'infosys.com' }, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-4', rawName: 'James O\'Brien', normalizedName: 'james o\'brien', email: 'jobrien@jpmorgan.com', title: 'Head of AI & Machine Learning', role: 'manager', status: 'sent', emailHealth: 'valid', leadScore: 85, companyId: 'demo-c4', company: { id: 'demo-c4', rawName: 'JPMorgan Chase', normalizedName: 'jpmorgan chase', industry: 'Financial Services', domain: 'jpmorgan.com' }, createdAt: new Date(Date.now() - 345600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-5', rawName: 'Aisha Patel', normalizedName: 'aisha patel', email: 'aisha.p@apollohospital.com', title: 'Chief Information Officer', role: 'executive', status: 'replied', emailHealth: 'valid', leadScore: 90, companyId: 'demo-c5', company: { id: 'demo-c5', rawName: 'Apollo Hospitals', normalizedName: 'apollo hospitals', industry: 'Healthcare', domain: 'apollohospital.com' }, createdAt: new Date(Date.now() - 432000000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-6', rawName: 'David Kim', normalizedName: 'david kim', email: 'd.kim@samsung.com', title: 'Senior Director of Cloud Engineering', role: 'manager', status: 'cleaned', emailHealth: 'valid', leadScore: 82, companyId: 'demo-c6', company: { id: 'demo-c6', rawName: 'Samsung Electronics', normalizedName: 'samsung electronics', industry: 'Technology', domain: 'samsung.com' }, createdAt: new Date(Date.now() - 518400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-7', rawName: 'Emily Watson', normalizedName: 'emily watson', email: 'e.watson@nhs.uk', title: 'Head of Data & Analytics', role: 'manager', status: 'imported', emailHealth: 'risky', leadScore: 72, companyId: 'demo-c7', company: { id: 'demo-c7', rawName: 'NHS Digital', normalizedName: 'nhs digital', industry: 'Healthcare', domain: 'nhs.uk' }, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-8', rawName: 'Rajesh Kumar', normalizedName: 'rajesh kumar', email: 'rajesh.k@tata.com', title: 'VP of Technology', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 87, companyId: 'demo-c8', company: { id: 'demo-c8', rawName: 'Tata Consultancy Services', normalizedName: 'tata consultancy services', industry: 'IT Services', domain: 'tata.com' }, createdAt: new Date(Date.now() - 691200000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-9', rawName: 'Lisa Chang', normalizedName: 'lisa chang', email: 'l.chang@shopify.com', title: 'Director of Engineering', role: 'manager', status: 'bounced', emailHealth: 'invalid', leadScore: 45, companyId: 'demo-c9', company: { id: 'demo-c9', rawName: 'Shopify', normalizedName: 'shopify', industry: 'E-commerce', domain: 'shopify.com' }, createdAt: new Date(Date.now() - 777600000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-10', rawName: 'Robert Fischer', normalizedName: 'robert fischer', email: 'r.fischer@siemens.com', title: 'Chief Digital Officer', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 91, companyId: 'demo-c10', company: { id: 'demo-c10', rawName: 'Siemens AG', normalizedName: 'siemens ag', industry: 'Manufacturing', domain: 'siemens.com' }, createdAt: new Date(Date.now() - 864000000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-11', rawName: 'Nina Okonkwo', normalizedName: 'nina okonkwo', email: 'nina.o@paystack.com', title: 'Engineering Manager', role: 'manager', status: 'cleaned', emailHealth: 'valid', leadScore: 78, companyId: 'demo-c11', company: { id: 'demo-c11', rawName: 'Paystack', normalizedName: 'paystack', industry: 'Fintech', domain: 'paystack.com' }, createdAt: new Date(Date.now() - 950400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'demo-12', rawName: 'Tom Bradley', normalizedName: 'tom bradley', email: 't.bradley@boeing.com', title: 'Sr. Architect, Cloud Platform', role: 'technical', status: 'imported', emailHealth: 'valid', leadScore: 74, companyId: 'demo-c12', company: { id: 'demo-c12', rawName: 'Boeing', normalizedName: 'boeing', industry: 'Aerospace', domain: 'boeing.com' }, createdAt: new Date(Date.now() - 1036800000).toISOString(), updatedAt: new Date().toISOString() },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const company = searchParams.get('company') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: Prisma.ContactWhereInput = {};

    if (search) {
      where.OR = [
        { normalizedName: { contains: search } },
        { editedName: { contains: search } },
        { rawName: { contains: search } },
        { email: { contains: search } },
        { title: { contains: search } },
        { company: { normalizedName: { contains: search } } },
        { company: { rawName: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (company) {
      where.company = {
        OR: [
          { normalizedName: { contains: company } },
          { rawName: { contains: company } },
        ],
      };
    }

    const sortMap: Record<string, Prisma.ContactOrderByWithRelationInput> = {
      createdAt: { createdAt: 'desc' },
      updatedAt: { updatedAt: 'desc' },
      leadScore: { leadScore: 'desc' },
      name: { normalizedName: 'asc' },
      email: { email: 'asc' },
    };
    const orderBy = sortMap[sortBy] || sortMap.createdAt;

    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      db.contact.findMany({
        where,
        include: { company: true },
        orderBy,
        skip,
        take: limit,
      }),
      db.contact.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // If no real data, return demo leads
    if (total === 0 && !search && !status && !company) {
      const demoFiltered = DEMO_LEADS.slice(skip, skip + limit);
      return NextResponse.json({
        leads: demoFiltered,
        total: DEMO_LEADS.length,
        page,
        totalPages: Math.ceil(DEMO_LEADS.length / limit),
        _demo: true,
      });
    }

    return NextResponse.json({ leads, total, page, totalPages });
  } catch (error) {
    console.error('Leads error:', error);
    // Return demo data on error too
    return NextResponse.json({
      leads: DEMO_LEADS.slice(0, 20),
      total: DEMO_LEADS.length,
      page: 1,
      totalPages: 1,
      _demo: true,
    });
  }
}