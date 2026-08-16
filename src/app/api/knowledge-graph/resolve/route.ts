import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { resolveEntity } from '@/lib/intelligence/knowledge-graph';

const resolveQuerySchema = z
  .object({
    name: z.string().optional(),
    domain: z.string().optional(),
    email: z.string().optional(),
    fuzzy: z.enum(['true', 'false']).optional(),
  })
  .refine((d) => d.name || d.domain || d.email, {
    message: 'Provide at least one of: name, domain, email',
  });

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = resolveQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { name, domain, email, fuzzy } = parsed.data;

    const matches = await resolveEntity({ name, domain, email, fuzzy: fuzzy === 'true' });
    return NextResponse.json({ data: matches });
  } catch (_error) {
    return NextResponse.json({ error: 'Entity resolution failed' }, { status: 500 });
  }
}
