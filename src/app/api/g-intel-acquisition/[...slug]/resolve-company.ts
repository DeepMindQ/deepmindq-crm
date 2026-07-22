// POST /api/g-intel-acquisition/resolve-company  → resolve a company name

import { NextRequest, NextResponse } from 'next/server';
import { resolveCompany } from '@/lib/intelligence-sources';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';

const resolveCompanySchema = z.object({
  name: z.string().min(1).max(500),
  domain: z.string().max(255).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = validateBody(resolveCompanySchema, body);
    if (data instanceof Response) return data;

    const result = await resolveCompany(data.name, data.domain);

    return NextResponse.json({
      resolved: result.resolved,
      candidate: result.candidate ?? undefined,
      candidates: result.candidates ?? undefined,
      needsNewCompany: result.needsNewCompany,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Company resolution failed';
    console.error('[g-intel-acquisition:resolve-company]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}