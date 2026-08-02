import { NextResponse } from 'next/server';
import { transitionStatus, getValidTransitions } from '@/lib/lead-workflow';
import { db } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   L-07: Lead Status Transition API
   
   PATCH: Transition single or bulk lead status
   GET:  Get valid transitions for a status
   ═══════════════════════════════════════════════════ */

const statusTransitionSchema = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  status: z.string().min(1, 'Status is required'),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const parsed = statusTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed' }, { status: 400 });
    }
    const { id, ids, status, reason } = parsed.data;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Bulk transition
    if (ids && ids.length > 0) {
      const results = await Promise.all(
        ids.map((contactId: string) => transitionStatus(contactId, status, reason)),
      );

      const succeeded = results.filter(r => r.success).length;
      const errors = results.filter(r => !r.success).map(r => r.error);

      return NextResponse.json({
        success: true,
        updated: succeeded,
        failed: ids.length - succeeded,
        errors: errors.slice(0, 5), // Show first 5 errors
      });
    }

    // Single transition
    if (id) {
      const result = await transitionStatus(id, status, reason);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Return updated contact
      const contact = await db.contact.findUnique({ where: { id } });
      return NextResponse.json({ success: true, contact });
    }

    return NextResponse.json({ error: 'Provide id or ids' }, { status: 400 });
  } catch (error) {
    logger.error('Status transition error:', { error: error });
    return NextResponse.json({ error: 'Status transition failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    if (!status) {
      return NextResponse.json({ error: 'Status query param required' }, { status: 400 });
    }

    const valid = getValidTransitions(status);
    return NextResponse.json({ status, validTransitions: valid });
  } catch (error) {
    logger.error('Get transitions error:', { error: error });
    return NextResponse.json({ error: 'Failed to get transitions' }, { status: 500 });
  }
}