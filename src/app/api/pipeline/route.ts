import { NextResponse } from 'next/server';
import { tokens } from '@/lib/design-tokens';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

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

export async function GET(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

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

    // Return empty stages when no data
    if (totalLeads === 0) {
      return NextResponse.json({
        stages: [
          { key: 'imported', label: 'Imported', count: 0, color: '#71717a' },
          { key: 'verified', label: 'Verified', count: 0, color: tokens.accent.bright },
          { key: 'drafted', label: 'Drafted', count: 0, color: tokens.extended.amber.value },
          { key: 'approved', label: 'Approved', count: 0, color: tokens.extended.violet.value },
          { key: 'queued', label: 'Queued', count: 0, color: tokens.flat.skyBlue },
          { key: 'sent', label: 'Sent', count: 0, color: tokens.extended.emerald.value },
          { key: 'replied', label: 'Replied', count: 0, color: tokens.domain.action },
          { key: 'bounced', label: 'Bounced', count: 0, color: tokens.extended.rose.value },
          { key: 'suppressed', label: 'Suppressed', count: 0, color: tokens.neutral['400'] },
        ],
        totalLeads: 0,
        conversionRate: 0,
        deliveryRate: 0,
        replyRate: 0,
        bounceRate: 0,
      });
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
      { key: 'verified', label: 'Verified', count: verified, color: tokens.accent.bright },
      { key: 'drafted', label: 'Drafted', count: drafted, color: tokens.extended.amber.value },
      { key: 'approved', label: 'Approved', count: approved, color: tokens.extended.violet.value },
      { key: 'queued', label: 'Queued', count: queued, color: tokens.flat.skyBlue },
      { key: 'sent', label: 'Sent', count: sent, color: tokens.extended.emerald.value },
      { key: 'replied', label: 'Replied', count: replied, color: tokens.domain.action },
      { key: 'bounced', label: 'Bounced', count: bounced, color: tokens.extended.rose.value },
      { key: 'suppressed', label: 'Suppressed', count: suppressed, color: tokens.neutral['400'] },
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
    logger.error('Pipeline error:', { error: error });
    return NextResponse.json({ error: 'Failed to load pipeline data' }, { status: 500 });
  }
}