// POST /api/g-intel-acquisition/resolve-company/confirm  → confirm ambiguous match or create new

import { NextRequest, NextResponse } from 'next/server';
import { confirmResolution, createUnverifiedCompany } from '@/lib/intelligence-sources';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';

const confirmSchema = z.object({
  companyId: z.string().min(1).optional(),
  newName: z.string().min(1).max(500).optional(),
  domain: z.string().max(255).optional(),
  aliasInput: z.string().min(1).max(500),
}).refine(
  (d) => d.companyId || d.newName,
  { message: 'Either companyId or newName is required' },
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = validateBody(confirmSchema, body);
    if (data instanceof Response) return data;

    let company;

    if (data.companyId) {
      // Confirm an ambiguous match: store alias and return company
      company = await confirmResolution(data.companyId, data.aliasInput);
    } else if (data.newName) {
      // Create a new unverified company
      company = await createUnverifiedCompany(data.newName, data.domain);
    } else {
      return NextResponse.json(
        { error: 'Either companyId or newName is required' },
        { status: 400 },
      );
    }

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Confirm resolution failed';
    console.error('[g-intel-acquisition:resolve-company/confirm]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}