import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const contactId = searchParams.get('contactId');

    if (!companyId && !contactId) return apiError('Provide companyId or contactId', 400);

    const now = Date.now();
    const day = 86400000;

    if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      });
      if (!contact) return apiError('Contact not found', 404);

      const engagementTimeline = await db.companyTimelineEvent.findMany({
        where: { companyId: contact.companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const lastContactedDays = contact.lastContactedAt
        ? Math.floor((now - contact.lastContactedAt.getTime()) / day) : null;

      const engagementLevel = contact.engagementScore >= 60 ? 'highly_engaged'
        : contact.engagementScore >= 30 ? 'engaged'
        : contact.engagementScore >= 10 ? 'low_engagement' : 'dormant';

      return apiSuccess({
        contactId, name: contact.rawName, email: contact.email,
        engagementScore: contact.engagementScore, engagementLevel,
        riskOfChurn: engagementLevel === 'dormant' ? 'high' : engagementLevel === 'low_engagement' ? 'medium' : 'low',
        lastContactedDaysAgo: lastContactedDays, status: contact.status,
        recentTimeline: engagementTimeline.map(e => ({ type: e.eventType, title: e.title, date: e.createdAt })),
        suggestedAction: engagementLevel === 'dormant' ? 'Re-engage immediately'
          : engagementLevel === 'low_engagement' ? 'Schedule check-in within 3 days' : 'Maintain cadence',
      });
    }

    const contacts = await db.contact.findMany({
      where: companyId ? { companyId } : undefined,
      take: 200,
      orderBy: { engagementScore: 'desc' },
    });

    const engDist = {
      highly_engaged: contacts.filter(c => c.engagementScore >= 60).length,
      engaged: contacts.filter(c => c.engagementScore >= 30 && c.engagementScore < 60).length,
      low_engagement: contacts.filter(c => c.engagementScore >= 10 && c.engagementScore < 30).length,
      dormant: contacts.filter(c => c.engagementScore < 10).length,
    };

    const statusDist: Record<string, number> = {};
    for (const c of contacts) statusDist[c.status] = (statusDist[c.status] || 0) + 1;

    const avgEng = contacts.length > 0 ? Math.round(contacts.reduce((s, c) => s + c.engagementScore, 0) / contacts.length) : 0;
    const recent7d = contacts.filter(c => c.lastContactedAt && (now - c.lastContactedAt.getTime()) < 7 * day).length;

    const dormant = contacts.filter(c => {
      if (['suppressed', 'bounced', 'archived'].includes(c.status)) return false;
      return c.engagementScore < 10 && (!c.lastContactedAt || (now - c.lastContactedAt.getTime()) > 30 * day);
    });

    const enrichRate = contacts.length > 0 ? Math.round((contacts.filter(c => !!c.enrichmentData).length / contacts.length) * 100) : 0;

    return apiSuccess({
      totalContacts: contacts.length, avgEngagementScore: avgEng,
      engagementDistribution: engDist, statusDistribution: statusDist,
      enrichmentRate: enrichRate, recentlyContacted7d: recent7d,
      needsAttention: dormant.length,
      dormantContacts: dormant.slice(0, 10).map(c => ({
        contactId: c.id, name: c.rawName, email: c.email,
        engagementScore: c.engagementScore, lastContactedAt: c.lastContactedAt,
      })),
    });
  } catch (error) {
    logger.error('[contact-engagement] Error:', { error: error });
    return apiError('Failed to compute engagement analytics', 500);
  }
}
