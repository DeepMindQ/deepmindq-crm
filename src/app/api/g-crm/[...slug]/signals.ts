import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface Signal {
  id: string;
  type: string;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  companyName?: string;
  severity: 'high' | 'medium' | 'low';
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

/* In-memory dismissed signal IDs (lightweight — resets on server restart) */
const dismissedIds = new Set<string>();

/* ═══════════════════════════════════════════════════════════════
   GET /api/signals — Detect signals from lead data
   ═══════════════════════════════════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 50);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const signals: Signal[] = [];
    const typeCounts: Record<string, number> = {};

    /* ── 1. High-Engagement Leads ──
       Contacts with open events but no reply events, status = 'sent' */
    try {
      const contactsSent = await db.contact.findMany({
        where: { status: 'sent' },
        select: { id: true, rawName: true, companyId: true },
      });
      const sentIds = contactsSent.map(c => c.id);

      if (sentIds.length > 0) {
        // Get contacts that have 'open' events
        const openContacts = await db.emailEvent.groupBy({
          by: ['contactId'],
          where: {
            contactId: { in: sentIds },
            eventType: 'open',
          },
        });
        const openContactIds = new Set(openContacts.map(o => o.contactId));

        // Get contacts that have 'reply' events
        const replyContacts = await db.emailEvent.groupBy({
          by: ['contactId'],
          where: {
            contactId: { in: sentIds },
            eventType: 'reply',
          },
        });
        const replyContactIds = new Set(replyContacts.map(r => r.contactId));

        // High engagement = opened but not replied
        const highEngagementIds = [...openContactIds].filter(id => !replyContactIds.has(id));

        if (highEngagementIds.length > 0) {
          const contacts = await db.contact.findMany({
            where: { id: { in: highEngagementIds } },
            include: { company: { select: { normalizedName: true } } },
            take: 10,
            orderBy: { leadScore: 'desc' },
          });

          for (const c of contacts) {
            signals.push({
              id: `high-engagement-${c.id}`,
              type: 'high_engagement',
              title: 'High-Engagement Lead',
              description: 'Opened your email but hasn\'t replied — prime for follow-up',
              contactId: c.id,
              contactName: c.rawName,
              companyName: c.company?.normalizedName,
              severity: 'high',
              detectedAt: now.toISOString(),
              metadata: { leadScore: c.leadScore },
            });
            typeCounts['high_engagement'] = (typeCounts['high_engagement'] || 0) + 1;
          }
        }
      }
    } catch { /* skip */ }

    /* ── 2. Score Spike ──
       Contacts where leadScore >= 80 AND status IN ('imported', 'cleaned') */
    try {
      const scoreSpikeContacts = await db.contact.findMany({
        where: {
          leadScore: { gte: 80 },
          status: { in: ['imported', 'cleaned'] },
        },
        include: { company: { select: { normalizedName: true } } },
        take: 10,
        orderBy: { leadScore: 'desc' },
      });

      for (const c of scoreSpikeContacts) {
        signals.push({
          id: `score-spike-${c.id}`,
          type: 'score_spike',
          title: 'Score Spike — Untapped Potential',
          description: `Lead score ${c.leadScore} but still in "${c.status}" status — draft and send!`,
          contactId: c.id,
          contactName: c.rawName,
          companyName: c.company?.normalizedName,
          severity: 'high',
          detectedAt: now.toISOString(),
          metadata: { leadScore: c.leadScore, status: c.status },
        });
        typeCounts['score_spike'] = (typeCounts['score_spike'] || 0) + 1;
      }
    } catch { /* skip */ }

    /* ── 3. Stale Lead ──
       Contacts where status = 'sent' AND lastContactedAt < 7 days ago AND no reply events */
    try {
      const staleContacts = await db.contact.findMany({
        where: {
          status: 'sent',
          lastContactedAt: { lte: sevenDaysAgo },
        },
        select: { id: true, rawName: true, companyId: true, lastContactedAt: true },
        take: 50,
      });

      if (staleContacts.length > 0) {
        const staleIds = staleContacts.map(c => c.id);
        const replyEvents = await db.emailEvent.groupBy({
          by: ['contactId'],
          where: { contactId: { in: staleIds }, eventType: 'reply' },
        });
        const repliedIds = new Set(replyEvents.map(r => r.contactId));
        const openEvents = await db.emailEvent.groupBy({
          by: ['contactId'],
          where: { contactId: { in: staleIds }, eventType: 'open' },
        });
        const openedIds = new Set(openEvents.map(o => o.contactId));
        const clickEvents = await db.emailEvent.groupBy({
          by: ['contactId'],
          where: { contactId: { in: staleIds }, eventType: 'click' },
        });
        const clickedIds = new Set(clickEvents.map(o => o.contactId));

        const trulyStale = staleContacts.filter(c =>
          !repliedIds.has(c.id) && !openedIds.has(c.id) && !clickedIds.has(c.id)
        );

        if (trulyStale.length > 0) {
          const companies = await db.company.findMany({
            where: { id: { in: trulyStale.map(c => c.companyId).filter(Boolean) } },
            select: { id: true, normalizedName: true },
          });
          const companyMap = new Map(companies.map(co => [co.id, co.normalizedName]));

          for (const c of trulyStale.slice(0, 8)) {
            signals.push({
              id: `stale-lead-${c.id}`,
              type: 'stale_lead',
              title: 'Stale Lead — No Engagement',
              description: `Sent 7+ days ago with zero opens, clicks, or replies`,
              contactId: c.id,
              contactName: c.rawName,
              companyName: companyMap.get(c.companyId),
              severity: 'low',
              detectedAt: now.toISOString(),
              metadata: { lastContactedAt: c.lastContactedAt?.toISOString() },
            });
            typeCounts['stale_lead'] = (typeCounts['stale_lead'] || 0) + 1;
          }
        }
      }
    } catch { /* skip */ }

    /* ── 4. Recent Bounce Risk ──
       Contacts where emailHealth = 'risky' AND has queue items with status pending/scheduled */
    try {
      const riskyQueueContacts = await db.contact.findMany({
        where: {
          emailHealth: 'risky',
          drafts: {
            some: {
              queueItem: {
                status: { in: ['pending', 'scheduled'] },
              },
            },
          },
        },
        include: {
          company: { select: { normalizedName: true } },
        },
        take: 10,
      });

      for (const c of riskyQueueContacts) {
        signals.push({
          id: `bounce-risk-${c.id}`,
          type: 'bounce_risk',
          title: 'Bounce Risk in Queue',
          description: 'Email health is "risky" and currently queued — likely to bounce',
          contactId: c.id,
          contactName: c.rawName,
          companyName: c.company?.normalizedName,
          severity: 'high',
          detectedAt: now.toISOString(),
          metadata: { emailHealth: c.emailHealth },
        });
        typeCounts['bounce_risk'] = (typeCounts['bounce_risk'] || 0) + 1;
      }
    } catch { /* skip */ }

    /* ── 5. Unassigned High-Value ──
       Contacts where leadScore >= 70 AND assignedTo IS NULL */
    try {
      const unassignedContacts = await db.contact.findMany({
        where: {
          leadScore: { gte: 70 },
          assignedTo: null,
        },
        include: { company: { select: { normalizedName: true } } },
        take: 10,
        orderBy: { leadScore: 'desc' },
      });

      for (const c of unassignedContacts) {
        signals.push({
          id: `unassigned-${c.id}`,
          type: 'unassigned_high_value',
          title: 'Unassigned High-Value Lead',
          description: `Score ${c.leadScore} — needs an owner to drive conversion`,
          contactId: c.id,
          contactName: c.rawName,
          companyName: c.company?.normalizedName,
          severity: 'medium',
          detectedAt: now.toISOString(),
          metadata: { leadScore: c.leadScore },
        });
        typeCounts['unassigned_high_value'] = (typeCounts['unassigned_high_value'] || 0) + 1;
      }
    } catch { /* skip */ }

    /* ── 6. Sequence Dropout ──
       SequenceEnrollment where status IN ('cancelled', 'paused') */
    try {
      const dropouts = await db.sequenceEnrollment.findMany({
        where: {
          status: { in: ['cancelled', 'paused'] },
        },
        take: 10,
        orderBy: { startedAt: 'desc' },
      });

      if (dropouts.length > 0) {
        const contactIds = dropouts.map(d => d.contactId);
        const sequenceIds = dropouts.map(d => d.sequenceId);

        const contacts = await db.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, rawName: true, company: { select: { normalizedName: true } } },
        });
        const contactMap = new Map(contacts.map(c => [c.id, c]));

        const sequences = await db.emailSequence.findMany({
          where: { id: { in: sequenceIds } },
          select: { id: true, name: true },
        });
        const sequenceMap = new Map(sequences.map(s => [s.id, s.name]));

        for (const d of dropouts) {
          const contact = contactMap.get(d.contactId);
          const seqName = sequenceMap.get(d.sequenceId) ?? 'Unknown Sequence';
          if (!contact) continue;
          signals.push({
            id: `sequence-dropout-${d.id}`,
            type: 'sequence_dropout',
            title: `Sequence "${seqName}" — ${d.status}`,
            description: `${contact.rawName} dropped out of the sequence`,
            contactId: contact.id,
            contactName: contact.rawName,
            companyName: contact.company?.normalizedName,
            severity: 'medium',
            detectedAt: now.toISOString(),
            metadata: { sequenceName: seqName, enrollmentStatus: d.status },
          });
          typeCounts['sequence_dropout'] = (typeCounts['sequence_dropout'] || 0) + 1;
        }
      }
    } catch { /* skip */ }

    /* ── 7. New Positive Reply ──
       Most recent Reply per contact where category = 'positive' */
    try {
      const positiveReplies = await db.reply.findMany({
        where: { category: 'positive' },
        include: {
          contact: {
            select: {
              id: true,
              rawName: true,
              company: { select: { normalizedName: true } },
            },
          },
        },
        take: 10,
        orderBy: { receivedAt: 'desc' },
      });

      for (const r of positiveReplies) {
        signals.push({
          id: `positive-reply-${r.id}`,
          type: 'positive_reply',
          title: 'Positive Reply — Action Needed!',
          description: r.body
            ? `${r.body.slice(0, 80)}${r.body.length > 80 ? '...' : ''}`
            : 'Received a positive response — respond promptly!',
          contactId: r.contact.id,
          contactName: r.contact.rawName,
          companyName: r.contact.company?.normalizedName,
          severity: 'high',
          detectedAt: r.receivedAt.toISOString(),
          metadata: { replyId: r.id, subject: r.subject },
        });
        typeCounts['positive_reply'] = (typeCounts['positive_reply'] || 0) + 1;
      }
    } catch { /* skip */ }

    /* ── Filter out dismissed & sort ── */
    const active = signals.filter(s => !dismissedIds.has(s.id));
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    active.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    return NextResponse.json({
      signals: active.slice(0, limit),
      summary: typeCounts,
      total: active.length,
      dismissed: dismissedIds.size,
    });
  } catch (error) {
    console.error('[Signals API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect signals', signals: [], summary: {}, total: 0 },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/signals — Dismiss a signal (in-memory)
   ═══════════════════════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (action === 'dismiss' && id) {
      dismissedIds.add(id);
      return NextResponse.json({ success: true, dismissed: id });
    }

    return NextResponse.json({ error: 'Invalid action. Use { id, action: "dismiss" }' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}