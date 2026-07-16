import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [totalLeads, drafts, sent, companies, capabilities] = await Promise.all([
      db.contact.count(),
      db.draft.count(),
      db.draft.count({ where: { status: 'sent' } }),
      db.company.count(),
      db.capabilityAsset.count(),
    ]);
    return NextResponse.json({ totalLeads, drafts, sent, companies, capabilities });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ totalLeads: 0, drafts: 0, sent: 0, companies: 0, capabilities: 0 });
  }
}