import { NextRequest, NextResponse } from 'next/server';

// Inline imports for crm routes (41 handlers)
import * as mod_companies from './companies.ts';
import * as mod_companies__mind_map from './companies__mind-map.ts';
import * as mod_companies__enrich from './companies__enrich.ts';
import * as mod_companies__stats from './companies__stats.ts';
import * as mod_companies__compare from './companies__compare.ts';
import * as mod_companies__bulk from './companies__bulk.ts';
import * as mod_companies__enrich_batch from './companies__enrich-batch.ts';
import * as mod_companies__enrich_batch___id from './companies__enrich-batch___id.ts';
import * as mod_companies___id from './companies___id.ts';
import * as mod_companies___id__signals from './companies___id__signals.ts';
import * as mod_companies___id__signals___signalId from './companies___id__signals___signalId.ts';
import * as mod_companies___id__notes from './companies___id__notes.ts';
import * as mod_companies___id__notes___noteId from './companies___id__notes___noteId.ts';
import * as mod_companies___id__intelligence from './companies___id__intelligence.ts';
import * as mod_companies___id__contacts from './companies___id__contacts.ts';
import * as mod_companies___id__timeline from './companies___id__timeline.ts';
import * as mod_companies__meta from './companies__meta.ts';
import * as mod_contacts from './contacts.ts';
import * as mod_contacts___id from './contacts___id.ts';
import * as mod_contacts___id__generate_email from './contacts___id__generate-email.ts';
import * as mod_contacts___id__notes from './contacts___id__notes.ts';
import * as mod_contacts___id__timeline from './contacts___id__timeline.ts';
import * as mod_contacts___id__validate from './contacts___id__validate.ts';
import * as mod_signals from './signals.ts';
import * as mod_segments from './segments.ts';
import * as mod_segments___id__contacts from './segments___id__contacts.ts';
import * as mod_suppressions from './suppressions.ts';
import * as mod_pipeline from './pipeline.ts';
import * as mod_leads from './leads.ts';
import * as mod_leads__dedup from './leads__dedup.ts';
import * as mod_leads__source_stats from './leads__source-stats.ts';
import * as mod_leads__lookalike from './leads__lookalike.ts';
import * as mod_leads__status from './leads__status.ts';
import * as mod_leads__recalculate_scores from './leads__recalculate-scores.ts';
import * as mod_leads__assign from './leads__assign.ts';
import * as mod_leads__export from './leads__export.ts';
import * as mod_leads__consent from './leads__consent.ts';
import * as mod_leads__schedule_optimal from './leads__schedule-optimal.ts';
import * as mod_duplicates from './duplicates.ts';
import * as mod_batches from './batches.ts';
import * as mod_batches___id__progress from './batches___id__progress.ts';
import * as mod_batches__preview from './batches__preview.ts';
import * as mod_bounces from './bounces.ts';

// Route registry
const ROUTES = [
  { key: 'companies', handler: mod_companies },
  { key: 'companies/mind-map', handler: mod_companies__mind_map },
  { key: 'companies/enrich', handler: mod_companies__enrich },
  { key: 'companies/stats', handler: mod_companies__stats },
  { key: 'companies/compare', handler: mod_companies__compare },
  { key: 'companies/bulk', handler: mod_companies__bulk },
  { key: 'companies/enrich-batch', handler: mod_companies__enrich_batch },
  { key: 'companies/enrich-batch/[id]', handler: mod_companies__enrich_batch___id },
  { key: 'companies/[id]', handler: mod_companies___id },
  { key: 'companies/[id]/signals', handler: mod_companies___id__signals },
  { key: 'companies/[id]/signals/[signalId]', handler: mod_companies___id__signals___signalId },
  { key: 'companies/[id]/notes', handler: mod_companies___id__notes },
  { key: 'companies/[id]/notes/[noteId]', handler: mod_companies___id__notes___noteId },
  { key: 'companies/[id]/intelligence', handler: mod_companies___id__intelligence },
  { key: 'companies/[id]/contacts', handler: mod_companies___id__contacts },
  { key: 'companies/[id]/timeline', handler: mod_companies___id__timeline },
  { key: 'companies/meta', handler: mod_companies__meta },
  { key: 'contacts', handler: mod_contacts },
  { key: 'contacts/[id]', handler: mod_contacts___id },
  { key: 'contacts/[id]/generate-email', handler: mod_contacts___id__generate_email },
  { key: 'contacts/[id]/notes', handler: mod_contacts___id__notes },
  { key: 'contacts/[id]/timeline', handler: mod_contacts___id__timeline },
  { key: 'contacts/[id]/validate', handler: mod_contacts___id__validate },
  { key: 'signals', handler: mod_signals },
  { key: 'segments', handler: mod_segments },
  { key: 'segments/[id]/contacts', handler: mod_segments___id__contacts },
  { key: 'suppressions', handler: mod_suppressions },
  { key: 'pipeline', handler: mod_pipeline },
  { key: 'leads', handler: mod_leads },
  { key: 'leads/dedup', handler: mod_leads__dedup },
  { key: 'leads/source-stats', handler: mod_leads__source_stats },
  { key: 'leads/lookalike', handler: mod_leads__lookalike },
  { key: 'leads/status', handler: mod_leads__status },
  { key: 'leads/recalculate-scores', handler: mod_leads__recalculate_scores },
  { key: 'leads/assign', handler: mod_leads__assign },
  { key: 'leads/export', handler: mod_leads__export },
  { key: 'leads/consent', handler: mod_leads__consent },
  { key: 'leads/schedule-optimal', handler: mod_leads__schedule_optimal },
  { key: 'duplicates', handler: mod_duplicates },
  { key: 'batches', handler: mod_batches },
  { key: 'batches/[id]/progress', handler: mod_batches___id__progress },
  { key: 'batches/preview', handler: mod_batches__preview },
  { key: 'bounces', handler: mod_bounces },
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
  catch (err: any) { console.error(`[router:crm] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }
