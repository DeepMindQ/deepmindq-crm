import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'stats');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const [totalLeads, drafts, sent, companies, capabilities] = await Promise.all([
      db.contact.count(),
      db.draft.count(),
      db.draft.count({ where: { status: 'sent' } }),
      db.company.count(),
      db.capabilityAsset.count(),
    ]);
    return utilitySuccess(ctx, { totalLeads, drafts, sent, companies, capabilities }, 'stats', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'ENGINE_ERROR', 'Stats fetch failed', Date.now() - startedAt);
  }
}
