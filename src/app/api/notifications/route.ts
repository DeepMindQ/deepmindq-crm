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

    // Add static notifications if none exist
    if (notifications.length === 0) {
      notifications.push(
        {
          id: 'welcome-1',
          title: 'Welcome to DeepMindQ',
          message: 'Start by importing contacts or exploring the Command Center',
          type: 'system',
          icon: 'Sparkles',
          createdAt: new Date().toISOString(),
          link: '#command-center',
        },
        {
          id: 'tip-1',
          title: 'Try the Research Agent',
          message: 'Deep AI-powered research on any company or person',
          type: 'feature',
          icon: 'Brain',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          link: '#research-agent',
        },
        {
          id: 'tip-2',
          title: 'Create a Sales Playbook',
          message: 'Standardize your outreach with AI-generated playbooks',
          type: 'feature',
          icon: 'BookOpen',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          link: '#playbooks',
        },
      );
    }

    return NextResponse.json(notifications.slice(0, 20));
  } catch {
    // Fallback notifications
    return NextResponse.json([
      { id: 'f1', title: 'System Active', message: 'DeepMindQ is running and ready', type: 'system', icon: 'Activity', createdAt: new Date().toISOString(), link: null },
      { id: 'f2', title: 'Try Research Agent', message: 'AI-powered company research is available', type: 'feature', icon: 'Brain', createdAt: new Date().toISOString(), link: '#research-agent' },
    ]);
  }
}