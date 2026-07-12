import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [totalLeads, drafts, sent, companies, capabilities] = await Promise.all([
    db.contact.count(),
    db.draft.count(),
    db.draft.count({ where: { status: 'sent' } }),
    db.company.count(),
    db.capabilityDocument.count(),
  ]);
  return NextResponse.json({ totalLeads, drafts, sent, companies, capabilities });
}