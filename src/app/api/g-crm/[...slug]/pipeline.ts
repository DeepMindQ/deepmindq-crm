import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Demo pipeline data — shown when DB is unavailable
   ═══════════════════════════════════════════════════ */
const DEMO_PIPELINE = {
  stages: [
    { key: 'imported', label: 'Imported', count: 355, color: '#71717a' },
    { key: 'verified', label: 'Verified', count: 280, color: '#60a5fa' },
    { key: 'drafted', label: 'Drafted', count: 45, color: '#fbbf24' },
    { key: 'approved', label: 'Approved', count: 12, color: '#c084fc' },
    { key: 'queued', label: 'Queued', count: 8, color: '#818cf8' },
    { key: 'sent', label: 'Sent', count: 67, color: '#34d399' },
    { key: 'replied', label: 'Replied', count: 23, color: '#22c55e' },
    { key: 'bounced', label: 'Bounced', count: 5, color: '#f87171' },
    { key: 'suppressed', label: 'Suppressed', count: 12, color: '#94a3b8' },
  ],
  totalLeads: 355,
  conversionRate: 6.5,
  deliveryRate: 93.1,
  replyRate: 34.3,
  bounceRate: 7.0,
};

// Map of DB status values to pipeline stage keys
const STAGE_STATUS_MAP: Record<string, string> = {
  imported: 'imported',
  cleaned: 'verified',
  drafted: 'drafted',
  queued: 'queued',
  sent: 'sent',
  replied: 'replied',
  bounced: 'bounced',
  suppressed: 'suppressed',
};

export async function GET() {
  try {
    // Fetch status counts from the database
    const statusGroups = await db.contact.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Also fetch approval counts from drafts
    const draftStatusGroups = await db.draft.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Build status count map from contacts
    const statusCounts: Record<string, number> = {};
    for (const group of statusGroups as { status: string; _count: { status: number } }[]) {
      statusCounts[group.status] = group._count.status;
    }

    // Build draft status map
    const draftCounts: Record<string, number> = {};
    for (const group of draftStatusGroups as { status: string; _count: { status: number } }[]) {
      draftCounts[group.status] = group._count.status;
    }

    const totalLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    // If no real data, return demo data
    if (totalLeads === 0) {
      return NextResponse.json({ ...DEMO_PIPELINE, _demo: true });
    }

    // Build pipeline stages from DB data
    const imported = statusCounts['imported'] || 0;
    const verified = statusCounts['cleaned'] || 0;
    const drafted = statusCounts['drafted'] || 0;
    const approved = draftCounts['approved'] || 0;
    const queued = statusCounts['queued'] || 0;
    const sent = statusCounts['sent'] || 0;
    const replied = statusCounts['replied'] || 0;
    const bounced = statusCounts['bounced'] || 0;
    const suppressed = statusCounts['suppressed'] || 0;

    const totalSent = sent;
    const totalReplied = replied;
    const totalBounced = bounced;
    const totalDelivered = totalSent - totalBounced;

    const stages = [
      { key: 'imported', label: 'Imported', count: imported, color: '#71717a' },
      { key: 'verified', label: 'Verified', count: verified, color: '#60a5fa' },
      { key: 'drafted', label: 'Drafted', count: drafted, color: '#fbbf24' },
      { key: 'approved', label: 'Approved', count: approved, color: '#c084fc' },
      { key: 'queued', label: 'Queued', count: queued, color: '#818cf8' },
      { key: 'sent', label: 'Sent', count: sent, color: '#34d399' },
      { key: 'replied', label: 'Replied', count: replied, color: '#22c55e' },
      { key: 'bounced', label: 'Bounced', count: bounced, color: '#f87171' },
      { key: 'suppressed', label: 'Suppressed', count: suppressed, color: '#94a3b8' },
    ];

    return NextResponse.json({
      stages,
      totalLeads,
      conversionRate: totalLeads > 0 ? parseFloat(((totalReplied / totalLeads) * 100).toFixed(1)) : 0,
      deliveryRate: totalSent > 0 ? parseFloat(((totalDelivered / totalSent) * 100).toFixed(1)) : 100,
      replyRate: totalSent > 0 ? parseFloat(((totalReplied / totalSent) * 100).toFixed(1)) : 0,
      bounceRate: totalSent > 0 ? parseFloat(((totalBounced / totalSent) * 100).toFixed(1)) : 0,
    });
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: 'Failed to load pipeline data' }, { status: 500 });
  }
}