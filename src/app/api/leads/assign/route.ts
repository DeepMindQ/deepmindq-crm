import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { withCsrf } from '@/lib/with-csrf';

/* ═══════════════════════════════════════════════════
   POST /api/leads/assign — Smart lead assignment
   GET /api/leads/assign — Assignment summary
   ═══════════════════════════════════════════════════ */

const TEAM_MEMBERS = [
  { name: 'Ravi Shanker', email: 'ravi@deepmindq.com' },
  { name: 'Sarah Chen', email: 'sarah@deepmindq.com' },
  { name: 'Marcus Johnson', email: 'marcus@deepmindq.com' },
  { name: 'Priya Patel', email: 'priya@deepmindq.com' },
];

async function assignManual(contactIds: string[], assignTo: string) {
  const result = await db.contact.updateMany({
    where: { id: { in: contactIds } },
    data: { assignedTo: assignTo },
  });
  return result.count;
}

async function assignRoundRobin(contactIds: string[]) {
  // P5.1: Batch-fetch assignment counts in parallel (was N+1 sequential count)
  const counts = await Promise.all(
    TEAM_MEMBERS.map(tm => db.contact.count({ where: { assignedTo: tm.name } }))
  );
  const currentAssignments: Record<string, number> = {};
  TEAM_MEMBERS.forEach((tm, i) => { currentAssignments[tm.name] = counts[i]; });

  // Batch-fetch all contacts to verify they exist (single query)
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true },
  });
  const validIds = new Set(contacts.map(c => c.id));

  // Distribute valid contacts round-robin and group by assignee for batch update
  const batches: Record<string, string[]> = {};
  for (const cid of contactIds) {
    if (!validIds.has(cid)) continue;
    const sorted = [...TEAM_MEMBERS].sort((a, b) =>
      (currentAssignments[a.name] || 0) - (currentAssignments[b.name] || 0)
    );
    const assignee = sorted[0].name;
    batches[assignee] = batches[assignee] || [];
    batches[assignee].push(cid);
    currentAssignments[assignee] = (currentAssignments[assignee] || 0) + 1;
  }

  // Batch-update per assignee (was N individual update queries)
  let totalUpdated = 0;
  await Promise.all(
    Object.entries(batches).map(async ([assignee, ids]) => {
      const result = await db.contact.updateMany({
        where: { id: { in: ids } },
        data: { assignedTo: assignee },
      });
      totalUpdated += result.count;
    })
  );
  return totalUpdated;
}

async function assignTerritory(contactIds: string[]) {
  // P5.1: Batch-fetch all contacts' locations (was N+1 sequential find+update)
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true, location: true },
  });

  function territoryAssignee(location: string | null): string {
    const loc = (location || '').toLowerCase();
    if (loc.includes('india') || loc.includes('bangalore') || loc.includes('mumbai') || loc.includes('delhi')) {
      return 'Priya Patel';
    } else if (loc.includes('china') || loc.includes('beijing') || loc.includes('shanghai') || loc.includes('singapore')) {
      return 'Sarah Chen';
    } else if (loc.includes('uk') || loc.includes('london') || loc.includes('germany') || loc.includes('france') || loc.includes('europe')) {
      return 'Marcus Johnson';
    } else if (loc.includes('usa') || loc.includes('canada') || loc.includes('america')) {
      return 'Ravi Shanker';
    }
    return TEAM_MEMBERS[0].name; // default
  }

  // Group contacts by assignee for batch update
  const batches: Record<string, string[]> = {};
  for (const c of contacts) {
    const assignee = territoryAssignee(c.location);
    batches[assignee] = batches[assignee] || [];
    batches[assignee].push(c.id);
  }

  // Batch-update per territory (was N individual update queries)
  let totalUpdated = 0;
  await Promise.all(
    Object.entries(batches).map(async ([assignee, ids]) => {
      const result = await db.contact.updateMany({
        where: { id: { in: ids } },
        data: { assignedTo: assignee },
      });
      totalUpdated += result.count;
    })
  );
  return totalUpdated;
}

async function assignIndustry(contactIds: string[]) {
  // P5.1: Batch-fetch all contacts with company industry (was N+1 sequential find+update)
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds } },
    select: {
      id: true,
      company: { select: { industry: true } },
    },
  });

  function industryAssignee(industry: string | null): string {
    const ind = (industry || '').toLowerCase();
    if (ind.includes('tech') || ind.includes('software') || ind.includes('it') || ind.includes('saas')) {
      return 'Sarah Chen';
    } else if (ind.includes('finance') || ind.includes('banking') || ind.includes('insurance')) {
      return 'Marcus Johnson';
    } else if (ind.includes('health') || ind.includes('pharma') || ind.includes('medical') || ind.includes('biotech')) {
      return 'Priya Patel';
    } else {
      return 'Ravi Shanker';
    }
  }

  // Group contacts by assignee for batch update
  const batches: Record<string, string[]> = {};
  for (const c of contacts) {
    const assignee = industryAssignee(c.company?.industry ?? null);
    batches[assignee] = batches[assignee] || [];
    batches[assignee].push(c.id);
  }

  // Batch-update per industry (was N individual update queries)
  let totalUpdated = 0;
  await Promise.all(
    Object.entries(batches).map(async ([assignee, ids]) => {
      const result = await db.contact.updateMany({
        where: { id: { in: ids } },
        data: { assignedTo: assignee },
      });
      totalUpdated += result.count;
    })
  );
  return totalUpdated;
}

/* POST — Assign leads */
export const POST = withCsrf(async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { contactIds, assignTo, method } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'contactIds array is required' }, { status: 400 });
    }

    if (contactIds.length > 5000) {
      return NextResponse.json({ error: 'Max 5000 contacts per assignment' }, { status: 400 });
    }

    let updated = 0;
    const effectiveMethod = method || 'manual';

    switch (effectiveMethod) {
      case 'round_robin':
        updated = await assignRoundRobin(contactIds);
        break;
      case 'territory':
        updated = await assignTerritory(contactIds);
        break;
      case 'industry':
        updated = await assignIndustry(contactIds);
        break;
      case 'manual':
      default:
        if (!assignTo) {
          return NextResponse.json({ error: 'assignTo is required for manual assignment' }, { status: 400 });
        }
        updated = await assignManual(contactIds, assignTo);
        break;
    }

    await logAction('leads_assigned', 'Contact', 'batch', {
      count: contactIds.length,
      updated,
      method: effectiveMethod,
      assignTo: assignTo || 'auto',
    }, session!.id);

    return NextResponse.json({
      success: true,
      updated,
      method: effectiveMethod,
      message: `${updated} contacts assigned via ${effectiveMethod}`,
    });
  } catch (error) {
    logger.error('Assignment error:', { error: error });
    return NextResponse.json({ error: 'Failed to assign leads' }, { status: 500 });
  }
});

/* GET — Assignment summary */
export async function GET(request: Request) {
    // ── Authentication + RBAC Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const assignees = await db.contact.groupBy({
      by: ['assignedTo'],
      where: { assignedTo: { not: null } },
      _count: { id: true },
      _avg: { leadScore: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const summary = assignees
      .filter(a => a.assignedTo)
      .map(a => ({
        name: a.assignedTo,
        contactCount: a._count.id,
        avgLeadScore: Math.round(a._avg.leadScore || 0),
      }));

    return NextResponse.json({ assignees: summary });
  } catch (error) {
    logger.error('Assignment summary error:', { error: error });
    return NextResponse.json({ error: 'Failed to get assignment summary' }, { status: 500 });
  }
}