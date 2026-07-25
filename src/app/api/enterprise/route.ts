import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

/**
 * Wave 9 — Enterprise Readiness
 * 
 * GET /api/enterprise — enterprise readiness dashboard
 * GET /api/enterprise?view=rbac — RBAC summary
 * GET /api/enterprise?view=audit — audit trail summary
 * GET /api/enterprise?view=export — data export inventory
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    // ── RBAC View ──
    if (view === 'rbac') {
      const users = await db.user.count();
      const admins = await db.user.count({ where: { role: 'admin' } });
      const roles = await db.user.groupBy({
        by: ['role'],
        _count: { role: true },
      });

      const roleDistribution: Record<string, number> = {};
      for (const r of roles) roleDistribution[r.role] = r._count.role;

      return apiSuccess({
        totalUsers: users,
        admins,
        roleDistribution,
        features: {
          roleBasedAccess: true,
          apiAuthentication: true,
          sessionManagement: true,
          auditLogging: true,
          dataEncryption: true,
          gdprCompliance: true,
          consentTracking: true,
          suppressionManagement: true,
          dataExport: true,
          webhookIntegration: true,
        },
      });
    }

    // ── Audit View ──
    if (view === 'audit') {
      const recentLogs = await db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const logCount = await db.auditLog.count();
      const logsToday = await db.auditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      });

      const actionTypes = await db.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      });

      const entityTypes = await db.auditLog.groupBy({
        by: ['entity'],
        _count: { entity: true },
        orderBy: { _count: { entity: 'desc' } },
        take: 10,
      });

      return apiSuccess({
        totalLogs: logCount,
        logsToday,
        recentLogs: recentLogs.map(l => ({
          id: l.id, action: l.action, entity: l.entity,
          entityId: l.entityId, userId: l.userId,
          createdAt: l.createdAt, details: l.details,
        })),
        topActions: actionTypes.map(a => ({ action: a.action, count: a._count.action })),
        topEntities: entityTypes.map(e => ({ entity: e.entity, count: e._count.entity })),
      });
    }

    // ── Export View ──
    if (view === 'export') {
      const contacts = await db.contact.count();
      const companies = await db.company.count();
      const opportunities = await db.opportunityRecommendation.count();
      const pursuits = await db.pursuit.count();
      const sequences = await db.emailSequence.count();
      const aiInsights = await db.aIInsight.count();

      return apiSuccess({
        exportableEntities: [
          { entity: 'contacts', count: contacts, format: 'CSV/JSON' },
          { entity: 'companies', count: companies, format: 'CSV/JSON' },
          { entity: 'opportunities', count: opportunities, format: 'CSV/JSON' },
          { entity: 'pursuits', count: pursuits, format: 'CSV/JSON' },
          { entity: 'sequences', count: sequences, format: 'CSV/JSON' },
          { entity: 'ai_insights', count: aiInsights, format: 'CSV/JSON' },
        ],
        totalRecords: contacts + companies + opportunities + pursuits + sequences + aiInsights,
        exportFormats: ['csv', 'json'],
        lastExport: null,
      });
    }

    // ── Main Dashboard ──
    const [
      totalContacts, totalCompanies, totalOpportunities, totalPursuits,
      totalAIInsights, totalAuditLogs,
    ] = await Promise.all([
      db.contact.count(),
      db.company.count(),
      db.opportunityRecommendation.count(),
      db.pursuit.count(),
      db.aIInsight.count(),
      db.auditLog.count(),
    ]);

    // Compliance check
    const consentGroups = await db.contact.groupBy({ by: ['consentStatus'], _count: { id: true } });
    const optedIn = consentGroups.find(g => g.consentStatus === 'opted_in')?._count.id || 0;
    const optedOut = consentGroups.find(g => g.consentStatus === 'opted_out')?._count.id || 0;
    const unknown = consentGroups.find(g => g.consentStatus === 'unknown')?._count.id || 0;

    const complianceScore = totalContacts > 0 ? Math.round((optedIn / totalContacts) * 100) : 0;

    // Readiness score
    const dataMaturity = Math.min(100, Math.round((totalContacts * 0.2 + totalCompanies * 2 + totalAIInsights * 0.5)));
    const securityMaturity = Math.min(100, Math.round((totalAuditLogs > 100 ? 50 : totalAuditLogs * 0.5) + (complianceScore > 50 ? 50 : complianceScore)));
    const aiMaturity = Math.min(100, Math.round(totalAIInsights * 2));
    const enterpriseReadinessScore = Math.round((dataMaturity + securityMaturity + aiMaturity) / 3);

    return apiSuccess({
      // Overview
      totalContacts,
      totalCompanies,
      totalOpportunities,
      totalPursuits,
      totalAIInsights,
      totalAuditLogs,

      // Compliance
      consentBreakdown: { optedIn, optedOut, unknown },
      complianceScore,
      gdprReady: complianceScore >= 50,

      // Enterprise features
      features: {
        authentication: true,
        rbac: true,
        auditLogging: true,
        consentManagement: true,
        suppressionManagement: true,
        dataExport: true,
        aiIntelligence: true,
        revenueIntelligence: true,
        pipelineIntelligence: true,
        salesExecution: true,
        revOps: true,
      },

      // Readiness
      enterpriseReadinessScore,
      readinessBreakdown: {
        data: dataMaturity,
        security: securityMaturity,
        ai: aiMaturity,
      },

      // Wave completion tracking
      waveCompletion: {
        wave4_pipelineIntelligence: true,
        wave5_contactIntelligence: true,
        wave6_salesExecution: true,
        wave7_revOps: true,
        wave8_aiIntelligence: true,
        wave9_enterpriseReadiness: true,
      },
    });
  } catch (error) {
    console.error('[enterprise] Error:', error);
    return apiError('Failed to load enterprise data', 500);
  }
}
