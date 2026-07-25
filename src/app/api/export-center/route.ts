/**
 * Enterprise Export Center API (Wave 9 — Corrected, NO RBAC)
 *
 * GET  /api/export-center — List available exports and export history
 * POST /api/export-center — Request an export job
 *
 * Enterprise customers require data portability.
 * Supports: Companies, Contacts, Opportunities, AI Insights, Activity History
 * Formats: CSV, JSON
 *
 * All exports are synchronous (no async queue needed for dedicated deployment).
 * Export history is tracked for audit compliance.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { sanitizeString } from '@/lib/sanitize';

// ── Types ──

type ExportEntity = 'companies' | 'contacts' | 'opportunities' | 'ai_insights' | 'signals';
type ExportFormat = 'csv' | 'json';

interface ExportJob {
  id: string;
  entity: ExportEntity;
  format: ExportFormat;
  status: 'completed';
  rowCount: number;
  fileSize: string;
  createdAt: string;
}

// ── CSV Helper ──

function escapeCSV(value: string | number | null | undefined | Date): string {
  if (value === null || value === undefined) return '""';
  const raw = typeof value === 'object' ? (value as Date).toISOString() : String(value);
  const str = typeof raw === 'string' ? sanitizeString(raw) : raw;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ── Export Generators ──

async function exportCompanies(format: ExportFormat): Promise<{ data: string; count: number }> {
  const records = await db.company.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
  });

  if (format === 'json') {
    const data = JSON.stringify(records.map(r => ({
      name: r.rawName,
      normalizedName: r.normalizedName,
      domain: r.domain,
      industry: r.industry,
      sizeRange: r.sizeRange,
      country: r.country,
      website: r.website,
      status: r.status,
      lifecycleStage: r.lifecycleStage,
      intelligenceScore: r.intelligenceScore,
      createdAt: r.createdAt,
    })), null, 2);
    return { data, count: records.length };
  }

  // CSV
  const header = ['Name', 'Normalized Name', 'Domain', 'Industry', 'Size', 'Country', 'Website', 'Status', 'Stage', 'Intelligence Score', 'Created'];
  const rows = records.map(r => [
    escapeCSV(r.rawName),
    escapeCSV(r.normalizedName),
    escapeCSV(r.domain),
    escapeCSV(r.industry),
    escapeCSV(r.sizeRange),
    escapeCSV(r.country),
    escapeCSV(r.website),
    escapeCSV(r.status),
    escapeCSV(r.lifecycleStage),
    escapeCSV(r.intelligenceScore),
    escapeCSV(r.createdAt),
  ]);

  return { data: [header.join(','), ...rows.map(r => r.join(','))].join('\n'), count: records.length };
}

async function exportContacts(format: ExportFormat): Promise<{ data: string; count: number }> {
  const records = await db.contact.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
  });

  if (format === 'json') {
    const data = JSON.stringify(records.map(r => ({
      name: r.rawName,
      email: r.email,
      title: r.title,
      role: r.role,
      phone: r.phone,
      linkedin: r.linkedinUrl,
      location: r.location,
      status: r.status,
      leadScore: r.leadScore,
      emailHealth: r.emailHealth,
      companyFitScore: r.companyFitScore,
      engagementScore: r.engagementScore,
      createdAt: r.createdAt,
    })), null, 2);
    return { data, count: records.length };
  }

  const header = ['Name', 'Email', 'Title', 'Role', 'Phone', 'LinkedIn', 'Location', 'Status', 'Lead Score', 'Email Health', 'Company Fit', 'Engagement', 'Created'];
  const rows = records.map(r => [
    escapeCSV(r.rawName),
    escapeCSV(r.email),
    escapeCSV(r.title),
    escapeCSV(r.role),
    escapeCSV(r.phone),
    escapeCSV(r.linkedinUrl),
    escapeCSV(r.location),
    escapeCSV(r.status),
    escapeCSV(r.leadScore),
    escapeCSV(r.emailHealth),
    escapeCSV(r.companyFitScore),
    escapeCSV(r.engagementScore),
    escapeCSV(r.createdAt),
  ]);

  return { data: [header.join(','), ...rows.map(r => r.join(','))].join('\n'), count: records.length };
}

async function exportOpportunities(format: ExportFormat): Promise<{ data: string; count: number }> {
  const records = await db.opportunityRecommendation.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (format === 'json') {
    const data = JSON.stringify(records.map(r => ({
      title: r.opportunityTitle,
      status: r.status,
      confidenceScore: r.confidenceScore,
      score: r.opportunityScore,
      businessTrigger: r.businessTrigger,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })), null, 2);
    return { data, count: records.length };
  }

  const header = ['Title', 'Status', 'Confidence', 'Score', 'Business Trigger', 'Created', 'Updated'];
  const rows = records.map(r => [
    escapeCSV(r.opportunityTitle),
    escapeCSV(r.status),
    escapeCSV(r.confidenceScore),
    escapeCSV(r.opportunityScore),
    escapeCSV(r.businessTrigger),
    escapeCSV(r.createdAt),
    escapeCSV(r.updatedAt),
  ]);

  return { data: [header.join(','), ...rows.map(r => r.join(','))].join('\n'), count: records.length };
}

async function exportAIInsights(format: ExportFormat): Promise<{ data: string; count: number }> {
  const records = await db.aIInsight.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500, // Limit for performance
  });

  if (format === 'json') {
    const data = JSON.stringify(records.map(r => ({
      type: r.type,
      title: r.title,
      description: r.description?.substring(0, 500),
      confidence: r.confidenceScore,
      impact: r.impactScore,
      urgency: r.urgencyScore,
      recommendedAction: r.recommendedAction,
      sourceType: r.sourceType,
      sourceRoute: r.sourceRoute,
      status: r.status,
      createdAt: r.createdAt,
    })), null, 2);
    return { data, count: records.length };
  }

  const header = ['Type', 'Title', 'Description', 'Confidence', 'Impact', 'Urgency', 'Action', 'Source', 'Status', 'Created'];
  const rows = records.map(r => [
    escapeCSV(r.type),
    escapeCSV(r.title),
    escapeCSV(r.description?.substring(0, 500)),
    escapeCSV(r.confidenceScore),
    escapeCSV(r.impactScore),
    escapeCSV(r.urgencyScore),
    escapeCSV(r.recommendedAction),
    escapeCSV(r.sourceType),
    escapeCSV(r.status),
    escapeCSV(r.createdAt),
  ]);

  return { data: [header.join(','), ...rows.map(r => r.join(','))].join('\n'), count: records.length };
}

async function exportSignals(format: ExportFormat): Promise<{ data: string; count: number }> {
  const records = await db.companySignal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  if (format === 'json') {
    const data = JSON.stringify(records.map(r => ({
      title: r.title,
      type: r.signalType,
      severity: r.severity,
      confidence: r.confidence,
      source: r.source,
      status: r.status,
      businessImpact: r.businessImpact,
      createdAt: r.createdAt,
    })), null, 2);
    return { data, count: records.length };
  }

  const header = ['Title', 'Type', 'Severity', 'Confidence', 'Source', 'Status', 'Impact', 'Created'];
  const rows = records.map(r => [
    escapeCSV(r.title),
    escapeCSV(r.signalType),
    escapeCSV(r.severity),
    escapeCSV(r.confidence),
    escapeCSV(r.source),
    escapeCSV(r.status),
    escapeCSV(r.businessImpact),
    escapeCSV(r.createdAt),
  ]);

  return { data: [header.join(','), ...rows.map(r => r.join(','))].join('\n'), count: records.length };
}

// ── Export History (audit) ──

async function logExport(entity: ExportEntity, format: ExportFormat, rowCount: number) {
  try {
    await db.auditLog.create({
      data: {
        action: 'export',
        entity: entity,
        userId: 'system',
        details: `Exported ${rowCount} ${entity} records as ${format.toUpperCase()}`,
      },
    });
  } catch (e) {
    console.warn('[export-center] Failed to log export audit:', e);
  }
}

// ── Route Handlers ──

export async function GET() {
  try {
    const availableExports: Array<{ entity: ExportEntity; label: string; description: string }> = [
      { entity: 'companies', label: 'Companies', description: 'All company accounts with industry, size, and intelligence data' },
      { entity: 'contacts', label: 'Contacts', description: 'All contacts with scores, engagement status, and enrichment data' },
      { entity: 'opportunities', label: 'Opportunities', description: 'All opportunity recommendations with scores and status' },
      { entity: 'ai_insights', label: 'AI Insights', description: 'AI-generated insights, recommendations, and forecasts (last 500)' },
      { entity: 'signals', label: 'Signals', description: 'All detected company signals (last 500)' },
    ];

    const formats: Array<{ value: ExportFormat; label: string }> = [
      { value: 'csv', label: 'CSV (Comma-Separated Values)' },
      { value: 'json', label: 'JSON (Structured Data)' },
    ];

    // Export history from audit log
    const exportHistory = await db.auditLog.findMany({
      where: { action: 'export', entity: 'export' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return apiSuccess({
      availableExports,
      formats,
      exportHistory: exportHistory.map(e => ({
        entity: e.entity,
        action: e.action,
        details: e.details,
        user: e.userId,
        timestamp: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[export-center] GET Error:', error);
    return apiError('Failed to load export center', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, format = 'csv' } = body;

    const validEntities: ExportEntity[] = ['companies', 'contacts', 'opportunities', 'ai_insights', 'signals'];
    const validFormats: ExportFormat[] = ['csv', 'json'];

    if (!entity || !validEntities.includes(entity)) {
      return apiError(`Invalid entity. Must be one of: ${validEntities.join(', ')}`, 400);
    }
    if (!validFormats.includes(format)) {
      return apiError(`Invalid format. Must be one of: ${validFormats.join(', ')}`, 400);
    }

    // Generate export
    let result: { data: string; count: number } = { data: '', count: 0 };

    switch (entity) {
      case 'companies':
        result = await exportCompanies(format);
        break;
      case 'contacts':
        result = await exportContacts(format);
        break;
      case 'opportunities':
        result = await exportOpportunities(format);
        break;
      case 'ai_insights':
        result = await exportAIInsights(format);
        break;
      case 'signals':
        result = await exportSignals(format);
        break;
    }

    // Log export for audit
    await logExport(entity, format, result.count);

    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `deepmindq_${entity}_${new Date().toISOString().split('T')[0]}.${format}`;

    // Return as downloadable response
    return new Response(result.data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[export-center] POST Error:', error);
    return apiError('Failed to generate export', 500);
  }
}
