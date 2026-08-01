import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { calculateLeadScore } from '@/lib/lead-scoring';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * Wave 5.1 — Contact Intelligence Score API
 */

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const contactId = searchParams.get('contactId');
    const segment = searchParams.get('segment');

    if (!companyId && !contactId) return apiError('Provide companyId or contactId', 400);

    if (contactId) {
      const contact = await db.contact.findUnique({
        where: { id: contactId },
        include: { company: true },
      });
      if (!contact) return apiError('Contact not found', 404);

      const breakdown = calculateLeadScore({
        title: contact.title,
        role: contact.role,
        emailHealth: contact.emailHealth,
        emailHealthScore: contact.emailHealthScore,
        linkedinUrl: contact.linkedinUrl,
        phone: contact.phone,
        location: contact.location,
        enrichmentData: contact.enrichmentData ? JSON.stringify(contact.enrichmentData) : null,
        company: contact.company ? {
          industry: contact.company.industry,
          sizeRange: contact.company.sizeRange,
          researchCard: null,
        } : null,
      });

      await db.contact.update({ where: { id: contactId }, data: { leadScore: breakdown.total } });

      return apiSuccess({
        contactId,
        score: breakdown.total,
        breakdown,
        tier: breakdown.total >= 75 ? 'hot' : breakdown.total >= 45 ? 'warm' : 'cold',
        enrichmentStatus: contact.enrichmentData ? 'enriched' : 'basic',
        engagementStatus: contact.engagementScore >= 50 ? 'engaged' : contact.engagementScore >= 20 ? 'active' : 'dormant',
      });
    }

    const contacts = await db.contact.findMany({
      where: companyId ? { companyId } : undefined,
      include: { company: true },
      orderBy: { leadScore: 'desc' },
    });

    const scored = contacts.map(c => {
      const breakdown = calculateLeadScore({
        title: c.title,
        role: c.role,
        emailHealth: c.emailHealth,
        emailHealthScore: c.emailHealthScore,
        linkedinUrl: c.linkedinUrl,
        phone: c.phone,
        location: c.location,
        enrichmentData: c.enrichmentData ? JSON.stringify(c.enrichmentData) : null,
        company: c.company ? {
          industry: c.company.industry,
          sizeRange: c.company.sizeRange,
          researchCard: null,
        } : null,
      });
      return {
        contactId: c.id, name: c.rawName, email: c.email, contactRole: c.role,
        status: c.status, companyId: c.companyId,
        engagementScore: c.engagementScore, ...breakdown,
      };
    });

    const filtered = segment
      ? scored.filter(s => segment === 'hot' ? s.total >= 75 : segment === 'warm' ? s.total >= 45 && s.total < 75 : s.total < 45)
      : scored;

    const tiers = {
      hot: scored.filter(s => s.total >= 75).length,
      warm: scored.filter(s => s.total >= 45 && s.total < 75).length,
      cold: scored.filter(s => s.total < 45).length,
    };

    return apiSuccess({
      total: scored.length, tiers,
      averageScore: scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.total, 0) / scored.length) : 0,
      contacts: filtered.map(c => ({
        contactId: c.contactId, name: c.name, email: c.email, role: c.contactRole,
        status: c.status, companyId: c.companyId,
        score: c.total, tier: c.total >= 75 ? 'hot' : c.total >= 45 ? 'warm' : 'cold',
        topFactors: [
          ...(c.role >= 15 ? ['Strong role fit'] : []),
          ...(c.emailHealth >= 10 ? ['Verified email'] : []),
          ...(c.companyFit >= 15 ? ['Good company fit'] : []),
          ...(c.engagement >= 8 ? ['Recent engagement'] : []),
        ],
      })),
    });
  } catch (error) {
    logger.error('[contact-intelligence] Error:', { error: error });
    return apiError('Failed to compute contact intelligence', 500);
  }
}

export async function POST(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const body = await request.json();
    const { companyId } = body;
    if (!companyId) return apiError('companyId required', 400);

    const contacts = await db.contact.findMany({ where: { companyId }, include: { company: true } });
    let updated = 0;
    for (const c of contacts) {
      const breakdown = calculateLeadScore({
        title: c.title, role: c.role, emailHealth: c.emailHealth,
        emailHealthScore: c.emailHealthScore, linkedinUrl: c.linkedinUrl,
        phone: c.phone, location: c.location, enrichmentData: c.enrichmentData ? JSON.stringify(c.enrichmentData) : null,
        company: c.company ? { industry: c.company.industry, sizeRange: c.company.sizeRange, researchCard: null } : null,
      });
      await db.contact.update({ where: { id: c.id }, data: { leadScore: breakdown.total } });
      updated++;
    }
    return apiSuccess({ updated, message: `Recalculated ${updated} contact scores` });
  } catch (error) {
    logger.error('[contact-intelligence] POST error:', { error: error });
    return apiError('Failed to recalculate scores', 500);
  }
}
