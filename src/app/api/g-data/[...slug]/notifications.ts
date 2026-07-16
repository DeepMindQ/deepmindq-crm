import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/notifications — Pull recent activity as notifications
export async function GET() {
  try {
    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      icon: string;
      createdAt: string;
      link: string | null;
    }> = [];

    // Recent signals
    try {
      const signals = await db.companySignal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { company: { select: { rawName: true } } },
      });
      signals.forEach(s => {
        notifications.push({
          id: `signal-${s.id}`,
          title: `Signal: ${s.title}`,
          message: `${s.company?.rawName || 'Unknown company'} — ${s.signalType.replace(/_/g, ' ')}`,
          type: 'signal',
          icon: 'Radar',
          createdAt: s.createdAt.toISOString(),
          link: s.companyId ? `#companies` : null,
        });
      });
    } catch { /* skip */ }

    // Recent replies
    try {
      const replies = await db.reply.findMany({
        orderBy: { receivedAt: 'desc' },
        take: 3,
        include: { contact: { select: { rawName: true } } },
      });
      replies.forEach(r => {
        notifications.push({
          id: `reply-${r.id}`,
          title: 'New reply received',
          message: `${r.contact?.rawName || 'Contact'} — ${r.category || 'reply'}`,
          type: 'reply',
          icon: 'Mail',
          createdAt: r.receivedAt.toISOString(),
          link: '#replies',
        });
      });
    } catch { /* skip */ }

    // Recent audit entries (system notifications)
    try {
      const audits = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
      });
      audits.forEach(a => {
        notifications.push({
          id: `audit-${a.id}`,
          title: a.action,
          message: `${a.entity}${a.entityId ? ` #${a.entityId.slice(0, 8)}` : ''}`,
          type: 'system',
          icon: 'Activity',
          createdAt: a.createdAt.toISOString(),
          link: '#audit',
        });
      });
    } catch { /* skip */ }

    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(notifications.slice(0, 20));
  } catch {
    return NextResponse.json([]);
  }
}