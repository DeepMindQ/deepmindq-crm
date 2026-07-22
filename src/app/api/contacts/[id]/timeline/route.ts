import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/contacts/[id]/timeline
   Returns chronological activity timeline for a contact
   ═══════════════════════════════════════════════════ */

const EVENT_ICONS: Record<string, string> = {
  import: 'Database',
  verify: 'MailCheck',
  draft_created: 'FileEdit',
  draft_approved: 'CheckCircle2',
  email_sent: 'Send',
  email_opened: 'Eye',
  email_replied: 'Mail',
  bounce: 'Ban',
  status_change: 'ArrowRightLeft',
  note_added: 'StickyNote',
  enrichment: 'Sparkles',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contact = await db.contact.findUnique({
      where: { id },
      include: {
        company: { select: { rawName: true, industry: true, domain: true, location: true, sizeRange: true } },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const timeline: Array<{
      type: string;
      title: string;
      description: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // 1. Import event
    timeline.push({
      type: 'import',
      title: 'Contact Imported',
      description: `Imported via batch ${contact.batchId}`,
      timestamp: contact.createdAt,
      metadata: {
        consentSource: contact.consentSource,
        source: contact.source,
        consentStatus: contact.consentStatus,
      },
    });

    // 2. Verification event
    if (contact.lastCheckedAt && contact.emailHealth !== 'unknown') {
      timeline.push({
        type: 'verify',
        title: `Email Verified: ${contact.emailHealth}`,
        description: `Email health score: ${contact.emailHealthScore}/100`,
        timestamp: contact.lastCheckedAt,
        metadata: { health: contact.emailHealth, score: contact.emailHealthScore },
      });
    }

    // 3. Draft events
    const drafts = await db.draft.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const draft of drafts) {
      if (draft.status === 'pending_review' || draft.status === 'pending') {
        timeline.push({
          type: 'draft_created',
          title: 'Draft Created',
          description: `Subject: ${draft.subject}`,
          timestamp: draft.createdAt,
          metadata: { draftId: draft.id, confidenceScore: draft.confidenceScore },
        });
      }
      if (draft.status === 'approved') {
        timeline.push({
          type: 'draft_approved',
          title: 'Draft Approved',
          description: `Subject: ${draft.subject}`,
          timestamp: draft.updatedAt,
          metadata: { draftId: draft.id },
        });
      }
      if (draft.status === 'rejected') {
        timeline.push({
          type: 'draft_created',
          title: 'Draft Rejected',
          description: `Subject: ${draft.subject}${draft.rejectReason ? ` — ${draft.rejectReason}` : ''}`,
          timestamp: draft.updatedAt,
          metadata: { draftId: draft.id, rejectReason: draft.rejectReason },
        });
      }
    }

    // 4. Send events
    const queueItems = await db.sendQueue.findMany({
      where: { draft: { contactId: id } },
      orderBy: { sentAt: 'desc' },
      take: 20,
    });

    for (const qi of queueItems) {
      if (qi.sentAt) {
        timeline.push({
          type: 'email_sent',
          title: 'Email Sent',
          description: `Via ${qi.provider || 'default'} provider`,
          timestamp: qi.sentAt,
          metadata: { queueId: qi.id, provider: qi.provider },
        });
      }
    }

    // 5. Email events (opens, clicks, bounces)
    const emailEvents = await db.emailEvent.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    for (const event of emailEvents) {
      let type = 'status_change';
      let title = event.eventType;
      let description = '';

      if (event.eventType === 'open') {
        type = 'email_opened';
        title = 'Email Opened';
        const agent = event.metadata ? (() => { try { return JSON.parse(event.metadata).agent; } catch { return ''; } })() : '';
        description = agent ? `Opened with ${agent}` : '';
      } else if (event.eventType === 'click') {
        type = 'email_opened';
        title = 'Link Clicked';
        const url = event.metadata ? (() => { try { return JSON.parse(event.metadata).url; } catch { return ''; } })() : '';
        description = url || '';
      } else if (event.eventType === 'reply') {
        type = 'email_replied';
        title = 'Email Replied';
        description = 'Received a reply';
      } else if (event.eventType === 'bounce') {
        type = 'bounce';
        title = 'Email Bounced';
        description = 'Delivery failed';
      } else if (event.eventType === 'unsubscribe') {
        type = 'status_change';
        title = 'Unsubscribed';
        description = 'Contact opted out';
      } else if (event.eventType === 'complaint') {
        type = 'bounce';
        title = 'Complaint Received';
        description = 'Spam complaint filed';
      }

      timeline.push({
        type,
        title,
        description,
        timestamp: event.createdAt,
      });
    }

    // 6. Reply events
    const replies = await db.reply.findMany({
      where: { contactId: id },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    });

    for (const reply of replies) {
      timeline.push({
        type: 'email_replied',
        title: `Reply Received${reply.category ? ` (${reply.category})` : ''}`,
        description: reply.body ? reply.body.slice(0, 100) + (reply.body.length > 100 ? '...' : '') : '',
        timestamp: reply.receivedAt,
        metadata: { replyId: reply.id, category: reply.category },
      });
    }

    // 7. Bounce events
    const bounces = await db.bounce.findMany({
      where: { contactId: id },
      orderBy: { bouncedAt: 'desc' },
      take: 10,
    });

    for (const bounce of bounces) {
      timeline.push({
        type: 'bounce',
        title: `Bounce (${bounce.bounceType || 'unknown'})`,
        description: bounce.reason || 'No reason provided',
        timestamp: bounce.bouncedAt,
        metadata: { bounceType: bounce.bounceType },
      });
    }

    // 8. Notes
    const notes = await db.contactNote.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const note of notes) {
      timeline.push({
        type: 'note_added',
        title: 'Note Added',
        description: note.body.slice(0, 120) + (note.body.length > 120 ? '...' : ''),
        timestamp: note.createdAt,
        metadata: { noteId: note.id },
      });
    }

    // 9. Audit log events for this contact
    const auditLogs = await db.auditLog.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    for (const log of auditLogs) {
      // Skip if we already have a timeline event for this action
      const existingTypes = new Set(timeline.map(t => t.type));
      if (log.action === 'status_change' || log.action === 'contact_updated') {
        if (!existingTypes.has('status_change') || log.action === 'contact_updated') {
          let desc = log.action;
          if (log.details) {
            try { desc = JSON.stringify(JSON.parse(log.details)); } catch { desc = log.details; }
          }
          timeline.push({
            type: 'status_change',
            title: `Status Updated: ${log.action}`,
            description: desc.slice(0, 120),
            timestamp: log.createdAt,
            metadata: { auditId: log.id },
          });
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.rawName,
        email: contact.email,
        company: contact.company?.rawName,
      },
      timeline,
    });
  } catch (error) {
    console.error('Timeline error:', error);
    return NextResponse.json({ error: 'Failed to load timeline' }, { status: 500 });
  }
}