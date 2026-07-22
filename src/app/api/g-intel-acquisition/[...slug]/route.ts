/**
 * Phase 7.5: Intelligence Acquisition API
 *
 * Catch-all route handling all intelligence acquisition endpoints:
 * - Connector CRUD
 * - Upload & Preview (CSV/Excel)
 * - Connector Runs
 * - Company Resolution
 * - Knowledge Fabric queries
 * - Dashboard Stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAction } from '@/lib/audit';
import { checkApiAuth } from '@/lib/api-auth';
import {
  CsvConnector,
  ExcelConnector,
  WebsiteConnector,
  RssConnector,
  registerJobProcessor,
  enqueueJob,
  resolveCompany,
  confirmResolution,
  processAcquisitionResult,
  getCompanyKnowledge,
  getKnowledgeByCategory,
} from '@/lib/intelligence-sources';
import type { IConnector, SourceType, ColumnMapping } from '@/lib/intelligence-sources';
import type { AcquisitionContext } from '@/lib/intelligence-sources/acquisition-engine';
import type { QueuedJob } from '@/lib/intelligence-sources/job-queue';
import {
  detectDuplicates,
  createAssociation,
  detectConflicts,
  mergeDuplicates,
  resolveAssociation as resolveAssociationAction,
  getAssociations,
} from '@/lib/intelligence-sources/association-engine';
import {
  recalculateObjectConfidence,
  recalculateCompanyConfidence,
  calculateConfidence,
  generateConfidenceExplanation,
} from '@/lib/intelligence-sources/confidence-engine';
import type { ConfidenceResult } from '@/lib/intelligence-sources/confidence-engine';
import {
  getVersionHistory,
  compareVersions,
  restoreVersion,
  createVersionSnapshot,
} from '@/lib/intelligence-sources/knowledge-versioning';
import {
  calculateSourceHealth,
  getAllSourceHealth,
  getGovernanceReport,
  flagStaleSources,
  recalculateAllHealth,
} from '@/lib/intelligence-sources/source-governance';
// Sprint 3: Human Intelligence, Timeline, Scheduler, Alerts, Analytics
import { submitToIntelligenceInbox, reviewInboxItem, convertApprovedItem, getInboxItems, getInboxItem, getInboxStats, updateInboxItem } from '@/lib/intelligence-sources/human-intelligence';
import { logTimelineEvent, getCompanyTimeline, getRecentEvents } from '@/lib/intelligence-sources/intelligence-timeline';
import { getScheduledConnectors, getDueConnectors, triggerScheduledRun, runAllDueConnectors, getScheduleOverview, updateScheduleFrequency } from '@/lib/intelligence-sources/connector-scheduler';
import { createAlert, acknowledgeAlert, resolveAlert as resolveAlertAction, dismissAlert as dismissAlertAction, getAlerts, getAlertSummary, autoGenerateAlerts } from '@/lib/intelligence-sources/intelligence-alerts';
import { getIntelligenceOverview, getAcquisitionTrends, getConfidenceDistribution, getKnowledgeCoverage, getSourcePerformance, getActivityFeed } from '@/lib/intelligence-sources/analytics-dashboard';

// ─── Module-scope connector factories ────────────────────────────

function instantiateConnector(sourceType: SourceType): IConnector {
  switch (sourceType) {
    case 'csv': return new CsvConnector();
    case 'excel': return new ExcelConnector();
    case 'website': return new WebsiteConnector();
    case 'rss': return new RssConnector();
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

// ─── Register job processor at module scope ─────────────────────

registerJobProcessor(async (job: QueuedJob) => {
  const connector = await db.connector.findUnique({ where: { id: job.connectorId } });
  if (!connector) throw new Error(`Connector not found: ${job.connectorId}`);

  const sourceType = connector.sourceType as SourceType;
  const conn = instantiateConnector(sourceType);

  const ctx: AcquisitionContext = {
    connectorId: connector.id,
    connectorRunId: job.id,
    connector: conn,
    defaultCategory: (job.payload.config as Record<string, unknown>).category as string | undefined,
  };

  const result = await conn.acquire({ ...job.payload.config, ...parseJsonConfig(connector.config) });
  await processAcquisitionResult(result, ctx);
});

function parseJsonConfig(jsonStr: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

// ─── Simple CSV parser for preview ──────────────────────────────

function simpleCsvParse(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === '\r' && next === '\n') { lines.push(current); current = ''; i++; }
      else if (ch === '\n') { lines.push(current); current = ''; }
      else { current += ch; }
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return { headers: [], rows: [] };

  const headerParts: string[] = [];
  let hc = '';
  let hq = false;
  for (const ch of lines[0]!) {
    if (hq) {
      if (ch === '"') hq = false;
      else hc += ch;
    } else if (ch === '"') { hq = true; }
    else if (ch === ',') { headerParts.push(hc.trim()); hc = ''; }
    else hc += ch;
  }
  headerParts.push(hc.trim());
  const headers = headerParts.filter(Boolean);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fieldParts: string[] = [];
    let fc = '';
    let fq = false;
    for (const ch of lines[i]!) {
      if (fq) {
        if (ch === '"') fq = false;
        else fc += ch;
      } else if (ch === '"') { fq = true; }
      else if (ch === ',') { fieldParts.push(fc.trim()); fc = ''; }
      else fc += ch;
    }
    fieldParts.push(fc.trim());

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (fieldParts[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

const COMPANY_HEADER_PATTERNS = [
  'company', 'account name', 'organization', 'customer', 'account',
  'company name', 'organisation', 'firm', 'client', 'account_name',
  'company_name', 'org', 'org name',
];

function detectCompanyColumn(headers: string[]): string | null {
  for (const header of headers) {
    if (COMPANY_HEADER_PATTERNS.includes(header.trim().toLowerCase())) {
      return header;
    }
  }
  return null;
}

// ─── Route helpers ──────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RouteMatch {
  handler: (method: HttpMethod, req: NextRequest, params: Record<string, string>) => Promise<Response>;
  params: Record<string, string>;
}

function keyToRegex(key: string): { regex: RegExp; paramNames: string[] } {
  const parts = key.split('/');
  const regexParts: string[] = [];
  const paramNames: string[] = [];
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      paramNames.push(inner);
      regexParts.push('([^/]+)');
    } else {
      regexParts.push(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  return { regex: new RegExp('^' + regexParts.join('/') + '$'), paramNames };
}

function matchRoute(slug: string[]): RouteMatch | null {
  const path = slug.join('/');
  for (const route of ROUTES) {
    const { regex, paramNames } = keyToRegex(route.key);
    const match = path.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1] || ''; });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// ─── Route registry & handlers ──────────────────────────────────

const ROUTES: Array<{ key: string; handler: (method: HttpMethod, req: NextRequest, params: Record<string, string>) => Promise<Response> }> = [
  { key: 'connectors', handler: handleConnectors },
  { key: 'connectors/[id]', handler: handleConnectorById },
  { key: 'connectors/[id]/run', handler: handleConnectorRun },
  { key: 'connectors/[id]/runs', handler: handleConnectorRuns },
  { key: 'runs', handler: handleRecentRuns },
  { key: 'upload/preview', handler: handleUploadPreview },
  { key: 'upload/acquire', handler: handleUploadAcquire },
  { key: 'runs/[id]', handler: handleRunById },
  { key: 'resolve-company', handler: handleResolveCompany },
  { key: 'confirm-resolution', handler: handleConfirmResolution },
  { key: 'knowledge', handler: handleKnowledge },
  { key: 'knowledge/[id]', handler: handleKnowledgeById },
  { key: 'stats', handler: handleStats },
  // Sprint 2: Association & Dedup
  { key: 'associations', handler: handleAssociations },
  { key: 'associations/detect-duplicates', handler: handleDetectDuplicates },
  { key: 'associations/detect-conflicts', handler: handleDetectConflicts },
  { key: 'associations/merge', handler: handleMergeDuplicates },
  { key: 'associations/resolve', handler: handleResolveAssociation },
  // Sprint 2: Confidence
  { key: 'confidence/recalculate', handler: handleRecalculateConfidence },
  { key: 'intelligence-objects/[id]/confidence', handler: handleObjectConfidence },
  // Sprint 2: Knowledge Versioning
  { key: 'knowledge/[id]/versions', handler: handleKnowledgeVersions },
  { key: 'knowledge/[id]/versions/compare', handler: handleCompareVersions },
  { key: 'knowledge/[id]/versions/restore', handler: handleRestoreVersion },
  // Sprint 2: Source Governance
  { key: 'source-health', handler: handleSourceHealth },
  { key: 'governance', handler: handleGovernance },
  // Sprint 3: Human Intelligence Inbox
  { key: 'inbox', handler: handleInbox },
  { key: 'inbox/[id]', handler: handleInboxById },
  { key: 'inbox/[id]/review', handler: handleInboxReview },
  { key: 'inbox/[id]/convert', handler: handleInboxConvert },
  { key: 'inbox/stats', handler: handleInboxStats },
  // Sprint 3: Timeline
  { key: 'timeline', handler: handleTimeline },
  { key: 'timeline/recent', handler: handleRecentTimeline },
  // Sprint 3: Scheduler
  { key: 'scheduler/overview', handler: handleSchedulerOverview },
  { key: 'scheduler/due', handler: handleSchedulerDue },
  { key: 'scheduler/trigger/[id]', handler: handleSchedulerTrigger },
  { key: 'scheduler/run-all-due', handler: handleSchedulerRunAllDue },
  // Sprint 3: Alerts
  { key: 'alerts', handler: handleAlerts },
  { key: 'alerts/summary', handler: handleAlertSummary },
  { key: 'alerts/[id]/acknowledge', handler: handleAlertAcknowledge },
  { key: 'alerts/[id]/resolve', handler: handleAlertResolve },
  // Sprint 3: Analytics
  { key: 'analytics/overview', handler: handleAnalyticsOverview },
  { key: 'analytics/trends', handler: handleAnalyticsTrends },
  { key: 'analytics/confidence-distribution', handler: handleAnalyticsConfidenceDistribution },
  { key: 'analytics/knowledge-coverage', handler: handleAnalyticsKnowledgeCoverage },
  { key: 'analytics/source-performance', handler: handleAnalyticsSourcePerformance },
  { key: 'analytics/activity-feed', handler: handleAnalyticsActivityFeed },
];

// ═══════════════════════════════════════════════════════════════
//  CONNECTOR CRUD
// ═══════════════════════════════════════════════════════════════

async function handleConnectors(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return listConnectors(req);
  if (method === 'POST') return createConnector(req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function handleConnectorById(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return getConnector(params.id);
  if (method === 'PATCH') return updateConnector(params.id, req);
  if (method === 'DELETE') return deleteConnector(params.id);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// GET /api/g-intel-acquisition/connectors
async function listConnectors(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type');

    const connectors = await db.connector.findMany({
      where: typeFilter ? { sourceType: typeFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });

    return NextResponse.json({ connectors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list connectors', detail: message }, { status: 500 });
  }
}

// POST /api/g-intel-acquisition/connectors
async function createConnector(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { name, sourceType, config, scheduleFrequency } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required and must be a non-empty string' }, { status: 400 });
    }

    const validTypes: SourceType[] = ['csv', 'excel', 'website', 'rss'];
    if (!sourceType || !validTypes.includes(sourceType)) {
      return NextResponse.json({ error: `sourceType is required and must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const validFrequencies = ['manual', 'hourly', 'daily', 'weekly'];
    if (scheduleFrequency && !validFrequencies.includes(scheduleFrequency)) {
      return NextResponse.json({ error: `scheduleFrequency must be one of: ${validFrequencies.join(', ')}` }, { status: 400 });
    }

    const connector = await db.connector.create({
      data: {
        name: name.trim(),
        sourceType,
        config: config ? JSON.stringify(config) : '{}',
        scheduleFrequency: scheduleFrequency ?? 'manual',
        status: 'active',
      },
    });

    await logAction('create', 'Connector', connector.id, { name, sourceType, scheduleFrequency });

    return NextResponse.json({ connector }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create connector', detail: message }, { status: 500 });
  }
}

// GET /api/g-intel-acquisition/connectors/[id]
async function getConnector(id: string): Promise<Response> {
  try {
    const connector = await db.connector.findUnique({
      where: { id },
      include: { _count: { select: { runs: true } } },
    });

    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    return NextResponse.json({ connector });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get connector', detail: message }, { status: 500 });
  }
}

// PATCH /api/g-intel-acquisition/connectors/[id]
async function updateConnector(id: string, req: NextRequest): Promise<Response> {
  try {
    const existing = await db.connector.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, config, status, scheduleFrequency } = body;

    const validStatuses = ['active', 'paused', 'disabled', 'failed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const validFrequencies = ['manual', 'hourly', 'daily', 'weekly'];
    if (scheduleFrequency && !validFrequencies.includes(scheduleFrequency)) {
      return NextResponse.json({ error: `scheduleFrequency must be one of: ${validFrequencies.join(', ')}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === 'string' ? name.trim() : name;
    if (config !== undefined) updateData.config = typeof config === 'string' ? config : JSON.stringify(config);
    if (status !== undefined) updateData.status = status;
    if (scheduleFrequency !== undefined) updateData.scheduleFrequency = scheduleFrequency;

    const connector = await db.connector.update({
      where: { id },
      data: updateData,
    });

    await logAction('update', 'Connector', id, { changes: Object.keys(updateData) });

    return NextResponse.json({ connector });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update connector', detail: message }, { status: 500 });
  }
}

// DELETE /api/g-intel-acquisition/connectors/[id]
async function deleteConnector(id: string): Promise<Response> {
  try {
    const existing = await db.connector.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Cascade delete runs, then the connector
    await db.connectorRun.deleteMany({ where: { connectorId: id } });
    await db.connector.delete({ where: { id } });

    await logAction('delete', 'Connector', id, { name: existing.name, sourceType: existing.sourceType });

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to delete connector', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  UPLOAD & PREVIEW
// ═══════════════════════════════════════════════════════════════

async function handleUploadPreview(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return previewFile(req);
}

async function handleUploadAcquire(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return acquireFromFile(req);
}

// POST /api/g-intel-acquisition/upload/preview
async function previewFile(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided. Send a file using FormData field "file".' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv') || file.type === 'text/csv' || (!isExcel && !fileName.endsWith('.json'));

    if (!isCsv && !isExcel) {
      return NextResponse.json({ error: 'Unsupported file type. Only CSV and Excel (.xlsx, .xls) files are supported.' }, { status: 400 });
    }

    if (isCsv) {
      const text = await file.text();
      const { headers, rows } = simpleCsvParse(text);

      if (headers.length === 0) {
        return NextResponse.json({ error: 'Could not parse CSV headers. File may be empty or malformed.' }, { status: 400 });
      }

      const preview = rows.slice(0, 5);
      const detectedCompanyColumn = detectCompanyColumn(headers);

      return NextResponse.json({
        columns: headers,
        rowCount: rows.length,
        preview,
        detectedCompanyColumn,
      });
    }

    // Excel
    const buffer = await file.arrayBuffer();
    // Dynamic import of xlsx to avoid bundling issues if unused
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: 'Workbook contains no sheets' }, { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0]!;
    const firstSheet = workbook.Sheets[firstSheetName]!;
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as unknown[][];

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'Sheet is empty' }, { status: 400 });
    }

    const headers = (jsonData[0] ?? []).map((h) => String(h ?? '').trim()).filter(Boolean);
    const previewRows = jsonData.slice(1, 6).map((row) => {
      const record: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]!] = row[j] != null ? String(row[j]).trim() : '';
      }
      return record;
    });

    return NextResponse.json({
      columns: headers,
      rowCount: Math.max(0, jsonData.length - 1),
      preview: previewRows,
      detectedCompanyColumn: detectCompanyColumn(headers),
      sheets: workbook.SheetNames,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to preview file', detail: message }, { status: 500 });
  }
}

// POST /api/g-intel-acquisition/upload/acquire
async function acquireFromFile(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const connectorId = formData.get('connectorId') as string | null;
    const columnMappingStr = formData.get('columnMapping') as string | null;
    const defaultCategory = formData.get('defaultCategory') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided. Send a file using FormData field "file".' }, { status: 400 });
    }

    let columnMapping: ColumnMapping[] = [];
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr) as ColumnMapping[];
      } catch {
        return NextResponse.json({ error: 'columnMapping must be valid JSON' }, { status: 400 });
      }
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv') || file.type === 'text/csv' || (!isExcel && !fileName.endsWith('.json'));
    const sourceType: SourceType = isExcel ? 'excel' : 'csv';

    // Resolve or create connector
    let resolvedConnectorId = connectorId;
    if (!resolvedConnectorId) {
      const connector = await db.connector.create({
        data: {
          name: `${isExcel ? 'Excel' : 'CSV'} Upload — ${file.name}`,
          sourceType,
          config: JSON.stringify({ columnMapping, defaultCategory }),
          scheduleFrequency: 'manual',
          status: 'active',
        },
      });
      resolvedConnectorId = connector.id;
      await logAction('create', 'Connector', connector.id, { name: connector.name, sourceType, autoCreated: true });
    }

    // Build job config based on file type
    let jobConfig: Record<string, unknown>;
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      jobConfig = { fileBuffer: buffer, columnMapping, defaultCategory };
    } else {
      const text = await file.text();
      jobConfig = { fileContent: text, columnMapping, defaultCategory };
    }

    // Enqueue the job
    const runId = await enqueueJob({
      connectorId: resolvedConnectorId,
      action: 'acquire',
      config: jobConfig,
    });

    await logAction('create', 'ConnectorRun', runId, { connectorId: resolvedConnectorId, sourceType, fileName: file.name });

    return NextResponse.json({ runId, status: 'pending' }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to start acquisition', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONNECTOR RUNS
// ═══════════════════════════════════════════════════════════════

// POST /api/g-intel-acquisition/connectors/[id]/run
async function handleConnectorRun(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return triggerConnectorRun(params.id, req);
}

// GET /api/g-intel-acquisition/connectors/[id]/runs
async function handleConnectorRuns(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return listConnectorRuns(params.id, req);
}

async function triggerConnectorRun(connectorId: string, req: NextRequest): Promise<Response> {
  try {
    const connector = await db.connector.findUnique({ where: { id: connectorId } });
    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    // Allow body config to be merged (for website/rss connectors)
    let bodyConfig: Record<string, unknown> = {};
    try {
      const body = await req.json();
      if (body && typeof body === 'object' && body.config) {
        bodyConfig = body.config as Record<string, unknown>;
      }
    } catch {
      // No body or invalid JSON — use connector's stored config
    }

    const mergedConfig = { ...parseJsonConfig(connector.config), ...bodyConfig };

    const runId = await enqueueJob({
      connectorId,
      action: 'acquire',
      config: mergedConfig,
    });

    await logAction('create', 'ConnectorRun', runId, { connectorId, sourceType: connector.sourceType });

    return NextResponse.json({ runId, status: 'pending' }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to trigger connector run', detail: message }, { status: 500 });
  }
}

async function listConnectorRuns(connectorId: string, req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);

    const connector = await db.connector.findUnique({ where: { id: connectorId } });
    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    const runs = await db.connectorRun.findMany({
      where: { connectorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ runs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list connector runs', detail: message }, { status: 500 });
  }
}

// GET /api/g-intel-acquisition/runs — Recent runs across all connectors
async function handleRecentRuns(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const runs = await db.connectorRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { connector: { select: { name: true, sourceType: true } } },
    });
    return NextResponse.json(runs.map(r => ({
      ...r,
      connectorName: r.connector.name,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    })));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list runs', detail: message }, { status: 500 });
  }
}

// GET /api/g-intel-acquisition/runs/[id]
async function handleRunById(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return getRunById(params.id);
}

async function getRunById(id: string): Promise<Response> {
  try {
    const run = await db.connectorRun.findUnique({
      where: { id },
      include: { connector: { select: { id: true, name: true, sourceType: true } } },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get run', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  COMPANY RESOLUTION
// ═══════════════════════════════════════════════════════════════

async function handleResolveCompany(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return resolveCompanyName(req);
}

async function handleConfirmResolution(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return confirmCompanyResolution(req);
}

// POST /api/g-intel-acquisition/resolve-company
async function resolveCompanyName(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { name, domain } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required and must be a non-empty string' }, { status: 400 });
    }

    const result = await resolveCompany(name.trim(), domain as string | undefined);

    await logAction('resolve', 'Company', '', { name: name.trim(), domain, resolved: result.resolved, needsNewCompany: result.needsNewCompany });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to resolve company', detail: message }, { status: 500 });
  }
}

// POST /api/g-intel-acquisition/confirm-resolution
async function confirmCompanyResolution(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { companyId, alias, runId } = body;

    if (!companyId || typeof companyId !== 'string') {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!alias || typeof alias !== 'string' || !alias.trim()) {
      return NextResponse.json({ error: 'alias is required and must be a non-empty string' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const result = await confirmResolution(companyId, alias.trim());

    await logAction('confirm_resolution', 'Company', companyId, { alias: alias.trim(), runId });

    // If runId is provided, re-process pending items that were blocked by ambiguity
    if (runId) {
      // The job processor handles the full pipeline; if items were ambiguous
      // they would have been logged as errors. For now, we log the re-processing intent.
      await logAction('reprocess_after_resolution', 'ConnectorRun', runId, { companyId, alias: alias.trim() });
    }

    return NextResponse.json({ company: result, confirmed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to confirm resolution', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  KNOWLEDGE FABRIC
// ═══════════════════════════════════════════════════════════════

async function handleKnowledge(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return queryKnowledge(req);
}

async function handleKnowledgeById(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return getKnowledgeEntry(params.id);
}

// GET /api/g-intel-acquisition/knowledge?companyId=[id]
async function queryKnowledge(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId query parameter is required' }, { status: 400 });
    }

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (category) {
      const entries = await getKnowledgeByCategory(companyId, category);
      return NextResponse.json({ companyId, category, entries });
    }

    const result = await getCompanyKnowledge(companyId);
    return NextResponse.json({ companyId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to query knowledge', detail: message }, { status: 500 });
  }
}

// GET /api/g-intel-acquisition/knowledge/[id]
async function getKnowledgeEntry(id: string): Promise<Response> {
  try {
    const entry = await db.knowledgeEntry.findUnique({
      where: { id },
      include: { company: { select: { id: true, rawName: true } } },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get knowledge entry', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════

async function handleStats(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return getStats();
}

async function getStats(): Promise<Response> {
  try {
    const [totalConnectors, totalIntelligence, totalKnowledge] = await Promise.all([
      db.connector.count(),
      db.intelligenceObject.count(),
      db.knowledgeEntry.count(),
    ]);

    // Connector counts by sourceType
    const connectorsByType = await db.connector.groupBy({
      by: ['sourceType'],
      _count: true,
    });

    // Connector counts by status
    const connectorsByStatus = await db.connector.groupBy({
      by: ['status'],
      _count: true,
    });

    // Intelligence object counts by status
    const intelligenceByStatus = await db.intelligenceObject.groupBy({
      by: ['status'],
      _count: true,
    });

    // Knowledge entries by category
    const knowledgeByCategory = await db.knowledgeEntry.groupBy({
      by: ['category'],
      _count: true,
    });

    // Recent runs (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRuns = await db.connectorRun.count({
      where: { createdAt: { gte: oneDayAgo } },
    });

    return NextResponse.json({
      totalConnectors,
      totalIntelligenceObjects: totalIntelligence,
      totalKnowledgeEntries: totalKnowledge,
      connectorsByType: Object.fromEntries(connectorsByType.map((c) => [c.sourceType, c._count])),
      connectorsByStatus: Object.fromEntries(connectorsByStatus.map((c) => [c.status, c._count])),
      intelligenceByStatus: Object.fromEntries(intelligenceByStatus.map((c) => [c.status, c._count])),
      knowledgeByCategory: Object.fromEntries(knowledgeByCategory.map((k) => [k.category, k._count])),
      recentRunsLast24h: recentRuns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get stats', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPRINT 2: ASSOCIATIONS & DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

async function handleAssociations(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return queryAssociations(req);
  if (method === 'POST') return createAssociationHandler(req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// GET /api/g-intel-acquisition/associations?companyId=[id]&type=[type]&unresolvedOnly=[bool]
async function queryAssociations(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type') || undefined;
    const unresolvedOnly = searchParams.get('unresolvedOnly') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId query parameter is required' }, { status: 400 });
    }

    const associations = await getAssociations(companyId, { type, unresolvedOnly });
    return NextResponse.json({ companyId, associations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to query associations', detail: message }, { status: 500 });
  }
}

// POST /api/g-intel-acquisition/associations { sourceId, targetId, associationType, confidence?, metadata? }
async function createAssociationHandler(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { sourceId, targetId, associationType, confidence, metadata } = body;

    if (!sourceId || !targetId || !associationType) {
      return NextResponse.json({ error: 'sourceId, targetId, and associationType are required' }, { status: 400 });
    }

    const validTypes = ['duplicate', 'contradicts', 'supports', 'extends', 'mentions_same_entity'];
    if (!validTypes.includes(associationType)) {
      return NextResponse.json({ error: `associationType must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const association = await createAssociation({ sourceId, targetId, associationType, confidence, metadata });
    return NextResponse.json({ association }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create association', detail: message }, { status: 500 });
  }
}

async function handleDetectDuplicates(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { companyId } = await req.json();
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const duplicates = await detectDuplicates(companyId);
    return NextResponse.json({ companyId, duplicates, totalGroups: duplicates.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to detect duplicates', detail: message }, { status: 500 });
  }
}

async function handleDetectConflicts(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { companyId } = await req.json();
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const conflicts = await detectConflicts(companyId);
    return NextResponse.json({ companyId, conflicts, totalConflicts: conflicts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to detect conflicts', detail: message }, { status: 500 });
  }
}

async function handleMergeDuplicates(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { sourceId, targetId, keepTarget } = await req.json();
    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 });
    }
    const result = await mergeDuplicates(sourceId, targetId, keepTarget ?? true);
    return NextResponse.json({ ...result, merged: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to merge duplicates', detail: message }, { status: 500 });
  }
}

async function handleResolveAssociation(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { associationId, action } = await req.json();
    if (!associationId || !action) {
      return NextResponse.json({ error: 'associationId and action are required' }, { status: 400 });
    }
    const validActions = ['merged', 'dismissed', 'superseded', 'manual'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }
    const association = await resolveAssociationAction(associationId, action);
    return NextResponse.json({ association });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to resolve association', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPRINT 2: CONFIDENCE ENGINE
// ═══════════════════════════════════════════════════════════════

async function handleRecalculateConfidence(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { companyId, objectId } = await req.json();
    if (objectId) {
      const result = await recalculateObjectConfidence(objectId);
      return NextResponse.json(result);
    }
    if (companyId) {
      const result = await recalculateCompanyConfidence(companyId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'companyId or objectId is required' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to recalculate confidence', detail: message }, { status: 500 });
  }
}

async function handleObjectConfidence(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const obj = await db.intelligenceObject.findUnique({ where: { id: params.id } });
    if (!obj) {
      return NextResponse.json({ error: 'Intelligence object not found' }, { status: 404 });
    }
    const result = calculateConfidence(obj as any);
    const explanation = generateConfidenceExplanation(result);
    return NextResponse.json({ objectId: obj.id, result, explanation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get confidence', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPRINT 2: KNOWLEDGE VERSIONING
// ═══════════════════════════════════════════════════════════════

async function handleKnowledgeVersions(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const versions = await getVersionHistory(params.id);
    return NextResponse.json({ knowledgeEntryId: params.id, versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get version history', detail: message }, { status: 500 });
  }
}

async function handleCompareVersions(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { versionId1, versionId2 } = await req.json();
    if (!versionId1 || !versionId2) {
      return NextResponse.json({ error: 'versionId1 and versionId2 are required' }, { status: 400 });
    }
    const diff = await compareVersions(versionId1, versionId2);
    return NextResponse.json(diff);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to compare versions', detail: message }, { status: 500 });
  }
}

async function handleRestoreVersion(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { versionId, reason } = await req.json();
    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }
    const result = await restoreVersion(versionId, reason || 'Restored via API');
    return NextResponse.json({ restored: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to restore version', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPRINT 2: SOURCE GOVERNANCE
// ═══════════════════════════════════════════════════════════════

async function handleSourceHealth(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return getSourceHealthHandler(req);
  if (method === 'POST') return refreshSourceHealth(req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// GET /api/g-intel-acquisition/source-health?connectorId=[id]
async function getSourceHealthHandler(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const connectorId = searchParams.get('connectorId');

    if (connectorId) {
      const health = await calculateSourceHealth(connectorId);
      return NextResponse.json({ health });
    }

    const allHealth = await getAllSourceHealth();
    return NextResponse.json({ sourceHealth: allHealth });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get source health', detail: message }, { status: 500 });
  }
}

// POST /api/g-intel-acquisition/source-health { connectorId? } — recalculate
async function refreshSourceHealth(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.connectorId) {
      const health = await calculateSourceHealth(body.connectorId);
      return NextResponse.json({ health });
    }
    const result = await recalculateAllHealth();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to refresh source health', detail: message }, { status: 500 });
  }
}

async function handleGovernance(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const report = await getGovernanceReport();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get governance report', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3: HUMAN INTELLIGENCE INBOX
// ═══════════════════════════════════════════════════════════════
async function handleInbox(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return listInboxItems(req);
  if (method === 'POST') return submitInboxHandler(req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function listInboxItems(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getInboxItems({
      companyId: searchParams.get('companyId') || undefined,
      status: searchParams.get('status') || undefined,
      submittedBy: searchParams.get('submittedBy') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list inbox items', detail: message }, { status: 500 });
  }
}

async function submitInboxHandler(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { companyId, submittedBy, content, summary, category, source, sourceUrl, priority, tags } = body;
    if (!companyId || !submittedBy || !content) {
      return NextResponse.json({ error: 'companyId, submittedBy, and content are required' }, { status: 400 });
    }
    const item = await submitToIntelligenceInbox({ companyId, submittedBy, content, summary, category, source, sourceUrl, priority, tags });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit intelligence', detail: message }, { status: 500 });
  }
}

async function handleInboxById(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return getSingleInboxItem(params.id);
  if (method === 'PATCH') return updateInboxItemHandler(params.id, req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function getSingleInboxItem(id: string): Promise<Response> {
  try {
    const item = await getInboxItem(id);
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get inbox item', detail: message }, { status: 500 });
  }
}

async function updateInboxItemHandler(id: string, req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const item = await updateInboxItem(id, body);
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update inbox item', detail: message }, { status: 500 });
  }
}

async function handleInboxReview(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { action, reviewerId, notes } = await req.json();
    if (!action || !reviewerId) {
      return NextResponse.json({ error: 'action and reviewerId are required' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }
    const item = await reviewInboxItem(params.id, action, reviewerId, notes);
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to review inbox item', detail: message }, { status: 500 });
  }
}

async function handleInboxConvert(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const result = await convertApprovedItem(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to convert inbox item', detail: message }, { status: 500 });
  }
}

async function handleInboxStats(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const stats = await getInboxStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get inbox stats', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3: TIMELINE
// ═══════════════════════════════════════════════════════════════
async function handleTimeline(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const result = await getCompanyTimeline(companyId, {
      eventType: searchParams.get('eventType') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      actor: searchParams.get('actor') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 30,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get timeline', detail: message }, { status: 500 });
  }
}

async function handleRecentTimeline(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;
    const events = await getRecentEvents(limit);
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get recent timeline', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3: CONNECTOR SCHEDULER
// ═══════════════════════════════════════════════════════════════
async function handleSchedulerOverview(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const overview = await getScheduleOverview();
    return NextResponse.json(overview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get schedule overview', detail: message }, { status: 500 });
  }
}

async function handleSchedulerDue(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const due = await getDueConnectors();
    return NextResponse.json({ due, count: due.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get due connectors', detail: message }, { status: 500 });
  }
}

async function handleSchedulerTrigger(method: HttpMethod, _req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const result = await triggerScheduledRun(params.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to trigger connector', detail: message }, { status: 500 });
  }
}

async function handleSchedulerRunAllDue(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const result = await runAllDueConnectors();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to run due connectors', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3: ALERTS
// ═══════════════════════════════════════════════════════════════
async function handleAlerts(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method === 'GET') return listAlerts(req);
  if (method === 'POST') return createAlertHandler(req);
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function listAlerts(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getAlerts({
      companyId: searchParams.get('companyId') || undefined,
      connectorId: searchParams.get('connectorId') || undefined,
      severity: searchParams.get('severity') || undefined,
      alertType: searchParams.get('alertType') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list alerts', detail: message }, { status: 500 });
  }
}

async function createAlertHandler(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const validTypes = ['health_degraded', 'source_stale', 'conflict_detected', 'duplicate_cluster', 'confidence_drop', 'ingestion_failure', 'schedule_missed'];
    if (!validSeverities.includes(body.severity) || !validTypes.includes(body.alertType) || !body.title || !body.description) {
      return NextResponse.json({ error: 'severity, alertType, title, and description are required with valid values' }, { status: 400 });
    }
    const alert = await createAlert(body);
    return NextResponse.json({ alert }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create alert', detail: message }, { status: 500 });
  }
}

async function handleAlertSummary(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const summary = await getAlertSummary();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get alert summary', detail: message }, { status: 500 });
  }
}

async function handleAlertAcknowledge(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const alert = await acknowledgeAlert(params.id, userId);
    return NextResponse.json({ alert });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to acknowledge alert', detail: message }, { status: 500 });
  }
}

async function handleAlertResolve(method: HttpMethod, req: NextRequest, params: Record<string, string>): Promise<Response> {
  if (method !== 'POST') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { userId, notes } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const alert = await resolveAlertAction(params.id, userId, notes);
    return NextResponse.json({ alert });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to resolve alert', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3: ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function handleAnalyticsOverview(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const overview = await getIntelligenceOverview();
    return NextResponse.json(overview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get analytics overview', detail: message }, { status: 500 });
  }
}

async function handleAnalyticsTrends(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const days = searchParams.get('days') ? Number(searchParams.get('days')) : 30;
    const trends = await getAcquisitionTrends(days);
    return NextResponse.json({ trends });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get acquisition trends', detail: message }, { status: 500 });
  }
}

async function handleAnalyticsConfidenceDistribution(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const dist = await getConfidenceDistribution();
    return NextResponse.json(dist);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get confidence distribution', detail: message }, { status: 500 });
  }
}

async function handleAnalyticsKnowledgeCoverage(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId') || undefined;
    const coverage = await getKnowledgeCoverage(companyId);
    return NextResponse.json(coverage);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get knowledge coverage', detail: message }, { status: 500 });
  }
}

async function handleAnalyticsSourcePerformance(method: HttpMethod, _req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const perf = await getSourcePerformance();
    return NextResponse.json({ sources: perf });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get source performance', detail: message }, { status: 500 });
  }
}

async function handleAnalyticsActivityFeed(method: HttpMethod, req: NextRequest, _params: Record<string, string>): Promise<Response> {
  if (method !== 'GET') return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;
    const feed = await getActivityFeed(limit);
    return NextResponse.json({ feed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to get activity feed', detail: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ROUTE DISPATCHERS
// ═══════════════════════════════════════════════════════════════

async function dispatch(method: HttpMethod, req: NextRequest, slug: string[]): Promise<Response> {
  const matched = matchRoute(slug);
  if (!matched) {
    return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  }

  // Authentication check
  const auth = await checkApiAuth();
  if (auth.errorResponse) return auth.errorResponse;

  try {
    return await matched.handler(method, req, matched.params);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[router:g-intel-acquisition] ${method} /${slug.join('/')}:`, message);
    return NextResponse.json({ error: 'Internal error', detail: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('GET', req, slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('POST', req, slug);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('PATCH', req, slug);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return dispatch('DELETE', req, slug);
}