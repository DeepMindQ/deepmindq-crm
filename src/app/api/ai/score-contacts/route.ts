import { NextRequest, NextResponse } from 'next/server';
import { scoreContactInfluence, scoreCompanyContacts } from '@/lib/scoring/contact-influence-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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
    logger.error('[score-contacts] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to score contacts' }, { status: 500 });
  }
}
