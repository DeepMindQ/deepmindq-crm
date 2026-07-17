import { NextRequest, NextResponse } from 'next/server';

// Inline imports for ai routes (32 handlers)
import * as mod_ai__suggested_contacts from './ai__suggested-contacts.ts';
import * as mod_ai__signals from './ai__signals.ts';
import * as mod_ai__recommendations from './ai__recommendations.ts';
import * as mod_ai__query from './ai__query.ts';
import * as mod_ai__chat from './ai__chat.ts';
import * as mod_ai__score_leads from './ai__score-leads.ts';
import * as mod_ai__enrich from './ai__enrich.ts';
import * as mod_ai__summarize from './ai__summarize.ts';
import * as mod_ai__opportunities from './ai__opportunities.ts';
import * as mod_ai__relationship_memory from './ai__relationship-memory.ts';
import * as mod_ai__conversation_plan from './ai__conversation-plan.ts';
import * as mod_ai__insights from './ai__insights.ts';
import * as mod_ai__account_brief from './ai__account-brief.ts';
import * as mod_ai__generate from './ai__generate.ts';
import * as mod_ai__generate_pdf from './ai__generate-pdf.ts';
import * as mod_command_center__query from './command-center__query.ts';
import * as mod_command_center__insights from './command-center__insights.ts';
import * as mod_research_agent from './research-agent.ts';
import * as mod_capabilities from './capabilities.ts';
import * as mod_capabilities__import from './capabilities__import.ts';
import * as mod_capabilities__dedup_check from './capabilities__dedup-check.ts';
import * as mod_capabilities__enrich from './capabilities__enrich.ts';
import * as mod_capabilities___id__children from './capabilities___id__children.ts';
import * as mod_capabilities__export from './capabilities__export.ts';
import * as mod_knowledge from './knowledge.ts';
import * as mod_knowledge__engine from './knowledge__engine.ts';
import * as mod_knowledge__search from './knowledge__search.ts';
import * as mod_knowledge__search__rebuild from './knowledge__search__rebuild.ts';
import * as mod_knowledge__search__feedback from './knowledge__search__feedback.ts';
import * as mod_knowledge___id from './knowledge___id.ts';
import * as mod_knowledge__graph from './knowledge__graph.ts';
import * as mod_conversation_plans from './conversation-plans.ts';
import * as mod_conversation_plans___id from './conversation-plans___id.ts';

// Route registry
const ROUTES = [
  { key: 'ai/suggested-contacts', handler: mod_ai__suggested_contacts },
  { key: 'ai/signals', handler: mod_ai__signals },
  { key: 'ai/recommendations', handler: mod_ai__recommendations },
  { key: 'ai/query', handler: mod_ai__query },
  { key: 'ai/chat', handler: mod_ai__chat },
  { key: 'ai/score-leads', handler: mod_ai__score_leads },
  { key: 'ai/enrich', handler: mod_ai__enrich },
  { key: 'ai/summarize', handler: mod_ai__summarize },
  { key: 'ai/opportunities', handler: mod_ai__opportunities },
  { key: 'ai/relationship-memory', handler: mod_ai__relationship_memory },
  { key: 'ai/conversation-plan', handler: mod_ai__conversation_plan },
  { key: 'ai/insights', handler: mod_ai__insights },
  { key: 'ai/account-brief', handler: mod_ai__account_brief },
  { key: 'ai/generate', handler: mod_ai__generate },
  { key: 'ai/generate-pdf', handler: mod_ai__generate_pdf },
  { key: 'command-center/query', handler: mod_command_center__query },
  { key: 'command-center/insights', handler: mod_command_center__insights },
  { key: 'research-agent', handler: mod_research_agent },
  { key: 'capabilities', handler: mod_capabilities },
  { key: 'capabilities/import', handler: mod_capabilities__import },
  { key: 'capabilities/dedup-check', handler: mod_capabilities__dedup_check },
  { key: 'capabilities/enrich', handler: mod_capabilities__enrich },
  { key: 'capabilities/[id]/children', handler: mod_capabilities___id__children },
  { key: 'capabilities/export', handler: mod_capabilities__export },
  { key: 'knowledge', handler: mod_knowledge },
  { key: 'knowledge/engine', handler: mod_knowledge__engine },
  { key: 'knowledge/search', handler: mod_knowledge__search },
  { key: 'knowledge/search/rebuild', handler: mod_knowledge__search__rebuild },
  { key: 'knowledge/search/feedback', handler: mod_knowledge__search__feedback },
  { key: 'knowledge/[id]', handler: mod_knowledge___id },
  { key: 'knowledge/graph', handler: mod_knowledge__graph },
  { key: 'conversation-plans', handler: mod_conversation_plans },
  { key: 'conversation-plans/[id]', handler: mod_conversation_plans___id },
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
  catch (err: any) { console.error(`[router:ai] ${method} /${slug.join('/')}:`, err.message); return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 }); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('GET', req, slug); }
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('POST', req, slug); }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PUT', req, slug); }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('PATCH', req, slug); }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('DELETE', req, slug); }
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) { const { slug } = await params; return handle('OPTIONS', req, slug); }
