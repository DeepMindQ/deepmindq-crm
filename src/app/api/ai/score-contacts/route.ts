import { NextRequest, NextResponse } from 'next/server';
import { scoreContactInfluence, scoreCompanyContacts } from '@/lib/scoring/contact-influence-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, companyId } = body;

    if (contactId) {
      const result = await scoreContactInfluence(contactId);
      return NextResponse.json(result);
    }

    if (companyId) {
      const results = await scoreCompanyContacts(companyId);
      return NextResponse.json({ contacts: results });
    }

    return NextResponse.json({ error: 'Provide contactId or companyId' }, { status: 400 });
  } catch (error) {
    console.error('[score-contacts] Error:', error);
    return NextResponse.json({ error: 'Failed to score contacts' }, { status: 500 });
  }
}
