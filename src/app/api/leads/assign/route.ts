import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

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
  // Get current assignment counts per team member
  const currentAssignments: Record<string, number> = {};
  for (const tm of TEAM_MEMBERS) {
    const count = await db.contact.count({ where: { assignedTo: tm.name } });
    currentAssignments[tm.name] = count;
  }

  let totalUpdated = 0;
  for (let i = 0; i < contactIds.length; i++) {
    // Find the member with the fewest assignments
    const sorted = [...TEAM_MEMBERS].sort((a, b) =>
      (currentAssignments[a.name] || 0) - (currentAssignments[b.name] || 0)
    );
    const assignee = sorted[0].name;

    await db.contact.update({
      where: { id: contactIds[i] },
      data: { assignedTo: assignee },
    });
    currentAssignments[assignee] = (currentAssignments[assignee] || 0) + 1;
    totalUpdated++;
  }
  return totalUpdated;
}

async function assignTerritory(contactIds: string[]) {
  // Simple territory: assign by country in location field
  let totalUpdated = 0;
  for (const cid of contactIds) {
    const contact = await db.contact.findUnique({ where: { id: cid }, select: { location: true } });
    if (!contact) continue;

    const loc = (contact.location || '').toLowerCase();
    let assignee = TEAM_MEMBERS[0].name; // default

    if (loc.includes('india') || loc.includes('bangalore') || loc.includes('mumbai') || loc.includes('delhi')) {
      assignee = 'Priya Patel';
    } else if (loc.includes('china') || loc.includes('beijing') || loc.includes('shanghai') || loc.includes('singapore')) {
      assignee = 'Sarah Chen';
    } else if (loc.includes('uk') || loc.includes('london') || loc.includes('germany') || loc.includes('france') || loc.includes('europe')) {
      assignee = 'Marcus Johnson';
    } else if (loc.includes('usa') || loc.includes('canada') || loc.includes('america')) {
      assignee = 'Ravi Shanker';
    }

    await db.contact.update({ where: { id: cid }, data: { assignedTo: assignee } });
    totalUpdated++;
  }
  return totalUpdated;
}

async function assignIndustry(contactIds: string[]) {
  // Simple industry-based assignment
  let totalUpdated = 0;
  for (const cid of contactIds) {
    const contact = await db.contact.findUnique({
      where: { id: cid },
      include: { company: { select: { industry: true } } },
    });
    if (!contact) continue;

    const industry = (contact.company?.industry || '').toLowerCase();
    let assignee = TEAM_MEMBERS[0].name;

    if (industry.includes('tech') || industry.includes('software') || industry.includes('it') || industry.includes('saas')) {
      assignee = 'Sarah Chen';
    } else if (industry.includes('finance') || industry.includes('banking') || industry.includes('insurance')) {
      assignee = 'Marcus Johnson';
    } else if (industry.includes('health') || industry.includes('pharma') || industry.includes('medical') || industry.includes('biotech')) {
      assignee = 'Priya Patel';
    } else {
      assignee = 'Ravi Shanker';
    }

    await db.contact.update({ where: { id: cid }, data: { assignedTo: assignee } });
    totalUpdated++;
  }
  return totalUpdated;
}

/* POST — Assign leads */
export async function POST(request: Request) {
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
    });

    return NextResponse.json({
      success: true,
      updated,
      method: effectiveMethod,
      message: `${updated} contacts assigned via ${effectiveMethod}`,
    });
  } catch (error) {
    console.error('Assignment error:', error);
    return NextResponse.json({ error: 'Failed to assign leads' }, { status: 500 });
  }
}

/* GET — Assignment summary */
export async function GET() {
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
    console.error('Assignment summary error:', error);
    return NextResponse.json({ error: 'Failed to get assignment summary' }, { status: 500 });
  }
}