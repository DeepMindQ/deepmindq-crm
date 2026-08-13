import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { resolveEntity } from '@/lib/intelligence/knowledge-graph';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || undefined;
    const domain = searchParams.get('domain') || undefined;
    const email = searchParams.get('email') || undefined;
    const fuzzy = searchParams.get('fuzzy') === 'true';

    if (!name && !domain && !email) {
      return NextResponse.json(
        { error: 'Provide at least one of: name, domain, email' },
        { status: 400 }
      );
    }

    const matches = await resolveEntity({ name, domain, email, fuzzy });
    return NextResponse.json({ data: matches });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Entity resolution failed' },
      { status: 500 }
    );
  }
}
