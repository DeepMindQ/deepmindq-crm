import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Demo company contacts — shown when DB is unavailable
   Maps to the demo company IDs used in /api/companies
   ═══════════════════════════════════════════════════ */
const DEMO_COMPANY_CONTACTS: Record<string, any[]> = {
  'demo-c1': [
    { id: 'demo-1', rawName: 'Sarah Chen', normalizedName: 'sarah chen', email: 'sarah.chen@stripe.com', title: 'VP of Engineering', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 92, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'demo-x1', rawName: 'Alex Rivera', normalizedName: 'alex rivera', email: 'a.rivera@stripe.com', title: 'Director of Product', role: 'manager', status: 'imported', emailHealth: 'valid', leadScore: 81, createdAt: new Date(Date.now() - 172800000).toISOString() },
  ],
  'demo-c2': [
    { id: 'demo-2', rawName: 'Michael Torres', normalizedName: 'michael torres', email: 'm.torres@salesforce.com', title: 'Chief Technology Officer', role: 'executive', status: 'drafted', emailHealth: 'valid', leadScore: 95, createdAt: new Date(Date.now() - 172800000).toISOString() },
  ],
  'demo-c3': [
    { id: 'demo-3', rawName: 'Priya Sharma', normalizedName: 'priya sharma', email: 'priya.sharma@infosys.com', title: 'Director of Digital Transformation', role: 'executive', status: 'queued', emailHealth: 'valid', leadScore: 88, createdAt: new Date(Date.now() - 259200000).toISOString() },
  ],
  'demo-c4': [
    { id: 'demo-4', rawName: "James O'Brien", normalizedName: "james o'brien", email: 'jobrien@jpmorgan.com', title: 'Head of AI & Machine Learning', role: 'manager', status: 'sent', emailHealth: 'valid', leadScore: 85, createdAt: new Date(Date.now() - 345600000).toISOString() },
    { id: 'demo-x4a', rawName: 'Karen Liu', normalizedName: 'karen liu', email: 'k.liu@jpmorgan.com', title: 'VP of Digital Banking', role: 'executive', status: 'replied', emailHealth: 'valid', leadScore: 90, createdAt: new Date(Date.now() - 432000000).toISOString() },
    { id: 'demo-x4b', rawName: 'Mark Thompson', normalizedName: 'mark thompson', email: 'm.thompson@jpmorgan.com', title: 'Sr. Director, Cloud Infrastructure', role: 'manager', status: 'drafted', emailHealth: 'valid', leadScore: 78, createdAt: new Date(Date.now() - 518400000).toISOString() },
  ],
  'demo-c5': [
    { id: 'demo-5', rawName: 'Aisha Patel', normalizedName: 'aisha patel', email: 'aisha.p@apollohospital.com', title: 'Chief Information Officer', role: 'executive', status: 'replied', emailHealth: 'valid', leadScore: 90, createdAt: new Date(Date.now() - 432000000).toISOString() },
  ],
  'demo-c6': [
    { id: 'demo-6', rawName: 'David Kim', normalizedName: 'david kim', email: 'd.kim@samsung.com', title: 'Senior Director of Cloud Engineering', role: 'manager', status: 'cleaned', emailHealth: 'valid', leadScore: 82, createdAt: new Date(Date.now() - 518400000).toISOString() },
  ],
  'demo-c7': [
    { id: 'demo-7', rawName: 'Emily Watson', normalizedName: 'emily watson', email: 'e.watson@nhs.uk', title: 'Head of Data & Analytics', role: 'manager', status: 'imported', emailHealth: 'risky', leadScore: 72, createdAt: new Date(Date.now() - 604800000).toISOString() },
  ],
  'demo-c8': [
    { id: 'demo-8', rawName: 'Rajesh Kumar', normalizedName: 'rajesh kumar', email: 'rajesh.k@tata.com', title: 'VP of Technology', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 87, createdAt: new Date(Date.now() - 691200000).toISOString() },
    { id: 'demo-x8', rawName: 'Meera Nair', normalizedName: 'meera nair', email: 'm.nair@tata.com', title: 'Director of Innovation', role: 'manager', status: 'imported', emailHealth: 'valid', leadScore: 76, createdAt: new Date(Date.now() - 777600000).toISOString() },
  ],
  'demo-c9': [
    { id: 'demo-9', rawName: 'Lisa Chang', normalizedName: 'lisa chang', email: 'l.chang@shopify.com', title: 'Director of Engineering', role: 'manager', status: 'bounced', emailHealth: 'invalid', leadScore: 45, createdAt: new Date(Date.now() - 777600000).toISOString() },
  ],
  'demo-c10': [
    { id: 'demo-10', rawName: 'Robert Fischer', normalizedName: 'robert fischer', email: 'r.fischer@siemens.com', title: 'Chief Digital Officer', role: 'executive', status: 'cleaned', emailHealth: 'valid', leadScore: 91, createdAt: new Date(Date.now() - 864000000).toISOString() },
  ],
  'demo-c11': [
    { id: 'demo-11', rawName: 'Nina Okonkwo', normalizedName: 'nina okonkwo', email: 'nina.o@paystack.com', title: 'Engineering Manager', role: 'manager', status: 'cleaned', emailHealth: 'valid', leadScore: 78, createdAt: new Date(Date.now() - 950400000).toISOString() },
  ],
  'demo-c12': [
    { id: 'demo-12', rawName: 'Tom Bradley', normalizedName: 'tom bradley', email: 't.bradley@boeing.com', title: 'Sr. Architect, Cloud Platform', role: 'technical', status: 'imported', emailHealth: 'valid', leadScore: 74, createdAt: new Date(Date.now() - 1036800000).toISOString() },
  ],
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let companyId: string | undefined;

  try {
    const resolved = await params;
    companyId = resolved.id;

    const contacts = await db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
    });

    // If no contacts found for this company, check if it's a demo ID
    if (contacts.length === 0) {
      const demoContacts = DEMO_COMPANY_CONTACTS[companyId];
      if (demoContacts) {
        return NextResponse.json({ contacts: demoContacts, _demo: true });
      }
      // Real company but no contacts yet
      return NextResponse.json({ contacts: [] });
    }

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Company contacts error:', error);

    // On DB error, try to return demo data for known demo IDs
    const demoContacts = companyId ? DEMO_COMPANY_CONTACTS[companyId] : null;
    if (demoContacts) {
      return NextResponse.json({ contacts: demoContacts, _demo: true });
    }

    // Generic fallback
    return NextResponse.json({
      contacts: [
        {
          id: 'demo-fallback',
          rawName: 'Demo Contact',
          normalizedName: 'demo contact',
          email: 'demo@example.com',
          title: 'Unknown Role',
          role: 'other',
          status: 'imported',
          emailHealth: 'unknown',
          leadScore: 50,
          createdAt: new Date().toISOString(),
        },
      ],
      _demo: true,
    });
  }
}