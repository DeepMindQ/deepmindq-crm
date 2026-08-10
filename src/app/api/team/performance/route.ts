import { db } from '@/lib/db';
import { tokens } from '@/lib/design-tokens';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/* ═══════════════════════════════════════════════════
   GET /api/team/performance — Per-member KPIs
   ═══════════════════════════════════════════════════ */

const STATUS_ORDER = ['imported', 'cleaned', 'drafted', 'queued', 'sent', 'replied', 'bounced'];

const STATUS_COLORS: Record<string, string> = {
  imported: '#6b7280',
  cleaned: tokens.extended.purple.value,
  drafted: tokens.accent.DEFAULT,
  queued: tokens.domain.reasoning,
  sent: tokens.gold.DEFAULT,
  replied: tokens.extended.emerald.value,
  bounced: tokens.domain.risk,
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    // ── 1. Get all team members from distinct assignedTo values ──
    const teamMembers = await db.contact.groupBy({
      by: ['assignedTo'],
      where: { assignedTo: { not: null } },
    });

    const memberNames = teamMembers
      .map(m => m.assignedTo)
      .filter((n): n is string => !!n);

    if (memberNames.length === 0) {
      return NextResponse.json({ members: [] });
    }

    // ── 2. For each member, calculate detailed metrics ──────────
    const members = await Promise.all(
      memberNames.map(async (name) => {
        // Get all contacts assigned to this member
        const contacts = await db.contact.findMany({
          where: { assignedTo: name },
          select: {
            id: true,
            status: true,
            leadScore: true,
            events: {
              select: { eventType: true },
            },
          },
        });

        const totalAssigned = contacts.length;

        // Status breakdown
        const statusBreakdown: Record<string, number> = {};
        for (const status of STATUS_ORDER) {
          statusBreakdown[status] = 0;
        }
        for (const c of contacts) {
          if (statusBreakdown[c.status] !== undefined) {
            statusBreakdown[c.status]++;
          }
        }

        // Average lead score
        const scoredContacts = contacts.filter(c => c.leadScore > 0);
        const avgScore =
          scoredContacts.length > 0
            ? Math.round(
                scoredContacts.reduce((sum, c) => sum + c.leadScore, 0) /
                  scoredContacts.length,
              )
            : 0;

        // Email event counts
        let openCount = 0;
        let clickCount = 0;
        let replyCount = 0;

        for (const c of contacts) {
          for (const event of c.events) {
            if (event.eventType === 'open') openCount++;
            if (event.eventType === 'click') clickCount++;
            if (event.eventType === 'reply') replyCount++;
          }
        }

        const sentCount = statusBreakdown['sent'] || 0;
        const repliedCount = statusBreakdown['replied'] || 0;
        const bouncedCount = statusBreakdown['bounced'] || 0;

        const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;
        const bounceRate = sentCount > 0 ? Math.round((bouncedCount / sentCount) * 100) : 0;

        return {
          name,
          avatar: getInitials(name),
          totalAssigned,
          statusBreakdown,
          avgScore,
          openCount,
          clickCount,
          replyCount,
          replyRate,
          bounceRate,
        };
      }),
    );

    // Sort by replyRate descending (top performer first)
    members.sort((a, b) => b.replyRate - a.replyRate);

    return NextResponse.json({ members, statusColors: STATUS_COLORS, statusOrder: STATUS_ORDER });
  } catch (error) {
    logger.error('Team performance error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get team performance metrics' },
      { status: 500 },
    );
  }
}