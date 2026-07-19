import { NextRequest, NextResponse } from 'next/server';

// Inline imports for outreach routes (22 handlers)
import * as mod_sequences from './sequences.ts';
import * as mod_sequences__signal_driven from './sequences__signal-driven.ts';
import * as mod_sequences__enroll from './sequences__enroll.ts';
import * as mod_sequences___id from './sequences___id.ts';
import * as mod_sequences___id__steps___stepId from './sequences___id__steps___stepId.ts';
import * as mod_sequences___id__execute from './sequences___id__execute.ts';
import * as mod_sequences__process from './sequences__process.ts';
import * as mod_templates from './templates.ts';
import * as mod_prompt_templates from './prompt-templates.ts';
import * as mod_prompt_templates___id from './prompt-templates___id.ts';
import * as mod_queue from './queue.ts';
import * as mod_drafts from './drafts.ts';
import * as mod_drafts___id from './drafts___id.ts';
import * as mod_replies from './replies.ts';
import * as mod_email_worker from './email-worker.ts';
import * as mod_tracking__click from './tracking__click.ts';
import * as mod_tracking__open from './tracking__open.ts';
import * as mod_webhooks__bounce from './webhooks__bounce.ts';
import * as mod_webhooks__reply from './webhooks__reply.ts';
import * as mod_unsubscribe from './unsubscribe.ts';
import * as mod_verify_email from './verify-email.ts';
import * as mod_verify_queue from './verify-queue.ts';
import * as mod_verify_queue__process from './verify-queue__process.ts';
import * as mod_review_queue from './review-queue.ts';
import * as mod_drafts__batch from './drafts__batch.ts';
import * as mod_opportunities from './opportunities.ts';
import * as mod_opportunities__batch from './opportunities__batch.ts';
import * as mod_pursuits from './pursuits.ts';

// Route registry
const ROUTES = [
  { key: 'sequences', handler: mod_sequences },
  { key: 'sequences/signal-driven', handler: mod_sequences__signal_driven },
  { key: 'sequences/enroll', handler: mod_sequences__enroll },
  { key: 'sequences/[id]', handler: mod_sequences___id },
  { key: 'sequences/[id]/steps/[stepId]', handler: mod_sequences___id__steps___stepId },
  { key: 'sequences/[id]/execute', handler: mod_sequences___id__execute },
  { key: 'sequences/process', handler: mod_sequences__process },
  { key: 'templates', handler: mod_templates },
  { key: 'prompt-templates', handler: mod_prompt_templates },
  { key: 'prompt-templates/[id]', handler: mod_prompt_templates___id },
  { key: 'queue', handler: mod_queue },
  { key: 'review-queue', handler: mod_review_queue },
  { key: 'drafts', handler: mod_drafts },
  { key: 'drafts/batch', handler: mod_drafts__batch },
  { key: 'drafts/[id]', handler: mod_drafts___id },

  // Phase 4 Track C: Opportunity Intelligence Layer
  { key: 'opportunities', handler: mod_opportunities },
  { key: 'opportunities/batch', handler: mod_opportunities__batch },
  { key: 'pursuits', handler: mod_pursuits },
  { key: 'pursuits/[id]', handler: mod_pursuits },
  { key: 'replies', handler: mod_replies },
  { key: 'email-worker', handler: mod_email_worker },
  { key: 'tracking/click', handler: mod_tracking__click },
  { key: 'tracking/open', handler: mod_tracking__open },
  { key: 'webhooks/bounce', handler: mod_webhooks__bounce },
  { key: 'webhooks/reply', handler: mod_webhooks__reply },
  { key: 'unsubscribe', handler: mod_unsubscribe },
  { key: 'verify-email', handler: mod_verify_email },
  { key: 'verify-queue', handler: mod_verify_queue },
  { key: 'verify-queue/process', handler: mod_verify_queue__process },
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
  catch (err: any) { console.error(`[router:outreach] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }
