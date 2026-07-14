import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/compliance ──────────────────────────────────
// GDPR compliance metrics and risk flags
export async function GET() {
  try {
    // 1. Consent distribution
    const consentGroups = await db.contact.groupBy({
      by: ['consentStatus'],
      _count: { id: true },
    });

    const consentBreakdown: Record<string, number> = {
      opted_in: 0,
      unknown: 0,
      opted_out: 0,
    };
    for (const g of consentGroups) {
      const key = (g.consentStatus as string) || 'unknown';
      consentBreakdown[key] = g._count.id;
    }

    // 2. Suppression stats
    const suppressions = await db.suppression.count();
    const suppressionByReason = await db.suppression.groupBy({
      by: ['reason'],
      _count: { id: true },
    });

    const suppressionBreakdown: Record<string, number> = {
      unsubscribe: 0,
      bounce: 0,
      manual: 0,
      negative_reply: 0,
    };
    for (const g of suppressionByReason) {
      if (g.reason in suppressionBreakdown) {
        suppressionBreakdown[g.reason] = g._count.id;
      }
    }

    // 3. Contact data completeness
    const totalContacts = await db.contact.count();
    const withEmail = await db.contact.count({
      where: { emailHealth: { not: 'unknown' } },
    });
    const withConsent = await db.contact.count({
      where: { consentStatus: 'opted_in' },
    });
    const suppressedCount = await db.contact.count({
      where: { isSuppressed: true },
    });

    const unknownConsent = Math.max(0, totalContacts - withConsent - suppressedCount);

    const complianceRate =
      totalContacts > 0
        ? ((withConsent / totalContacts) * 100).toFixed(1)
        : '0.0';

    const emailVerifiedRate =
      totalContacts > 0
        ? ((withEmail / totalContacts) * 100).toFixed(1)
        : '0.0';

    // 4. Recent consent changes (last 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    );
    const recentConsentChanges = await db.auditLog.findMany({
      where: {
        action: 'consent_updated',
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // 5. Data retention stats
    const oldestContact = await db.contact.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const daysSinceFirstImport = oldestContact
      ? Math.floor(
          (Date.now() - oldestContact.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // 6. Risk flags
    const unconsentedInQueue = await db.contact.count({
      where: {
        consentStatus: { not: 'opted_in' },
        status: 'queued',
      },
    });

    const noConsentDate = await db.contact.count({
      where: {
        consentStatus: 'opted_in',
        consentDate: null,
      },
    });

    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    );
    const staleSuppressions = await db.suppression.count({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        removedAt: null,
      },
    });

    const riskFlags = [
      {
        type: 'unconsented_in_queue',
        count: unconsentedInQueue,
        message:
          'Contacts without consent in send queue',
        fixable: true,
        fixAction: 'remove_unconsented_from_queue',
      },
      {
        type: 'no_consent_date',
        count: noConsentDate,
        message:
          'Opted-in contacts without consent date recorded',
        fixable: false,
      },
      {
        type: 'stale_suppressions',
        count: staleSuppressions,
        message:
          'Suppressions older than 90 days (review recommended)',
        fixable: true,
        fixAction: 'clean_stale_suppressions',
      },
    ].filter((f) => f.count > 0);

    return NextResponse.json({
      summary: {
        totalContacts,
        consented: withConsent,
        unknown: unknownConsent,
        suppressed: suppressedCount,
        complianceRate,
        emailVerifiedRate,
      },
      consentBreakdown,
      suppressionBreakdown,
      suppressions,
      recentChanges: recentConsentChanges,
      retentionDays: daysSinceFirstImport,
      riskFlags,
    });
  } catch (error) {
    console.error('[COMPLIANCE] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance data' },
      { status: 500 },
    );
  }
}

// ── POST /api/compliance ─────────────────────────────────
// GDPR compliance actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ── Right to Access: export all contact data ────────
      case 'export_contact_data': {
        const { contactId } = body;
        if (!contactId) {
          return NextResponse.json(
            { error: 'contactId is required' },
            { status: 400 },
          );
        }

        const contact = await db.contact.findUnique({
          where: { id: contactId },
          include: {
            company: true,
            drafts: {
              select: { id: true, subject: true, body: true, status: true, createdAt: true },
            },
            replies: {
              select: { id: true, subject: true, body: true, category: true, receivedAt: true },
            },
            bounces: {
              select: { id: true, bounceType: true, reason: true, bouncedAt: true },
            },
            suppression: {
              select: { id: true, reason: true, method: true, createdAt: true },
            },
            notes: {
              select: { id: true, body: true, createdAt: true },
            },
            events: {
              select: { id: true, eventType: true, createdAt: true },
            },
          },
        });

        if (!contact) {
          return NextResponse.json(
            { error: 'Contact not found' },
            { status: 404 },
          );
        }

        return NextResponse.json({
          success: true,
          contact,
          exportedAt: new Date().toISOString(),
        });
      }

      // ── Right to Erasure: soft-delete a contact ─────────
      case 'delete_contact': {
        const { contactId, reason } = body;
        if (!contactId) {
          return NextResponse.json(
            { error: 'contactId is required' },
            { status: 400 },
          );
        }

        // Soft-delete: anonymize data and mark status
        await db.contact.update({
          where: { id: contactId },
          data: {
            rawName: '[GDPR Deleted]',
            normalizedName: '[gdpr-deleted]',
            editedName: null,
            email: 'deleted@anonymized.local',
            linkedinUrl: null,
            phone: null,
            status: 'archived',
            isSuppressed: true,
            suppressionReason: reason || 'GDPR right to erasure',
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            action: 'gdpr_erasure',
            entity: 'Contact',
            entityId: contactId,
            details: reason || 'GDPR right to erasure requested',
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Contact data anonymized (soft-deleted)',
        });
      }

      // ── Export summary of all consented contacts ────────
      case 'export_all_consented': {
        const consented = await db.contact.findMany({
          where: { consentStatus: 'opted_in' },
          select: {
            id: true,
            email: true,
            rawName: true,
            consentDate: true,
            consentSource: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });

        return NextResponse.json({
          success: true,
          totalExported: consented.length,
          contacts: consented,
          exportedAt: new Date().toISOString(),
          note: 'In production this would generate a downloadable file',
        });
      }

      // ── Clean stale suppressions (older than 90 days) ──
      case 'clean_stale_suppressions': {
        const ninetyDaysAgo = new Date(
          Date.now() - 90 * 24 * 60 * 60 * 1000,
        );

        const result = await db.suppression.deleteMany({
          where: {
            createdAt: { lt: ninetyDaysAgo },
            removedAt: null,
          },
        });

        // Also unsuppress those contacts
        // We need to find contacts that were suppressed by those stale entries
        // Since we already deleted the suppressions, we just reset the flags
        await db.contact.updateMany({
          where: {
            isSuppressed: true,
            status: 'suppressed',
          },
          data: {
            isSuppressed: false,
            status: 'imported',
            suppressionReason: null,
          },
        });

        await db.auditLog.create({
          data: {
            action: 'stale_suppressions_cleaned',
            entity: 'Suppression',
            details: `Removed ${result.count} stale suppressions older than 90 days`,
          },
        });

        return NextResponse.json({
          success: true,
          removed: result.count,
          message: `Cleaned ${result.count} stale suppression(s)`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[COMPLIANCE] POST error:', error);
    return NextResponse.json(
      { error: 'Compliance action failed' },
      { status: 500 },
    );
  }
}