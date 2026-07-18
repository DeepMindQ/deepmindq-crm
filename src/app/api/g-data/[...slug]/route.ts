import { NextRequest, NextResponse } from 'next/server';

// Inline imports for data routes (10 original + Data Intelligence handlers)
import * as mod_stats from './stats.ts';
import * as mod_dashboard from './dashboard.ts';
import * as mod_analytics from './analytics.ts';
import * as mod_data_health from './data-health.ts';
import * as mod_team__performance from './team__performance.ts';
import * as mod_ab_tests from './ab-tests.ts';
import * as mod_notifications from './notifications.ts';
import * as mod_compliance from './compliance.ts';
import * as mod_audit from './audit.ts';
import * as mod_audit_logs from './audit-logs.ts';

// Data Intelligence Engine
import * as mod_upload_analyze from './upload__analyze.ts';
import * as mod_upload_create from './upload__create.ts';
import * as mod_upload_process_chunk from './upload___id__process-chunk.ts';
import * as mod_upload_progress from './upload___id__progress.ts';
import * as mod_upload_review from './upload___id__review.ts';
import * as mod_upload_apply_corrections from './upload___id__apply-corrections.ts';
import * as mod_upload_commit from './upload___id__commit.ts';
import * as mod_upload_cancel from './upload___id__cancel.ts';
import * as mod_uploads from './uploads.ts';
import * as mod_config_column_rules from './config__column-rules.ts';
import * as mod_config_column_rules_id from './config__column-rules___id.ts';
import * as mod_config_validation_rules from './config__validation-rules.ts';
import * as mod_config_validation_rules_id from './config__validation-rules___id.ts';
import * as mod_config_normalization from './config__normalization.ts';
import * as mod_config_normalization_id from './config__normalization___id.ts';
import * as mod_config_scoring from './config__scoring.ts';
import * as mod_config_scoring_id from './config__scoring___id.ts';
import * as mod_config_seed from './config__seed.ts';

// Route registry
const ROUTES = [
  // Original data routes
  { key: 'stats', handler: mod_stats },
  { key: 'dashboard', handler: mod_dashboard },
  { key: 'analytics', handler: mod_analytics },
  { key: 'data-health', handler: mod_data_health },
  { key: 'team/performance', handler: mod_team__performance },
  { key: 'ab-tests', handler: mod_ab_tests },
  { key: 'notifications', handler: mod_notifications },
  { key: 'compliance', handler: mod_compliance },
  { key: 'audit', handler: mod_audit },
  { key: 'audit-logs', handler: mod_audit_logs },

  // Data Intelligence: Upload workflow
  { key: 'upload/analyze', handler: mod_upload_analyze },
  { key: 'upload/create', handler: mod_upload_create },
  { key: 'upload/[id]/process-chunk', handler: mod_upload_process_chunk },
  { key: 'upload/[id]/progress', handler: mod_upload_progress },
  { key: 'upload/[id]/review', handler: mod_upload_review },
  { key: 'upload/[id]/apply-corrections', handler: mod_upload_apply_corrections },
  { key: 'upload/[id]/commit', handler: mod_upload_commit },
  { key: 'upload/[id]/cancel', handler: mod_upload_cancel },
  { key: 'uploads', handler: mod_uploads },

  // Data Intelligence: Config CRUD
  { key: 'config/column-rules', handler: mod_config_column_rules },
  { key: 'config/column-rules/[id]', handler: mod_config_column_rules_id },
  { key: 'config/validation-rules', handler: mod_config_validation_rules },
  { key: 'config/validation-rules/[id]', handler: mod_config_validation_rules_id },
  { key: 'config/normalization', handler: mod_config_normalization },
  { key: 'config/normalization/[id]', handler: mod_config_normalization_id },
  { key: 'config/scoring', handler: mod_config_scoring },
  { key: 'config/scoring/[id]', handler: mod_config_scoring_id },
  { key: 'config/seed', handler: mod_config_seed },
];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

function keyToRegex(key: string): { regex: RegExp; paramNames: string[] } {
  const parts = key.split('/');
  const regexParts: string[] = [];
  const paramNames: string[] = [];
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      if (inner.startsWith('...')) {
        paramNames.push(inner.slice(3));
        regexParts.push('(.+)');
      } else {
        paramNames.push(inner);
        regexParts.push('([^/]+)');
      }
    } else {
      regexParts.push(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  return { regex: new RegExp('^' + regexParts.join('/') + '$'), paramNames };
}

function matchRoute(slug: string[]): { handler: Record<string, Function>; params: Record<string, string> } | null {
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

async function handle(method: HttpMethod, req: NextRequest, slug: string[]): Promise<Response> {
  const matched = matchRoute(slug);
  if (!matched) return NextResponse.json({ error: 'Not found', path: slug.join('/') }, { status: 404 });
  const fn = matched.handler[method];
  if (typeof fn !== 'function') return NextResponse.json({ error: `${method} not allowed` }, { status: 405 });
  try { return await fn(req, { params: Promise.resolve(matched.params) }); }
  catch (err: any) { console.error(`[router:data] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }
